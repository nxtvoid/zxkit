import type {
  AuthzAdapter,
  AuthzCache,
  AuthzMutationResult,
  AuthzRole,
  AuthzRoleResult,
  AuthzRoute,
  AuthzSession,
  AuthzSnapshot,
  AuthzUser,
  Awaitable,
  PermissionInput,
  PermissionRequirement,
} from '../core/types'
import { hasPermissions } from '../core/permissions'
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

  const cache = options.cache === false ? createNoopCache() : (options.cache ?? createNoopCache())
  const cacheSetOptions = options.cacheTtl ? { ttl: options.cacheTtl } : undefined

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

  async function getSnapshot(snapshotOptions?: GuardOptions): Promise<AuthzSnapshot<TUser>> {
    const session = await requireAuth()
    const key = createSnapshotKey(session.user.id)

    if (!snapshotOptions?.bypassCache) {
      const cached = await cache.get<AuthzSnapshot<TUser>>(key)

      if (cached) {
        return cached
      }
    }

    const roles = await options.adapter.getUserRoles({
      userId: session.user.id,
      user: session.user,
    })
    const snapshot = createSnapshot(session.user, roles)
    await cache.set(key, snapshot, cacheSetOptions)

    return snapshot
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
    }
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
    if (!(await can(permissions, guardOptions))) {
      throw new AccessDeniedError('Missing required permission', 'FORBIDDEN')
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

  async function requireRole(
    roles: string | readonly string[],
    options?: GuardOptions & { match?: 'all' | 'any' }
  ) {
    if (!(await hasRole(roles, options))) {
      throw new AccessDeniedError('Missing required role', 'FORBIDDEN')
    }
  }

  async function canAccessRoute(
    route: AuthzRoute<Record<string, unknown>, TPermissions>,
    guardOptions?: GuardOptions
  ) {
    const snapshot = await getSnapshot(guardOptions)
    return (
      hasMatchingRole(snapshot.roles, route.roles) &&
      hasPermissions(snapshot.permissions, route.permissions as PermissionInput | undefined)
    )
  }

  async function requireRoute(
    route: AuthzRoute<Record<string, unknown>, TPermissions>,
    guardOptions?: GuardOptions
  ) {
    if (!(await canAccessRoute(route, guardOptions))) {
      throw new AccessDeniedError('Missing required route access', 'FORBIDDEN')
    }
  }

  function protect<TArgs extends unknown[], TResult>(
    permissions: PermissionRequirement<TPermissions>,
    handler: (context: AuthzSnapshot<TUser>, ...args: TArgs) => Awaitable<TResult>,
    guardOptions?: GuardOptions
  ) {
    return async (...args: TArgs) => {
      const snapshot = await getSnapshot(guardOptions)

      if (!hasPermissions(snapshot.permissions, permissions as PermissionInput)) {
        throw new AccessDeniedError('Missing required permission', 'FORBIDDEN')
      }

      return handler(snapshot, ...args)
    }
  }

  function protectRole<TArgs extends unknown[], TResult>(
    roles: string | readonly string[],
    handler: (context: AuthzSnapshot<TUser>, ...args: TArgs) => Awaitable<TResult>,
    options?: GuardOptions & { match?: 'all' | 'any' }
  ) {
    return async (...args: TArgs) => {
      const snapshot = await getSnapshot(options)
      const requiredRoles = Array.isArray(roles) ? roles : [roles]

      if (!hasMatchingRole(snapshot.roles, requiredRoles, options?.match)) {
        throw new AccessDeniedError('Missing required role', 'FORBIDDEN')
      }

      return handler(snapshot, ...args)
    }
  }

  function protectAuth<TArgs extends unknown[], TResult>(
    handler: (context: AuthzSnapshot<TUser>, ...args: TArgs) => Awaitable<TResult>,
    guardOptions?: GuardOptions
  ) {
    return async (...args: TArgs) => handler(await getSnapshot(guardOptions), ...args)
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

      return roleResult({
        success: false,
        code: 'ROLE_CREATE_FAILED',
        message: `Could not create role "${input.name}": ${getErrorMessage(error)}`,
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
  ) {
    const role = await options.adapter.updateRole(roleId, {
      ...input,
      permissions: input.permissions as PermissionInput | undefined,
    })
    await invalidateRole(roleId)
    return role
  }

  async function deleteRole(roleId: string) {
    const userIds = options.adapter.listUserIdsByRole
      ? await options.adapter.listUserIdsByRole(roleId)
      : null

    await options.adapter.deleteRole(roleId)

    if (userIds) {
      await invalidateUsers(userIds)
      return
    }

    await invalidateRole(roleId)
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
      return mutationResult({
        success: false,
        code: 'CACHE_INVALIDATION_FAILED',
        message: `Role changed, but cached snapshot for user "${userId}" could not be invalidated: ${getErrorMessage(error)}`,
      })
    }
  }

  async function assignRole(input: { userId: string; roleId: string }) {
    try {
      await options.adapter.assignRole(input)
      return finishUserRoleMutation(input.userId, `Role "${input.roleId}" assigned.`)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        await invalidateUser(input.userId).catch(() => undefined)

        return mutationResult({
          success: false,
          code: 'ROLE_ASSIGNMENT_ALREADY_EXISTS',
          message: `Role "${input.roleId}" is already assigned to user "${input.userId}".`,
        })
      }

      return mutationResult({
        success: false,
        code: 'ROLE_ASSIGNMENT_FAILED',
        message: `Could not assign role "${input.roleId}" to user "${input.userId}": ${getErrorMessage(error)}`,
      })
    }
  }

  async function removeRole(input: { userId: string; roleId: string }) {
    await options.adapter.removeRole(input)
    await invalidateUser(input.userId)
  }

  return {
    getSession,
    requireAuth,
    getSnapshot,
    invalidateUser,
    invalidateUsers,
    invalidateRole,
    can,
    require: requirePermission,
    requirePermission,
    hasRole,
    requireRole,
    canAccessRoute,
    requireRoute,
    protect,
    protectPermission: protect,
    protectRole,
    protectAuth,
    listRoles,
    createRole,
    updateRole,
    deleteRole,
    assignRole,
    removeRole,
  }
}
