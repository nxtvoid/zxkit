import type {
  AuthzAdapter,
  AuthzCache,
  AuthzDeniedEvent,
  AuthzGrantedEvent,
  AuthzMutationResult,
  AuthzPermissionIssue,
  AuthzRole,
  AuthzRoleResult,
  AuthzRoute,
  AuthzSession,
  AuthzSnapshot,
  AuthzUser,
  Awaitable,
  PermissionInput,
  PermissionRequirement,
  Permissions,
} from '../core/types'
import { filterByPermission, getMissingPermissions, hasPermissions } from '../core/permissions'
import { hasMatchingRole } from '../core/roles'
import { SNAPSHOT_NAMESPACE, createSnapshot, createSnapshotKey } from '../core/snapshot'
import { createNoopCache } from '../cache/noop'
import { AccessDeniedError } from './errors'

type CreateAuthzOptions<TUser extends AuthzUser, TPermissions extends PermissionInput> = {
  permissions: TPermissions
  getSession: () => Awaitable<AuthzSession<TUser> | null>
  adapter: AuthzAdapter<TUser>
  cache?: AuthzCache | false
  cacheTtl?: number
  /**
   * Milliseconds before a cache operation is treated as failed. Reads and
   * writes that time out degrade to a cache miss; invalidations that time out
   * are reported as CACHE_INVALIDATION_FAILED. Off by default.
   */
  cacheTimeoutMs?: number
  /**
   * Fired when a throwing guard (`require*`, `protect*`) denies access. Useful
   * for audit logs and telemetry. Hook errors are caught and logged, never
   * propagated.
   */
  onDenied?: (event: AuthzDeniedEvent) => void
  /**
   * Fired when a throwing guard (`require*`, `protect*`) grants access. Hook
   * errors are caught and logged, never propagated.
   */
  onGranted?: (event: AuthzGrantedEvent) => void
}

type GuardOptions = {
  bypassCache?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function getErrorCode(error: unknown) {
  return isRecord(error) && typeof error.code === 'string' ? error.code : undefined
}

function errorTargetIncludes(error: unknown, field: string) {
  if (!isRecord(error) || !isRecord(error.meta)) {
    return getErrorMessage(error).includes(field)
  }

  const target = error.meta.target

  if (Array.isArray(target)) {
    return target.includes(field)
  }

  if (typeof target === 'string') {
    return target.includes(field)
  }

  return getErrorMessage(error).includes(field)
}

function isUniqueConstraintError(error: unknown, field?: string) {
  const isUnique =
    getErrorCode(error) === 'P2002' || /unique constraint/i.test(getErrorMessage(error))

  if (!isUnique || !field) {
    return isUnique
  }

  return errorTargetIncludes(error, field)
}

function isRecordNotFoundError(error: unknown) {
  return getErrorCode(error) === 'P2025' || /not found/i.test(getErrorMessage(error))
}

function hasErrorTarget(error: unknown) {
  return isRecord(error) && isRecord(error.meta) && error.meta.target != null
}

// Unique violations that name a constraint outside the user-role assignment
// (e.g. raised by a trigger) must not be reported as "already assigned".
function isAssignmentConflictError(error: unknown) {
  if (!isUniqueConstraintError(error)) {
    return false
  }

  if (!hasErrorTarget(error)) {
    return true
  }

  return errorTargetIncludes(error, 'userId') || errorTargetIncludes(error, 'roleId')
}

const CACHE_ERROR_LOG_INTERVAL_MS = 60_000

// Reads and writes degrade to a cache miss when the cache backend is down
// (e.g. Redis unreachable or over quota) so authorization keeps resolving
// through the adapter instead of crashing every guarded request. Deletes are
// NOT wrapped: a swallowed invalidation could serve stale permissions once the
// backend recovers, so those failures keep surfacing as CACHE_INVALIDATION_FAILED.
function createResilientCache(cache: AuthzCache, timeoutMs?: number): AuthzCache {
  let lastLoggedAt = 0

  function logCacheError(operation: 'read' | 'write', error: unknown) {
    const now = Date.now()

    if (now - lastLoggedAt < CACHE_ERROR_LOG_INTERVAL_MS) {
      return
    }

    lastLoggedAt = now
    console.error(
      `Authz cache ${operation} failed; continuing without cache until it recovers:`,
      error
    )
  }

  async function withTimeout<T>(operation: Awaitable<T>): Promise<T> {
    if (!timeoutMs) {
      return operation
    }

    let timer: ReturnType<typeof setTimeout> | undefined

    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Authz cache operation timed out after ${timeoutMs}ms`)),
            timeoutMs
          )
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    async get<T>(key: string) {
      try {
        return await withTimeout(cache.get<T>(key))
      } catch (error) {
        logCacheError('read', error)
        return null
      }
    },
    async set<T>(key: string, value: T, options?: { ttl?: number }) {
      try {
        await withTimeout(cache.set(key, value, options))
      } catch (error) {
        logCacheError('write', error)
      }
    },
    delete: (key) => withTimeout(cache.delete(key)),
    ...(cache.deleteMany
      ? { deleteMany: (keys: string[]) => withTimeout(cache.deleteMany!(keys)) }
      : {}),
    ...(cache.clearNamespace
      ? { clearNamespace: (namespace: string) => withTimeout(cache.clearNamespace!(namespace)) }
      : {}),
  }
}

function roleResult(
  input: Omit<AuthzRoleResult, 'role'> & { role?: AuthzRole | null }
): AuthzRoleResult {
  return {
    ...input,
    role: input.role ?? null,
  }
}

function mutationResult(input: AuthzMutationResult): AuthzMutationResult {
  return input
}

export function createAuthz<
  TUser extends AuthzUser = AuthzUser,
  const TPermissions extends PermissionInput = PermissionInput,
>(options: CreateAuthzOptions<TUser, TPermissions>) {
  void options.permissions

  const cache = createResilientCache(
    options.cache === false ? createNoopCache() : (options.cache ?? createNoopCache()),
    options.cacheTimeoutMs
  )
  const cacheSetOptions = options.cacheTtl ? { ttl: options.cacheTtl } : undefined
  const inFlight = new Map<string, Promise<AuthzSnapshot<TUser>>>()

  async function getSession() {
    return options.getSession()
  }

  async function requireAuth() {
    const session = await getSession()

    if (!session) {
      throw new AccessDeniedError('Authentication required', 'UNAUTHORIZED')
    }

    return session
  }

  // Audit hooks must never break authorization, so a throwing hook is caught
  // and logged instead of propagating into the guarded code path.
  function notifyDenied(event: AuthzDeniedEvent) {
    try {
      options.onDenied?.(event)
    } catch (error) {
      console.error('Authz onDenied hook failed:', error)
    }
  }

  function notifyGranted(event: AuthzGrantedEvent) {
    try {
      options.onGranted?.(event)
    } catch (error) {
      console.error('Authz onGranted hook failed:', error)
    }
  }

  // Snapshot resolver used only by throwing guards so a missing session emits an
  // onDenied 'UNAUTHORIZED' event. Non-throwing checks (can, canEach, ...) use
  // getSnapshot directly and stay silent.
  async function guardSnapshot(
    kind: AuthzDeniedEvent['kind'],
    required: unknown,
    guardOptions?: GuardOptions
  ) {
    try {
      return await getSnapshot(guardOptions)
    } catch (error) {
      if (AccessDeniedError.is(error) && error.code === 'UNAUTHORIZED') {
        notifyDenied({ kind, code: 'UNAUTHORIZED', required })
      }
      throw error
    }
  }

  // Public auth guard (distinct from the silent internal requireAuth used by
  // getSnapshot) so a direct authz.requireAuth() participates in audit hooks.
  async function requireSession() {
    try {
      const session = await requireAuth()
      notifyGranted({ userId: session.user.id, kind: 'auth' })
      return session
    } catch (error) {
      if (AccessDeniedError.is(error) && error.code === 'UNAUTHORIZED') {
        notifyDenied({ kind: 'auth', code: 'UNAUTHORIZED' })
      }
      throw error
    }
  }

  async function fetchSnapshot(session: AuthzSession<TUser>, key: string) {
    const roles = await options.adapter.getUserRoles({
      userId: session.user.id,
      user: session.user,
    })
    const snapshot = createSnapshot(session.user, roles)
    await cache.set(key, snapshot, cacheSetOptions)
    return snapshot
  }

  async function getSnapshot(snapshotOptions?: GuardOptions): Promise<AuthzSnapshot<TUser>> {
    const session = await requireAuth()
    const key = createSnapshotKey(session.user.id)

    if (!snapshotOptions?.bypassCache) {
      const cached = await cache.get<AuthzSnapshot<TUser>>(key)
      if (cached) return cached

      const existing = inFlight.get(key)
      if (existing) return existing
    }

    const promise = fetchSnapshot(session, key).finally(() => inFlight.delete(key))

    if (!snapshotOptions?.bypassCache) {
      inFlight.set(key, promise)
    }

    return promise
  }

  async function invalidateUser(userId: string) {
    await cache.delete(createSnapshotKey(userId))
  }

  async function invalidateUsers(userIds: readonly string[]) {
    const keys = userIds.map((userId) => createSnapshotKey(userId))

    if (cache.deleteMany) {
      await cache.deleteMany(keys)
      return
    }

    await Promise.all(keys.map((key) => cache.delete(key)))
  }

  async function invalidateRole(roleId: string) {
    if (options.adapter.listUserIdsByRole) {
      await invalidateUsers(await options.adapter.listUserIdsByRole(roleId))
      return
    }

    if (cache.clearNamespace) {
      await cache.clearNamespace(SNAPSHOT_NAMESPACE)
      return
    }

    console.warn(
      `Cache for role "${roleId}" could not be invalidated: ` +
        'implement adapter.listUserIdsByRole or cache.clearNamespace to enable role-level invalidation.'
    )
  }

  async function can(
    permissions: PermissionRequirement<TPermissions>,
    guardOptions?: GuardOptions
  ) {
    const snapshot = await getSnapshot(guardOptions)
    return hasPermissions(snapshot.permissions, permissions as PermissionInput)
  }

  async function requirePermission(
    permissions: PermissionRequirement<TPermissions>,
    guardOptions?: GuardOptions
  ) {
    const snapshot = await guardSnapshot('permission', permissions, guardOptions)

    if (!hasPermissions(snapshot.permissions, permissions as PermissionInput)) {
      notifyDenied({
        userId: snapshot.user.id,
        kind: 'permission',
        code: 'FORBIDDEN',
        required: permissions,
      })
      throw new AccessDeniedError('Missing required permission', 'FORBIDDEN')
    }

    notifyGranted({ userId: snapshot.user.id, kind: 'permission', required: permissions })
  }

  // Runs `run` only when the current user satisfies the requirement, otherwise
  // returns `fallback` (undefined by default). Convenient for Prisma queries
  // that should execute conditionally inside a server action.
  async function when<TResult, TFallback = undefined>(
    permissions: PermissionRequirement<TPermissions>,
    run: (context: AuthzSnapshot<TUser>) => Awaitable<TResult>,
    fallback?: TFallback,
    guardOptions?: GuardOptions
  ): Promise<TResult | TFallback> {
    const snapshot = await getSnapshot(guardOptions)

    if (hasPermissions(snapshot.permissions, permissions as PermissionInput)) {
      return run(snapshot)
    }

    return fallback as TFallback
  }

  // Resolves the snapshot once, then checks every entry against it. Returns a
  // record keyed the same as the input so callers destructure by name instead of
  // juggling a positional Promise.all.
  async function canEach<TChecks extends Record<string, PermissionRequirement<TPermissions>>>(
    checks: TChecks,
    guardOptions?: GuardOptions
  ): Promise<Record<keyof TChecks, boolean>> {
    const snapshot = await getSnapshot(guardOptions)
    const result = {} as Record<keyof TChecks, boolean>

    for (const key in checks) {
      result[key] = hasPermissions(snapshot.permissions, checks[key] as PermissionInput)
    }

    return result
  }

  // OR across a list of requirements: passes when the user satisfies any one of
  // them. `can` already ANDs the actions inside a single requirement.
  async function canAny(
    requirements: readonly PermissionRequirement<TPermissions>[],
    guardOptions?: GuardOptions
  ) {
    const snapshot = await getSnapshot(guardOptions)
    return requirements.some((requirement) =>
      hasPermissions(snapshot.permissions, requirement as PermissionInput)
    )
  }

  // AND across a list of requirements (mirror of canAny). Equivalent to merging
  // them into one `can` object, but convenient when requirements come from a
  // dynamic array.
  async function canAll(
    requirements: readonly PermissionRequirement<TPermissions>[],
    guardOptions?: GuardOptions
  ) {
    const snapshot = await getSnapshot(guardOptions)
    return requirements.every((requirement) =>
      hasPermissions(snapshot.permissions, requirement as PermissionInput)
    )
  }

  async function requireAny(
    requirements: readonly PermissionRequirement<TPermissions>[],
    guardOptions?: GuardOptions
  ) {
    const snapshot = await guardSnapshot('permission', requirements, guardOptions)
    const allowed = requirements.some((requirement) =>
      hasPermissions(snapshot.permissions, requirement as PermissionInput)
    )

    if (!allowed) {
      notifyDenied({
        userId: snapshot.user.id,
        kind: 'permission',
        code: 'FORBIDDEN',
        required: requirements,
      })
      throw new AccessDeniedError('Missing required permission', 'FORBIDDEN')
    }

    notifyGranted({ userId: snapshot.user.id, kind: 'permission', required: requirements })
  }

  // Returns the resource/action pairs the current user is missing for the given
  // requirement ({} when fully allowed). Use it for precise 403 messages or audit
  // logs where a bare `can` boolean is not enough.
  async function missingPermissions(
    permissions: PermissionRequirement<TPermissions>,
    guardOptions?: GuardOptions
  ): Promise<Permissions> {
    const snapshot = await getSnapshot(guardOptions)
    return getMissingPermissions(snapshot.permissions, permissions as PermissionInput)
  }

  // Filters a list down to the items whose permission requirement the current
  // user satisfies, resolving the snapshot a single time.
  async function filterAllowed<TItem>(
    items: readonly TItem[],
    select: (item: TItem) => PermissionRequirement<TPermissions> | undefined,
    guardOptions?: GuardOptions
  ): Promise<TItem[]> {
    const snapshot = await getSnapshot(guardOptions)
    return filterByPermission(
      snapshot.permissions,
      items,
      (item) => select(item) as PermissionInput | undefined
    )
  }

  // Flat map of the permissions the current user actually has. Thin convenience
  // over getSnapshot().permissions, mirroring listRoles().
  async function listPermissions(guardOptions?: GuardOptions): Promise<Permissions> {
    return (await getSnapshot(guardOptions)).permissions
  }

  // Flags stored role permissions that fall outside the code catalog. Catalog
  // renames (e.g. `order` -> `orders`) silently strand DB roles otherwise; run
  // this in seeds, migrations, or an admin UI to surface the drift. Wildcards
  // are always valid; an empty array means the role is clean.
  function validateRolePermissions(role: { permissions: PermissionInput }): AuthzPermissionIssue[] {
    const catalog = options.permissions as PermissionInput
    const issues: AuthzPermissionIssue[] = []

    for (const [resource, actions] of Object.entries(role.permissions)) {
      if (resource === '*') {
        continue
      }

      const catalogActions = catalog[resource]

      if (!catalogActions) {
        issues.push({ resource, reason: 'unknown-resource' })
        continue
      }

      for (const action of actions) {
        if (action === '*') {
          continue
        }

        if (!catalogActions.includes(action)) {
          issues.push({ resource, action, reason: 'unknown-action' })
        }
      }
    }

    return issues
  }

  // Resolves the snapshot once and returns synchronous checkers bound to it.
  // Ideal inside a server action that runs several conditional Prisma queries:
  // one snapshot fetch, then plain boolean gates with no further awaits.
  async function authorize(guardOptions?: GuardOptions) {
    const snapshot = await getSnapshot(guardOptions)

    const scopedCan = (permissions: PermissionRequirement<TPermissions>) =>
      hasPermissions(snapshot.permissions, permissions as PermissionInput)

    return {
      user: snapshot.user,
      roles: snapshot.roles,
      permissions: snapshot.permissions,
      can: scopedCan,
      canAny: (requirements: readonly PermissionRequirement<TPermissions>[]) =>
        requirements.some(scopedCan),
      canAll: (requirements: readonly PermissionRequirement<TPermissions>[]) =>
        requirements.every(scopedCan),
      hasRole: (roles: string | readonly string[], roleOptions?: { match?: 'all' | 'any' }) =>
        hasMatchingRole(snapshot.roles, Array.isArray(roles) ? roles : [roles], roleOptions?.match),
      missingPermissions: (permissions: PermissionRequirement<TPermissions>) =>
        getMissingPermissions(snapshot.permissions, permissions as PermissionInput),
      when: <TResult, TFallback = undefined>(
        permissions: PermissionRequirement<TPermissions>,
        run: () => TResult,
        fallback?: TFallback
      ): TResult | TFallback => (scopedCan(permissions) ? run() : (fallback as TFallback)),
    }
  }

  async function hasRole(
    roles: string | readonly string[],
    options?: GuardOptions & { match?: 'all' | 'any' }
  ) {
    const snapshot = await getSnapshot(options)
    const requiredRoles = Array.isArray(roles) ? roles : [roles]
    return hasMatchingRole(snapshot.roles, requiredRoles, options?.match)
  }

  // Role parallel of canEach: many keyed role checks against one snapshot.
  async function hasRoleEach<TChecks extends Record<string, string | readonly string[]>>(
    checks: TChecks,
    options?: GuardOptions & { match?: 'all' | 'any' }
  ): Promise<Record<keyof TChecks, boolean>> {
    const snapshot = await getSnapshot(options)
    const result = {} as Record<keyof TChecks, boolean>

    for (const key in checks) {
      const value = checks[key]
      const requiredRoles = Array.isArray(value) ? value : [value as string]
      result[key] = hasMatchingRole(snapshot.roles, requiredRoles, options?.match)
    }

    return result
  }

  async function requireRole(
    roles: string | readonly string[],
    options?: GuardOptions & { match?: 'all' | 'any' }
  ) {
    const snapshot = await guardSnapshot('role', roles, options)
    const requiredRoles = Array.isArray(roles) ? roles : [roles]

    if (!hasMatchingRole(snapshot.roles, requiredRoles, options?.match)) {
      notifyDenied({ userId: snapshot.user.id, kind: 'role', code: 'FORBIDDEN', required: roles })
      throw new AccessDeniedError('Missing required role', 'FORBIDDEN')
    }

    notifyGranted({ userId: snapshot.user.id, kind: 'role', required: roles })
  }

  async function canAccessRoute(
    route: AuthzRoute<Record<string, unknown>, TPermissions>,
    guardOptions?: GuardOptions
  ) {
    const snapshot = await getSnapshot(guardOptions)
    return (
      hasMatchingRole(snapshot.roles, route.roles, route.match) &&
      hasPermissions(snapshot.permissions, route.permissions as PermissionInput | undefined)
    )
  }

  async function requireRoute(
    route: AuthzRoute<Record<string, unknown>, TPermissions>,
    guardOptions?: GuardOptions
  ) {
    const snapshot = await guardSnapshot('route', route, guardOptions)
    const allowed =
      hasMatchingRole(snapshot.roles, route.roles, route.match) &&
      hasPermissions(snapshot.permissions, route.permissions as PermissionInput | undefined)

    if (!allowed) {
      notifyDenied({ userId: snapshot.user.id, kind: 'route', code: 'FORBIDDEN', required: route })
      throw new AccessDeniedError('Missing required route access', 'FORBIDDEN')
    }

    notifyGranted({ userId: snapshot.user.id, kind: 'route', required: route })
  }

  function protect<TArgs extends unknown[], TResult>(
    permissions: PermissionRequirement<TPermissions>,
    handler: (context: AuthzSnapshot<TUser>, ...args: TArgs) => Awaitable<TResult>,
    guardOptions?: GuardOptions
  ) {
    return async (...args: TArgs) => {
      const snapshot = await guardSnapshot('permission', permissions, guardOptions)

      if (!hasPermissions(snapshot.permissions, permissions as PermissionInput)) {
        notifyDenied({
          userId: snapshot.user.id,
          kind: 'permission',
          code: 'FORBIDDEN',
          required: permissions,
        })
        throw new AccessDeniedError('Missing required permission', 'FORBIDDEN')
      }

      notifyGranted({ userId: snapshot.user.id, kind: 'permission', required: permissions })

      return handler(snapshot, ...args)
    }
  }

  function protectRole<TArgs extends unknown[], TResult>(
    roles: string | readonly string[],
    handler: (context: AuthzSnapshot<TUser>, ...args: TArgs) => Awaitable<TResult>,
    options?: GuardOptions & { match?: 'all' | 'any' }
  ) {
    return async (...args: TArgs) => {
      const snapshot = await guardSnapshot('role', roles, options)
      const requiredRoles = Array.isArray(roles) ? roles : [roles]

      if (!hasMatchingRole(snapshot.roles, requiredRoles, options?.match)) {
        notifyDenied({ userId: snapshot.user.id, kind: 'role', code: 'FORBIDDEN', required: roles })
        throw new AccessDeniedError('Missing required role', 'FORBIDDEN')
      }

      notifyGranted({ userId: snapshot.user.id, kind: 'role', required: roles })

      return handler(snapshot, ...args)
    }
  }

  // Route parallel of protect/protectRole/protectAuth: gates a handler on a
  // route created with defineRoutes (its permissions and roles).
  function protectRoute<TArgs extends unknown[], TResult>(
    route: AuthzRoute<Record<string, unknown>, TPermissions>,
    handler: (context: AuthzSnapshot<TUser>, ...args: TArgs) => Awaitable<TResult>,
    guardOptions?: GuardOptions
  ) {
    return async (...args: TArgs) => {
      const snapshot = await guardSnapshot('route', route, guardOptions)
      const allowed =
        hasMatchingRole(snapshot.roles, route.roles, route.match) &&
        hasPermissions(snapshot.permissions, route.permissions as PermissionInput | undefined)

      if (!allowed) {
        notifyDenied({
          userId: snapshot.user.id,
          kind: 'route',
          code: 'FORBIDDEN',
          required: route,
        })
        throw new AccessDeniedError('Missing required route access', 'FORBIDDEN')
      }

      notifyGranted({ userId: snapshot.user.id, kind: 'route', required: route })

      return handler(snapshot, ...args)
    }
  }

  function protectAuth<TArgs extends unknown[], TResult>(
    handler: (context: AuthzSnapshot<TUser>, ...args: TArgs) => Awaitable<TResult>,
    guardOptions?: GuardOptions
  ) {
    return async (...args: TArgs) => {
      await requireSession()
      return handler(await getSnapshot(guardOptions), ...args)
    }
  }

  async function listRoles() {
    return options.adapter.listRoles()
  }

  async function findRoleByName(name: string) {
    return (await listRoles()).find((role) => role.name === name) ?? null
  }

  async function createRole(input: {
    name: string
    label?: string | null
    description?: string | null
    permissions: PermissionRequirement<TPermissions>
  }): Promise<AuthzRoleResult> {
    try {
      const existingRole = await findRoleByName(input.name)

      if (existingRole) {
        return roleResult({
          success: false,
          code: 'ROLE_ALREADY_EXISTS',
          message: `Role "${input.name}" already exists.`,
          role: existingRole,
        })
      }

      const role = await options.adapter.createRole({
        ...input,
        permissions: input.permissions as PermissionInput,
      })

      return roleResult({
        success: true,
        message: `Role "${role.name}" created.`,
        role,
      })
    } catch (error) {
      if (isUniqueConstraintError(error, 'name')) {
        const existingRole = await findRoleByName(input.name).catch(() => null)

        return roleResult({
          success: false,
          code: 'ROLE_ALREADY_EXISTS',
          message: `Role "${input.name}" already exists.`,
          role: existingRole,
        })
      }

      console.error(`Could not create role "${input.name}":`, error)

      return roleResult({
        success: false,
        code: 'ROLE_CREATE_FAILED',
        message: `Could not create role "${input.name}".`,
      })
    }
  }

  async function updateRole(
    roleId: string,
    input: {
      name?: string
      label?: string | null
      description?: string | null
      permissions?: PermissionRequirement<TPermissions>
    }
  ): Promise<AuthzRoleResult> {
    let role: AuthzRole

    try {
      role = await options.adapter.updateRole(roleId, {
        ...input,
        permissions: input.permissions as PermissionInput | undefined,
      })
    } catch (error) {
      if (input.name && isUniqueConstraintError(error, 'name')) {
        return roleResult({
          success: false,
          code: 'ROLE_ALREADY_EXISTS',
          message: `Role name "${input.name}" is already in use.`,
        })
      }

      if (isRecordNotFoundError(error)) {
        return roleResult({
          success: false,
          code: 'ROLE_NOT_FOUND',
          message: `Role "${roleId}" was not found.`,
        })
      }

      console.error(`Could not update role "${roleId}":`, error)

      return roleResult({
        success: false,
        code: 'ROLE_UPDATE_FAILED',
        message: `Could not update role "${roleId}".`,
      })
    }

    try {
      await invalidateRole(roleId)
    } catch (error) {
      console.warn(
        `Role "${roleId}" updated, but cache invalidation failed: ${getErrorMessage(error)}`
      )

      return roleResult({
        success: false,
        code: 'CACHE_INVALIDATION_FAILED',
        message: `Role "${role.name}" updated, but cached snapshots could not be invalidated.`,
        role,
      })
    }

    return roleResult({
      success: true,
      message: `Role "${role.name}" updated.`,
      role,
    })
  }

  async function deleteRole(roleId: string): Promise<AuthzMutationResult> {
    let userIds: string[] | null

    try {
      userIds = options.adapter.listUserIdsByRole
        ? [...(await options.adapter.listUserIdsByRole(roleId))]
        : null

      await options.adapter.deleteRole(roleId)
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return mutationResult({
          success: false,
          code: 'ROLE_NOT_FOUND',
          message: `Role "${roleId}" was not found.`,
        })
      }

      console.error(`Could not delete role "${roleId}":`, error)

      return mutationResult({
        success: false,
        code: 'ROLE_DELETE_FAILED',
        message: `Could not delete role "${roleId}".`,
      })
    }

    try {
      if (userIds) {
        await invalidateUsers(userIds)
      } else {
        await invalidateRole(roleId)
      }
    } catch (error) {
      console.warn(
        `Role "${roleId}" deleted, but cache invalidation failed: ${getErrorMessage(error)}`
      )

      return mutationResult({
        success: false,
        code: 'CACHE_INVALIDATION_FAILED',
        message: `Role "${roleId}" deleted, but cached snapshots could not be invalidated.`,
      })
    }

    return mutationResult({
      success: true,
      message: `Role "${roleId}" deleted.`,
    })
  }

  async function finishUserRoleMutation(
    userId: string,
    successMessage: string
  ): Promise<AuthzMutationResult> {
    try {
      await invalidateUser(userId)
      return mutationResult({
        success: true,
        message: successMessage,
      })
    } catch (error) {
      console.warn(
        `Role changed for user "${userId}", but cached snapshot could not be invalidated:`,
        error
      )

      return mutationResult({
        success: false,
        code: 'CACHE_INVALIDATION_FAILED',
        message: `Role changed, but cached snapshot for user "${userId}" could not be invalidated.`,
      })
    }
  }

  async function assignRole(input: { userId: string; roleId: string }) {
    try {
      await options.adapter.assignRole(input)
      return finishUserRoleMutation(input.userId, `Role "${input.roleId}" assigned.`)
    } catch (error) {
      if (isAssignmentConflictError(error)) {
        await invalidateUser(input.userId).catch(() => undefined)

        return mutationResult({
          success: false,
          code: 'ROLE_ASSIGNMENT_ALREADY_EXISTS',
          message: `Role "${input.roleId}" is already assigned to user "${input.userId}".`,
        })
      }

      console.error(`Could not assign role "${input.roleId}" to user "${input.userId}":`, error)

      return mutationResult({
        success: false,
        code: 'ROLE_ASSIGNMENT_FAILED',
        message: `Could not assign role "${input.roleId}" to user "${input.userId}".`,
      })
    }
  }

  async function removeRole(input: {
    userId: string
    roleId: string
  }): Promise<AuthzMutationResult> {
    await options.adapter.removeRole(input)
    return finishUserRoleMutation(input.userId, `Role "${input.roleId}" removed.`)
  }

  return {
    getSession,
    requireAuth: requireSession,
    getSnapshot,
    authorize,
    invalidateUser,
    invalidateUsers,
    invalidateRole,
    can,
    canEach,
    canAny,
    canAll,
    when,
    missingPermissions,
    filterByPermission: filterAllowed,
    listPermissions,
    require: requirePermission,
    requirePermission,
    requireAny,
    hasRole,
    hasRoleEach,
    requireRole,
    canAccessRoute,
    requireRoute,
    protect,
    protectPermission: protect,
    protectRole,
    protectRoute,
    protectAuth,
    validateRolePermissions,
    listRoles,
    createRole,
    updateRole,
    deleteRole,
    assignRole,
    removeRole,
  }
}

export type Authz<
  TUser extends AuthzUser = AuthzUser,
  TPermissions extends PermissionInput = PermissionInput,
> = ReturnType<typeof createAuthz<TUser, TPermissions>>
