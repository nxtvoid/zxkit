import { NextResponse, type NextRequest } from 'next/server'
import type { createAuthz } from '../server/create-authz'
import { AccessDeniedError } from '../server/errors'
import { resolveProxyConfig } from './proxy-config'
import {
  findGuestOnlyRoute,
  findProtectedZone,
  findRouteRule,
  getGuestOnlyRedirect,
  matchesAny,
} from './proxy-routes'
import {
  AuthzProxyConfigError,
  type AuthzProxyOptions,
  type ResolvedProtectedZone,
  type ResolvedRouteRule,
} from './proxy-types'

export { AuthzProxyConfigError }
export type {
  AuthzGuestOnlyRoute,
  AuthzProtectedZone,
  AuthzProxyAuth,
  AuthzProxyOptions,
} from './proxy-types'

function redirect(request: NextRequest, target: string) {
  return NextResponse.redirect(new URL(target, request.url))
}

async function requireRuleAccess(authz: ReturnType<typeof createAuthz>, rule: ResolvedRouteRule) {
  await authz.requireRoute(rule.route)
}

function getRedirectTarget(input: { error: AccessDeniedError; signIn: string; forbidden: string }) {
  if (input.error.code === 'UNAUTHORIZED') {
    return input.signIn
  }

  return input.forbidden
}

async function handleRule(input: {
  authz: ReturnType<typeof createAuthz>
  request: NextRequest
  rule: ResolvedRouteRule
  signIn: string
  forbidden: string
}) {
  try {
    await requireRuleAccess(input.authz, input.rule)
    return NextResponse.next()
  } catch (error) {
    if (!(error instanceof AccessDeniedError)) {
      throw error
    }

    return redirect(
      input.request,
      getRedirectTarget({
        error,
        signIn: input.signIn,
        forbidden: input.forbidden,
      })
    )
  }
}

async function handleProtectedZone(input: {
  authz: ReturnType<typeof createAuthz>
  request: NextRequest
  zone: ResolvedProtectedZone
  signIn: string
  forbidden: string
}) {
  const pathname = input.request.nextUrl.pathname
  const rule = findRouteRule(input.zone.routeRules, pathname)

  if (rule) {
    return handleRule({
      authz: input.authz,
      request: input.request,
      rule,
      signIn: input.signIn,
      forbidden: input.forbidden,
    })
  }

  try {
    await input.authz.requireAuth()
  } catch (error) {
    if (!(error instanceof AccessDeniedError)) {
      throw error
    }

    return redirect(
      input.request,
      getRedirectTarget({
        error,
        signIn: input.signIn,
        forbidden: input.forbidden,
      })
    )
  }

  if (input.zone.denyUnmatched) {
    return redirect(input.request, input.forbidden)
  }

  return NextResponse.next()
}

export function createAuthzProxy(options: AuthzProxyOptions) {
  const config = resolveProxyConfig(options)
  const { auth, publicPatterns, guestOnlyRoutes, protectedZones } = config

  return async function authzProxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname
    const guestOnlyRoute = findGuestOnlyRoute(guestOnlyRoutes, pathname)

    if (guestOnlyRoute) {
      const session = await options.authz.getSession()
      const target = getGuestOnlyRedirect(guestOnlyRoute, auth.afterSignIn)

      if (session && target) {
        return redirect(request, target)
      }

      return NextResponse.next()
    }

    if (matchesAny(publicPatterns, pathname)) {
      return NextResponse.next()
    }

    const protectedZone = findProtectedZone(protectedZones, pathname)

    if (protectedZone) {
      return handleProtectedZone({
        authz: options.authz,
        request,
        zone: protectedZone,
        signIn: auth.signIn,
        forbidden: auth.forbidden,
      })
    }

    return NextResponse.next()
  }
}
