import { describe, expect, it, vi } from 'vitest'
import { AccessDeniedError, createAuthz } from './server.js'
import {
  definePermissions,
  defineRoutes,
  memoryCache,
  type AuthzAdapter,
  type AuthzCache,
  type AuthzRole,
} from './index.js'

const permissionCatalog = definePermissions({
  order: ['read', 'create', 'update', 'delete'],
  invoice: ['read', 'export'],
  settings: ['manage'],
})

const roles: AuthzRole[] = [
  {
    id: 'role-orders-manager',
    name: 'orders_manager',
    permissions: {
      order: ['read', 'delete'],
    },
  },
  {
    id: 'role-invoices-viewer',
    name: 'invoices_viewer',
    permissions: {
      invoice: ['read'],
    },
  },
]

function createAdapter(): AuthzAdapter {
  return {
    getUserRoles: vi.fn(async () => roles),
    listRoles: vi.fn(async () => roles),
    createRole: vi.fn(async (input) => ({
      id: `role-${input.name}`,
      ...input,
    })),
    updateRole: vi.fn(async (roleId, input) => ({
      id: roleId,
      name: input.name ?? 'updated',
      permissions: input.permissions ?? {},
    })),
    deleteRole: vi.fn(async () => {}),
    assignRole: vi.fn(async () => {}),
    removeRole: vi.fn(async () => {}),
    listUserIdsByRole: vi.fn(async () => ['user-1']),
  }
}

describe('createAuthz', () => {
  it('creates a permission snapshot from adapter roles', async () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1', name: 'Ada' } }),
      adapter: createAdapter(),
    })

    await expect(authz.can({ order: ['delete'] })).resolves.toBe(true)
    await expect(authz.can({ settings: ['manage'] })).resolves.toBe(false)
    await expect(authz.hasRole('orders_manager')).resolves.toBe(true)
  })

  it('checks many permissions at once with canEach', async () => {
    const adapter = createAdapter()
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
      cache: memoryCache({ ttl: 60 }),
    })

    await expect(
      authz.canEach({
        canReadOrders: { order: ['read'] },
        canDeleteOrders: { order: ['delete'] },
        canExportInvoices: { invoice: ['export'] },
        canManageSettings: { settings: ['manage'] },
      })
    ).resolves.toEqual({
      canReadOrders: true,
      canDeleteOrders: true,
      canExportInvoices: false,
      canManageSettings: false,
    })

    // One snapshot resolves all four checks.
    expect(adapter.getUserRoles).toHaveBeenCalledTimes(1)
  })

  it('passes canAny when any single requirement matches', async () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter: createAdapter(),
    })

    // Has order:delete but not settings:manage -> OR passes.
    await expect(authz.canAny([{ settings: ['manage'] }, { order: ['delete'] }])).resolves.toBe(
      true
    )
    // Neither held -> OR fails.
    await expect(authz.canAny([{ settings: ['manage'] }, { invoice: ['export'] }])).resolves.toBe(
      false
    )
    // requireAny throws when none match.
    await expect(authz.requireAny([{ settings: ['manage'] }])).rejects.toBeInstanceOf(
      AccessDeniedError
    )
    await expect(authz.requireAny([{ order: ['read'] }])).resolves.toBeUndefined()
  })

  it('reports missing permissions, batches roles, and filters lists', async () => {
    const adapter = createAdapter()
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
      cache: memoryCache({ ttl: 60 }),
    })

    // order:read,delete granted; create missing.
    await expect(authz.missingPermissions({ order: ['read', 'create'] })).resolves.toEqual({
      order: ['create'],
    })
    await expect(authz.missingPermissions({ order: ['delete'] })).resolves.toEqual({})

    await expect(
      authz.hasRoleEach({
        orders: 'orders_manager',
        invoices: 'invoices_viewer',
        admin: 'admin',
      })
    ).resolves.toEqual({ orders: true, invoices: true, admin: false })

    const items = [
      { id: 'a', need: { order: ['delete'] as const } },
      { id: 'b', need: { settings: ['manage'] as const } },
    ]
    await expect(authz.filterByPermission(items, (item) => item.need)).resolves.toEqual([
      { id: 'a', need: { order: ['delete'] } },
    ])

    // All four reads resolved from a single snapshot.
    expect(adapter.getUserRoles).toHaveBeenCalledTimes(1)
  })

  it('runs scoped checks, conditional queries, and route guards', async () => {
    const adapter = createAdapter()
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
      cache: memoryCache({ ttl: 60 }),
    })

    const routes = defineRoutes({
      orders: { path: '/orders', label: 'Orders', permissions: { order: ['read'] } },
      settings: { path: '/settings', label: 'Settings', permissions: { settings: ['manage'] } },
    })

    // authorize(): one snapshot, synchronous gates.
    const auth = await authz.authorize()
    expect(auth.can({ order: ['delete'] })).toBe(true)
    expect(auth.can({ settings: ['manage'] })).toBe(false)
    expect(auth.canAll([{ order: ['read'] }, { invoice: ['read'] }])).toBe(true)
    expect(auth.canAny([{ settings: ['manage'] }, { order: ['read'] }])).toBe(true)
    expect(auth.when({ order: ['read'] }, () => 'ran', 'skipped')).toBe('ran')
    expect(auth.when({ settings: ['manage'] }, () => 'ran', 'skipped')).toBe('skipped')

    // canAll / when at the top level.
    await expect(authz.canAll([{ order: ['read'] }, { settings: ['manage'] }])).resolves.toBe(false)
    await expect(authz.when({ order: ['read'] }, () => 'query', 'fallback')).resolves.toBe('query')
    await expect(authz.when({ settings: ['manage'] }, () => 'query', 'fallback')).resolves.toBe(
      'fallback'
    )

    await expect(authz.listPermissions()).resolves.toEqual({
      order: ['read', 'delete'],
      invoice: ['read'],
    })

    // protectRoute: passes on allowed route, throws on denied.
    const loadOrders = authz.protectRoute(routes.orders, async ({ user }) => user.id)
    const loadSettings = authz.protectRoute(routes.settings, async ({ user }) => user.id)
    await expect(loadOrders()).resolves.toBe('user-1')
    await expect(loadSettings()).rejects.toBeInstanceOf(AccessDeniedError)

    // Every check above shared one snapshot.
    expect(adapter.getUserRoles).toHaveBeenCalledTimes(1)
  })

  it('flags stored role permissions outside the catalog', () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter: createAdapter(),
    })

    expect(authz.validateRolePermissions({ permissions: { order: ['read', 'destroy'] } })).toEqual([
      { resource: 'order', action: 'destroy', reason: 'unknown-action' },
    ])
    expect(authz.validateRolePermissions({ permissions: { ticket: ['read'] } })).toEqual([
      { resource: 'ticket', reason: 'unknown-resource' },
    ])
    expect(authz.validateRolePermissions({ permissions: { '*': ['*'], order: ['read'] } })).toEqual(
      []
    )
  })

  it('fires audit hooks on guard grants and denials', async () => {
    const onDenied = vi.fn()
    const onGranted = vi.fn()
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter: createAdapter(),
      onDenied,
      onGranted,
    })

    await authz.require({ order: ['delete'] })
    expect(onGranted).toHaveBeenCalledWith({
      userId: 'user-1',
      kind: 'permission',
      required: { order: ['delete'] },
    })

    await expect(authz.require({ settings: ['manage'] })).rejects.toBeInstanceOf(AccessDeniedError)
    expect(onDenied).toHaveBeenCalledWith({
      userId: 'user-1',
      kind: 'permission',
      code: 'FORBIDDEN',
      required: { settings: ['manage'] },
    })

    // Non-throwing checks stay silent.
    onGranted.mockClear()
    await authz.can({ order: ['read'] })
    expect(onGranted).not.toHaveBeenCalled()
  })

  it('emits an unauthorized audit event when no session', async () => {
    const onDenied = vi.fn()
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => null,
      adapter: createAdapter(),
      onDenied,
    })

    await expect(authz.requireAuth()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(onDenied).toHaveBeenCalledWith({ kind: 'auth', code: 'UNAUTHORIZED' })
  })

  it('protects handlers with permissions and roles', async () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter: createAdapter(),
    })

    const deleteOrder = authz.protect({ order: ['delete'] }, async ({ user }) => user.id)
    const readSettings = authz.protect({ settings: ['manage'] }, async ({ user }) => user.id)
    // @ts-expect-error settings only supports manage.
    authz.protect({ settings: ['delete'] }, async ({ user }) => user.id)
    // @ts-expect-error customer is not in the permission catalog.
    authz.can({ customer: ['read'] })
    const viewAdmin = authz.protectRole('admin', async ({ user }) => user.id)

    await expect(deleteOrder()).resolves.toBe('user-1')
    await expect(readSettings()).rejects.toBeInstanceOf(AccessDeniedError)
    await expect(viewAdmin()).rejects.toBeInstanceOf(AccessDeniedError)
  })

  it('returns controlled results when creating roles', async () => {
    const adapter = createAdapter()
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })

    await expect(
      authz.createRole({
        name: 'settings_manager',
        label: 'Settings manager',
        permissions: { settings: ['manage'] },
      })
    ).resolves.toMatchObject({
      success: true,
      message: 'Role "settings_manager" created.',
      role: {
        id: 'role-settings_manager',
        name: 'settings_manager',
      },
    })

    await expect(
      authz.createRole({
        name: 'orders_manager',
        permissions: { order: ['read'] },
      })
    ).resolves.toMatchObject({
      success: false,
      code: 'ROLE_ALREADY_EXISTS',
      message: 'Role "orders_manager" already exists.',
      role: {
        id: 'role-orders-manager',
      },
    })
  })

  it('uses cache and invalidates affected users on mutations', async () => {
    const adapter = createAdapter()
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
      cache: memoryCache({ ttl: 60 }),
    })

    await authz.getSnapshot()
    await authz.getSnapshot()

    expect(adapter.getUserRoles).toHaveBeenCalledTimes(1)

    await expect(
      authz.assignRole({ userId: 'user-1', roleId: 'role-invoices-viewer' })
    ).resolves.toMatchObject({
      success: true,
    })
    await authz.getSnapshot()

    expect(adapter.assignRole).toHaveBeenCalledWith({
      userId: 'user-1',
      roleId: 'role-invoices-viewer',
    })
    expect(adapter.getUserRoles).toHaveBeenCalledTimes(2)

    await expect(
      authz.updateRole('role-orders-manager', {
        permissions: { order: ['read'] },
      })
    ).resolves.toMatchObject({
      success: true,
      role: { id: 'role-orders-manager' },
    })

    expect(adapter.listUserIdsByRole).toHaveBeenCalledWith('role-orders-manager')
  })

  it('invalidates user cache when assigning roles with a shared cache adapter', async () => {
    const adapter = createAdapter()
    const cache = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
    }
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
      cache,
    })

    await expect(
      authz.assignRole({ userId: 'user-2', roleId: 'role-orders-manager' })
    ).resolves.toMatchObject({
      success: true,
      message: 'Role "role-orders-manager" assigned.',
    })

    expect(cache.delete).toHaveBeenCalledWith('authz:user:user-2:snapshot')
  })

  it('lets cache adapters use their own ttl unless cacheTtl is explicit', async () => {
    const adapter = createAdapter()
    const cache = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
    }
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
      cache,
    })

    await authz.getSnapshot()

    expect(cache.set).toHaveBeenCalledWith(
      'authz:user:user-1:snapshot',
      expect.any(Object),
      undefined
    )
  })

  it('passes cacheTtl to cache adapters when explicitly configured', async () => {
    const adapter = createAdapter()
    const cache = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
    }
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
      cache,
      cacheTtl: 1800,
    })

    await authz.getSnapshot()

    expect(cache.set).toHaveBeenCalledWith('authz:user:user-1:snapshot', expect.any(Object), {
      ttl: 1800,
    })
  })

  it('handles duplicate role assignments without leaking adapter errors', async () => {
    const adapter = createAdapter()
    adapter.assignRole = vi.fn(async () => {
      throw Object.assign(
        new Error('Unique constraint failed on the fields: (`userId`,`roleId`)'),
        {
          code: 'P2002',
          meta: { target: ['userId', 'roleId'] },
        }
      )
    })
    const cache = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
    }
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
      cache,
    })

    await expect(
      authz.assignRole({ userId: 'user-1', roleId: 'role-orders-manager' })
    ).resolves.toMatchObject({
      success: false,
      code: 'ROLE_ASSIGNMENT_ALREADY_EXISTS',
      message: 'Role "role-orders-manager" is already assigned to user "user-1".',
    })
    expect(cache.delete).toHaveBeenCalledWith('authz:user:user-1:snapshot')
  })

  it('treats hung cache operations as a miss when cacheTimeoutMs is set', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const adapter = createAdapter()
    const never = new Promise<never>(() => {})
    const cache = {
      get: vi.fn(() => never),
      set: vi.fn(() => never),
      delete: vi.fn(() => never),
    }
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
      cache,
      cacheTimeoutMs: 10,
    })

    await expect(authz.getSnapshot()).resolves.toMatchObject({
      user: { id: 'user-1' },
    })
    expect(consoleError).toHaveBeenCalled()

    await expect(
      authz.assignRole({ userId: 'user-1', roleId: 'role-orders-manager' })
    ).resolves.toMatchObject({
      success: false,
      code: 'CACHE_INVALIDATION_FAILED',
    })

    consoleError.mockRestore()
  })

  it('keeps resolving snapshots when the cache backend is down', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const adapter = createAdapter()
    const cache = {
      get: vi.fn(async () => {
        throw new Error('redis unreachable')
      }),
      set: vi.fn(async () => {
        throw new Error('redis unreachable')
      }),
      delete: vi.fn(async () => {
        throw new Error('redis unreachable')
      }),
    }
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
      cache,
    })

    // Reads and writes degrade to a cache miss: guards keep working.
    await expect(authz.getSnapshot()).resolves.toMatchObject({
      user: { id: 'user-1' },
    })
    await expect(authz.can({ order: ['read'] })).resolves.toBe(true)
    expect(consoleError).toHaveBeenCalled()

    // Invalidation failures still surface instead of being swallowed.
    await expect(
      authz.assignRole({ userId: 'user-1', roleId: 'role-orders-manager' })
    ).resolves.toMatchObject({
      success: false,
      code: 'CACHE_INVALIDATION_FAILED',
    })

    consoleError.mockRestore()
  })

  it('reports missing roles on update and delete without throwing', async () => {
    const adapter = createAdapter()
    const notFound = () => {
      throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' })
    }
    adapter.updateRole = vi.fn(notFound)
    adapter.deleteRole = vi.fn(notFound)
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })

    await expect(authz.updateRole('missing-role', { name: 'renamed' })).resolves.toMatchObject({
      success: false,
      code: 'ROLE_NOT_FOUND',
      role: null,
    })
    await expect(authz.deleteRole('missing-role')).resolves.toMatchObject({
      success: false,
      code: 'ROLE_NOT_FOUND',
    })
  })

  it('reports role renames that collide with an existing role name', async () => {
    const adapter = createAdapter()
    adapter.updateRole = vi.fn(async () => {
      throw Object.assign(new Error('Unique constraint failed on the fields: (`name`)'), {
        code: 'P2002',
        meta: { target: ['name'] },
      })
    })
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })

    await expect(authz.updateRole('role-orders-manager', { name: 'admin' })).resolves.toMatchObject(
      {
        success: false,
        code: 'ROLE_ALREADY_EXISTS',
      }
    )
  })

  it('does not report unrelated unique violations as duplicate assignments', async () => {
    const adapter = createAdapter()
    adapter.assignRole = vi.fn(async () => {
      throw Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), {
        code: 'P2002',
        meta: { target: ['email'] },
      })
    })
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })

    await expect(
      authz.assignRole({ userId: 'user-1', roleId: 'role-orders-manager' })
    ).resolves.toMatchObject({
      success: false,
      code: 'ROLE_ASSIGNMENT_FAILED',
    })
  })

  it('invalidates cached users when deleting a role with cascading assignments', async () => {
    const storedRoles = new Map<string, AuthzRole>([
      [
        'role-admin',
        {
          id: 'role-admin',
          name: 'admin',
          permissions: {
            settings: ['manage'],
          },
        },
      ],
    ])
    const assignments = new Map<string, Set<string>>([['role-admin', new Set(['user-1'])]])
    const adapter: AuthzAdapter = {
      getUserRoles: vi.fn(async ({ userId }) =>
        [...assignments.entries()].flatMap(([roleId, userIds]) => {
          const role = storedRoles.get(roleId)
          return role && userIds.has(userId) ? [role] : []
        })
      ),
      listRoles: vi.fn(async () => [...storedRoles.values()]),
      createRole: vi.fn(async (input) => ({
        id: `role-${input.name}`,
        ...input,
      })),
      updateRole: vi.fn(async (roleId, input) => ({
        id: roleId,
        name: input.name ?? 'updated',
        permissions: input.permissions ?? {},
      })),
      deleteRole: vi.fn(async (roleId) => {
        storedRoles.delete(roleId)
        assignments.delete(roleId)
      }),
      assignRole: vi.fn(async ({ userId, roleId }) => {
        const roleAssignments = assignments.get(roleId) ?? new Set<string>()
        roleAssignments.add(userId)
        assignments.set(roleId, roleAssignments)
      }),
      removeRole: vi.fn(async ({ userId, roleId }) => {
        assignments.get(roleId)?.delete(userId)
      }),
      listUserIdsByRole: vi.fn(async (roleId) => [...(assignments.get(roleId) ?? [])]),
    }
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
      cache: memoryCache({ ttl: 60 }),
    })

    await expect(authz.hasRole('admin')).resolves.toBe(true)
    await expect(authz.deleteRole('role-admin')).resolves.toMatchObject({
      success: true,
      message: 'Role "role-admin" deleted.',
    })

    await expect(authz.hasRole('admin')).resolves.toBe(false)
    expect(adapter.getUserRoles).toHaveBeenCalledTimes(2)
  })

  it('can bypass cache for fresh permission checks', async () => {
    const adapter = createAdapter()
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
      cache: memoryCache({ ttl: 60 }),
    })

    await authz.getSnapshot()
    await authz.getSnapshot({ bypassCache: true })

    expect(adapter.getUserRoles).toHaveBeenCalledTimes(2)
  })

  it('clears the snapshot namespace when role users cannot be listed', async () => {
    const adapter = createAdapter()
    delete adapter.listUserIdsByRole
    const cache = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      clearNamespace: vi.fn(async () => {}),
    }
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
      cache,
    })

    await authz.updateRole('role-orders-manager', {
      permissions: { order: ['read'] },
    })

    expect(cache.clearNamespace).toHaveBeenCalledWith('authz:user:')
  })

  it('throws unauthorized when session is missing', async () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => null,
      adapter: createAdapter(),
    })

    await expect(authz.requireAuth()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('does not read cached snapshots when the session is missing', async () => {
    const cachedSnapshot = {
      user: { id: 'user-1' },
      roles: ['admin'],
      permissions: { '*': ['*'] },
    }
    const get = vi.fn()
    const set = vi.fn()
    const cache: AuthzCache = {
      async get<T>(key: string) {
        get(key)
        return cachedSnapshot as T
      },
      async set<T>(key: string, value: T, options?: { ttl?: number }) {
        set(key, value, options)
      },
      delete: vi.fn(async () => {}),
    }
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => null,
      adapter: createAdapter(),
      cache,
    })

    await expect(authz.getSnapshot()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })

    expect(get).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })
})
