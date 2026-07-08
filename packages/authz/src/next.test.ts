import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { createAuthz } from './server.js'
import {
  AuthzProxyConfigError,
  createAuthzProxy,
  matchesPathname,
  sanitizeReturnTo,
} from './next.js'
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

describe('sanitizeReturnTo', () => {
  it('keeps safe internal paths, normalized', () => {
    expect(sanitizeReturnTo('/hub/account', '/hub')).toBe('/hub/account')
    expect(sanitizeReturnTo('/hub/account?tab=2#top', '/hub')).toBe('/hub/account?tab=2#top')
    expect(sanitizeReturnTo('/hub/a/../b', '/hub')).toBe('/hub/b')
  })

  it('falls back on missing or host-escaping values', () => {
    expect(sanitizeReturnTo(null, '/hub')).toBe('/hub')
    expect(sanitizeReturnTo(undefined, '/hub')).toBe('/hub')
    expect(sanitizeReturnTo('', '/hub')).toBe('/hub')
    expect(sanitizeReturnTo('https://evil.com', '/hub')).toBe('/hub')
    expect(sanitizeReturnTo('//evil.com', '/hub')).toBe('/hub')
    expect(sanitizeReturnTo('/\\evil.com', '/hub')).toBe('/hub')
    expect(sanitizeReturnTo('/\t/evil.com', '/hub')).toBe('/hub')
    expect(sanitizeReturnTo('/\n/evil.com', '/hub')).toBe('/hub')
    expect(sanitizeReturnTo('/..//evil.com', '/hub')).toBe('/hub')
    expect(sanitizeReturnTo('javascript:alert(1)', '/hub')).toBe('/hub')
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

  it('preserves the requested path as callbackUrl when returnTo is enabled', async () => {
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
        returnTo: true,
      },
      guestOnly: ['/login'],
      protected: [
        {
          matcher: '/hub/:path*',
          routes,
        },
      ],
    })

    const authOnly = await proxy(new NextRequest('https://example.com/hub/account'))
    const withQuery = await proxy(new NextRequest('https://example.com/hub/account?tab=2'))
    const unmatched = await proxy(new NextRequest('https://example.com/hub/unknown'))

    expect(authOnly.status).toBe(307)
    expect(authOnly.headers.get('location')).toBe(
      'https://example.com/login?callbackUrl=%2Fhub%2Faccount'
    )
    expect(withQuery.headers.get('location')).toBe(
      'https://example.com/login?callbackUrl=%2Fhub%2Faccount%3Ftab%3D2'
    )
    expect(unmatched.headers.get('location')).toBe(
      'https://example.com/login?callbackUrl=%2Fhub%2Funknown'
    )
  })

  it('supports a custom returnTo query param name', async () => {
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
        returnTo: 'next',
      },
      protected: [{ matcher: '/hub/:path*', routes }],
    })

    const response = await proxy(new NextRequest('https://example.com/hub/account'))

    expect(response.headers.get('location')).toBe('https://example.com/login?next=%2Fhub%2Faccount')
  })

  it('does not append a callbackUrl on forbidden (permission) redirects', async () => {
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
        returnTo: true,
      },
      protected: [{ matcher: '/hub/:path*', routes }],
    })

    const response = await proxy(new NextRequest('https://example.com/hub/settings'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://example.com/hub')
  })

  it('redirects a signed-in guest-only visit to a safe returnTo target', async () => {
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
        returnTo: true,
      },
      guestOnly: ['/login'],
      protected: [{ matcher: '/hub/:path*', routes }],
    })

    const safe = await proxy(
      new NextRequest('https://example.com/login?callbackUrl=%2Fhub%2Faccount')
    )
    const external = await proxy(
      new NextRequest('https://example.com/login?callbackUrl=%2F%2Fevil.com')
    )
    // URL parsing strips ASCII tabs/newlines: "/\t/evil.com" resolves as "//evil.com".
    const tabbed = await proxy(
      new NextRequest('https://example.com/login?callbackUrl=%2F%09%2Fevil.com')
    )
    const newline = await proxy(
      new NextRequest('https://example.com/login?callbackUrl=%2F%0A%2Fevil.com')
    )
    // "\" is treated as "/" in special schemes: "/\evil.com" resolves as "//evil.com".
    const backslash = await proxy(
      new NextRequest('https://example.com/login?callbackUrl=%2F%5Cevil.com')
    )
    // Dot-segment normalization: "/..//evil.com" keeps the internal origin but
    // serializes to the protocol-relative "//evil.com".
    const dotSegments = await proxy(
      new NextRequest('https://example.com/login?callbackUrl=%2F..%2F%2Fevil.com')
    )
    const missing = await proxy(new NextRequest('https://example.com/login'))

    expect(safe.headers.get('location')).toBe('https://example.com/hub/account')
    // Unsafe targets fall back to afterSignIn.
    expect(external.headers.get('location')).toBe('https://example.com/hub')
    expect(tabbed.headers.get('location')).toBe('https://example.com/hub')
    expect(newline.headers.get('location')).toBe('https://example.com/hub')
    expect(backslash.headers.get('location')).toBe('https://example.com/hub')
    expect(dotSegments.headers.get('location')).toBe('https://example.com/hub')
    expect(missing.headers.get('location')).toBe('https://example.com/hub')
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
