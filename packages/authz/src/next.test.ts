import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { createAuthz } from './server.js'
import { createAuthzProxy, matchesPathname } from './next.js'
import { definePermissions, type AuthzAdapter } from './index.js'

const permissionCatalog = definePermissions({
  order: ['read', 'create', 'update', 'delete'],
  settings: ['manage'],
})

const adapter: AuthzAdapter = {
  getUserRoles: async () => [
    {
      id: 'role-orders-manager',
      name: 'orders_manager',
      permissions: { order: ['read'] },
    },
  ],
  listRoles: async () => [],
  createRole: async (input) => ({ id: input.name, ...input }),
  updateRole: async (roleId, input) => ({
    id: roleId,
    name: input.name ?? roleId,
    permissions: input.permissions ?? {},
  }),
  deleteRole: async () => {},
  assignRole: async () => {},
  removeRole: async () => {},
}

describe('matchesPathname', () => {
  it('matches dynamic path patterns', () => {
    expect(matchesPathname('/orders/:path*', '/orders/1/edit')).toBe(true)
    expect(matchesPathname('/orders/:id', '/orders/1')).toBe(true)
    expect(matchesPathname('/orders/:id', '/settings/1')).toBe(false)
  })
})

describe('createAuthzProxy', () => {
  it('allows matching routes when the user has permission', async () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })
    const proxy = createAuthzProxy({
      authz,
      rules: [{ matcher: '/orders/:path*', permissions: { order: ['read'] } }],
    })

    const response = await proxy(new NextRequest('https://example.com/orders'))

    expect(response.status).toBe(200)
  })

  it('supports route objects in proxy rules', async () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })
    const proxy = createAuthzProxy({
      authz,
      rules: [
        {
          matcher: '/orders/:path*',
          route: {
            path: '/orders',
            permissions: { order: ['read'] },
          },
        },
      ],
    })

    const response = await proxy(new NextRequest('https://example.com/orders/1'))

    expect(response.status).toBe(200)
  })

  it('rethrows unexpected errors', async () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => {
        throw new Error('database unavailable')
      },
      adapter,
    })
    const proxy = createAuthzProxy({
      authz,
      rules: [{ matcher: '/orders/:path*', permissions: { order: ['read'] } }],
    })

    await expect(proxy(new NextRequest('https://example.com/orders'))).rejects.toThrow(
      'database unavailable'
    )
  })

  it('redirects unauthorized users to sign in', async () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => null,
      adapter,
    })
    const proxy = createAuthzProxy({
      authz,
      signInPath: '/login',
      rules: [{ matcher: '/orders/:path*', permissions: { order: ['read'] } }],
    })

    const response = await proxy(new NextRequest('https://example.com/orders'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://example.com/login')
  })

  it('redirects forbidden users to the forbidden path', async () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })
    const proxy = createAuthzProxy({
      authz,
      forbiddenPath: '/forbidden',
      rules: [{ matcher: '/settings/:path*', permissions: { settings: ['manage'] } }],
    })

    const response = await proxy(new NextRequest('https://example.com/settings'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://example.com/forbidden')
  })

  it('requires all proxy roles by default', async () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })
    const proxy = createAuthzProxy({
      authz,
      forbiddenPath: '/forbidden',
      rules: [{ matcher: '/admin', roles: ['orders_manager', 'billing_admin'] }],
    })

    const response = await proxy(new NextRequest('https://example.com/admin'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://example.com/forbidden')
  })

  it('allows proxy rules to opt into any-role matching', async () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })
    const proxy = createAuthzProxy({
      authz,
      rules: [
        {
          matcher: '/admin',
          roles: ['orders_manager', 'billing_admin'],
          match: 'any',
        },
      ],
    })

    const response = await proxy(new NextRequest('https://example.com/admin'))

    expect(response.status).toBe(200)
  })
})
