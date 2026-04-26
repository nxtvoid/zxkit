import { NextResponse, type NextRequest } from 'next/server'
import type { AuthzRoute } from '../core/types'
import { AccessDeniedError } from '../server/errors'
import type { createAuthz } from '../server/create-authz'
import { matchesPathname, type PathPattern } from './pathname'

export type AuthzProxyRule = {
  matcher: PathPattern
  route?: AuthzRoute
  roles?: readonly string[]
  match?: 'all' | 'any'
  permissions?: AuthzRoute['permissions']
  redirectTo?: string
}

export function createAuthzProxy(options: {
  authz: ReturnType<typeof createAuthz>
  rules: readonly AuthzProxyRule[]
  publicRoutes?: readonly string[]
  signInPath?: string
  forbiddenPath?: string
}) {
  const publicRoutes = options.publicRoutes ?? []
  const signInPath = options.signInPath ?? '/login'
  const forbiddenPath = options.forbiddenPath ?? '/forbidden'

  return async function authzProxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    if (matchesPathname(publicRoutes, pathname)) {
      return NextResponse.next()
    }

    const rule = options.rules.find((entry) => matchesPathname(entry.matcher, pathname))

    if (!rule) {
      return NextResponse.next()
    }

    try {
      if (rule.route) {
        await options.authz.requireRoute(rule.route)
      } else {
        if (rule.roles?.length) {
          await options.authz.requireRole(rule.roles, { match: rule.match ?? 'all' })
        }

        if (rule.permissions) {
          await options.authz.require(rule.permissions)
        } else if (!rule.roles?.length) {
          await options.authz.requireAuth()
        }
      }

      return NextResponse.next()
    } catch (error) {
      if (!(error instanceof AccessDeniedError)) {
        throw error
      }

      const target = error.code === 'UNAUTHORIZED' ? signInPath : (rule.redirectTo ?? forbiddenPath)
      return NextResponse.redirect(new URL(target, request.url))
    }
  }
}
