import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { createAuthz } from './server.js'
import { AuthzProxyConfigError, createAuthzProxy, matchesPathname } from './next.js'
import { definePermissions, defineRoutes, type AuthzAdapter } from './index.js'

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

const routes = defineRoutes({
  hub: {
    path: '/hub',
    label: 'Home',
  },
  orders: {
    path: '/hub/orders',
    label: 'Orders',
    permissions: { order: ['read'] },
  },
  settings: {
    path: '/hub/settings',
    label: 'Settings',
    permissions: { settings: ['manage'] },
  },
  account: {
    path: '/hub/account',
    label: 'Account',
  },
  menu: {
    path: '/hub/menu',
    label: 'Menu',
    permissions: { settings: ['manage'] },
  },
  menuCategories: {
    path: '/hub/menu/categories',
    label: 'Menu categories',
    permissions: { order: ['read'] },
  },
})

describe('matchesPathname', () => {
  it('matches dynamic path patterns', () => {
    expect(matchesPathname('/orders/:path*', '/orders/1/edit')).toBe(true)
    expect(matchesPathname('/orders/:id', '/orders/1')).toBe(true)
    expect(matchesPathname('/orders/:id', '/settings/1')).toBe(false)
  })

  it('treats a literal "*" inside a segment as a literal character', () => {
    expect(matchesPathname('/foo*', '/foo*')).toBe(true)
    expect(matchesPathname('/foo*', '/fo')).toBe(false)
    expect(matchesPathname('/foo*', '/foooo')).toBe(false)
  })
})

describe('createAuthzProxy', () => {
  it('uses only the declarative protected-zone API', async () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })
    const proxy = createAuthzProxy({
      authz,
      auth: {
        signIn: '/login',
        afterSignIn: '/hub',
        forbidden: '/hub',
      },
      public: ['/'],
      guestOnly: ['/login'],
      protected: [
        {
          matcher: '/hub/:path*',
          routes,
        },
      ],
    })

    await expect(proxy(new NextRequest('https://example.com/'))).resolves.toMatchObject({
      status: 200,
    })

    const guestOnlyResponse = await proxy(new NextRequest('https://example.com/login'))

    expect(guestOnlyResponse.status).toBe(307)
    expect(guestOnlyResponse.headers.get('location')).toBe('https://example.com/hub')

    await expect(proxy(new NextRequest('https://example.com/hub'))).resolves.toMatchObject({
      status: 200,
    })
    await expect(proxy(new NextRequest('https://example.com/hub/orders/1'))).resolves.toMatchObject(
      {
        status: 200,
      }
    )
    await expect(proxy(new NextRequest('https://example.com/hub/account'))).resolves.toMatchObject({
      status: 200,
    })

    const forbiddenResponse = await proxy(new NextRequest('https://example.com/hub/settings'))
    const unmatchedResponse = await proxy(new NextRequest('https://example.com/hub/unknown'))

    expect(forbiddenResponse.status).toBe(307)
    expect(forbiddenResponse.headers.get('location')).toBe('https://example.com/hub')
    expect(unmatchedResponse.status).toBe(307)
    expect(unmatchedResponse.headers.get('location')).toBe('https://example.com/hub')

    await expect(
      proxy(new NextRequest('https://example.com/hub/menu/categories'))
    ).resolves.toMatchObject({
      status: 200,
    })
  })

  it('redirects unauthenticated protected-zone requests to sign in', async () => {
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => null,
      adapter,
    })
    const proxy = createAuthzProxy({
      authz,
      auth: {
        signIn: '/login',
        afterSignIn: '/hub',
        forbidden: '/hub',
      },
      guestOnly: ['/login'],
      protected: [
        {
          matcher: '/hub/:path*',
          routes,
        },
      ],
    })

    const protectedResponse = await proxy(new NextRequest('https://example.com/hub/orders'))
    const unmatchedResponse = await proxy(new NextRequest('https://example.com/hub/unknown'))
    const guestOnlyResponse = await proxy(new NextRequest('https://example.com/login'))

    expect(protectedResponse.status).toBe(307)
    expect(protectedResponse.headers.get('location')).toBe('https://example.com/login')
    expect(unmatchedResponse.status).toBe(307)
    expect(unmatchedResponse.headers.get('location')).toBe('https://example.com/login')
    expect(guestOnlyResponse.status).toBe(200)
  })

  it('uses the most specific protected zone when zones overlap', async () => {
    const broadRoutes = defineRoutes({
      hub: {
        path: '/hub',
        label: 'Home',
      },
      admin: {
        path: '/hub/admin',
        label: 'Admin',
      },
    })
    const adminRoutes = defineRoutes({
      settings: {
        path: '/hub/admin/settings',
        label: 'Admin settings',
        permissions: { settings: ['manage'] },
      },
    })
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })
    const proxy = createAuthzProxy({
      authz,
      auth: {
        signIn: '/login',
        afterSignIn: '/hub',
        forbidden: '/hub',
      },
      protected: [
        {
          matcher: '/hub/:path*',
          routes: broadRoutes,
        },
        {
          matcher: '/hub/admin/:path*',
          routes: adminRoutes,
        },
      ],
    })

    const response = await proxy(new NextRequest('https://example.com/hub/admin/settings'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://example.com/hub')
  })

  it('supports any-role matching on declarative routes', async () => {
    const roleRoutes = defineRoutes({
      hub: {
        path: '/hub',
        label: 'Home',
      },
      admin: {
        path: '/hub/admin',
        label: 'Admin',
        roles: ['orders_manager', 'billing_admin'],
        match: 'any',
      },
      strictAdmin: {
        path: '/hub/strict-admin',
        label: 'Strict admin',
        roles: ['orders_manager', 'billing_admin'],
      },
    })
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })
    const proxy = createAuthzProxy({
      authz,
      auth: {
        signIn: '/login',
        afterSignIn: '/hub',
        forbidden: '/hub',
      },
      protected: [
        {
          matcher: '/hub/:path*',
          routes: roleRoutes,
        },
      ],
    })

    await expect(proxy(new NextRequest('https://example.com/hub/admin'))).resolves.toMatchObject({
      status: 200,
    })

    const strictResponse = await proxy(new NextRequest('https://example.com/hub/strict-admin'))

    expect(strictResponse.status).toBe(307)
    expect(strictResponse.headers.get('location')).toBe('https://example.com/hub')
  })

  it('redirects access-denied errors thrown by a duplicate package copy', async () => {
    // Simulates the dual-package hazard: an AccessDeniedError created by another
    // installed copy of @zxkit/authz is not an instance of this copy's class.
    const foreignAccessDenied = Object.assign(new Error('Authentication required'), {
      name: 'AccessDeniedError',
      code: 'UNAUTHORIZED',
    })
    const authz = {
      getSession: async () => null,
      requireAuth: async () => {
        throw foreignAccessDenied
      },
      requireRoute: async () => {
        throw foreignAccessDenied
      },
    } as unknown as ReturnType<typeof createAuthz>
    const dashboardRoutes = defineRoutes({
      dashboard: {
        path: '/dashboard',
        label: 'Dashboard',
      },
      reports: {
        path: '/dashboard/reports',
        label: 'Reports',
        permissions: { order: ['read'] },
      },
    })
    const proxy = createAuthzProxy({
      authz,
      auth: {
        signIn: '/login',
        afterSignIn: '/dashboard',
        forbidden: '/dashboard',
      },
      protected: [
        {
          matcher: '/dashboard/:path*',
          routes: dashboardRoutes,
        },
      ],
    })

    const ruleResponse = await proxy(new NextRequest('https://example.com/dashboard/reports'))
    const unmatchedResponse = await proxy(new NextRequest('https://example.com/dashboard/unknown'))

    expect(ruleResponse.status).toBe(307)
    expect(ruleResponse.headers.get('location')).toBe('https://example.com/login')
    expect(unmatchedResponse.status).toBe(307)
    expect(unmatchedResponse.headers.get('location')).toBe('https://example.com/login')
  })

  it('rejects redirect targets that resolve as protocol-relative URLs', () => {
    const dashboardRoutes = defineRoutes({
      dashboard: {
        path: '/dashboard',
        label: 'Dashboard',
      },
    })
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })

    for (const signIn of ['//evil.com', '/\\evil.com']) {
      expect(() =>
        createAuthzProxy({
          authz,
          auth: {
            signIn,
            afterSignIn: '/dashboard',
            forbidden: '/dashboard',
          },
          protected: [
            {
              matcher: '/dashboard/:path*',
              routes: dashboardRoutes,
            },
          ],
        })
      ).toThrow(AuthzProxyConfigError)
    }
  })

  it('rejects protected fallback targets that require authorization', () => {
    const protectedHubRoutes = defineRoutes({
      hub: {
        path: '/hub',
        label: 'Home',
        permissions: { settings: ['manage'] },
      },
    })
    const authz = createAuthz({
      permissions: permissionCatalog,
      getSession: async () => ({ user: { id: 'user-1' } }),
      adapter,
    })

    expect(() =>
      createAuthzProxy({
        authz,
        auth: {
          signIn: '/login',
          afterSignIn: '/hub',
          forbidden: '/hub',
        },
        guestOnly: ['/login'],
        protected: [
          {
            matcher: '/hub/:path*',
            routes: protectedHubRoutes,
          },
        ],
      })
    ).toThrow(AuthzProxyConfigError)
  })
})

function LegacyProxyConfigTypeTest() {
  const typedAuthz = null as unknown as ReturnType<typeof createAuthz>

  createAuthzProxy({
    authz: typedAuthz,
    auth: {
      signIn: '/login',
      afterSignIn: '/hub',
      forbidden: '/hub',
    },
    protected: [],
    // @ts-expect-error top-level rules belong to the removed legacy API.
    rules: [{ matcher: '/admin/:path*', permissions: { settings: ['manage'] } }],
  })
}

void LegacyProxyConfigTypeTest
