import { describe, expect, it, vi } from 'vitest'
import { AccessDeniedError, createAuthz } from './server.js'
import { definePermissions, memoryCache, type AuthzAdapter, type AuthzRole } from './index.js'

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

    await authz.updateRole('role-orders-manager', {
      permissions: { order: ['read'] },
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
    await authz.deleteRole('role-admin')

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
})
