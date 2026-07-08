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
import { appendReturnTo, readReturnTo, resolveReturnToParam } from './return-to'
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

function getRedirectTarget(input: {
  error: AccessDeniedError
  request: NextRequest
  signIn: string
  forbidden: string
  returnToParam: string | null
}) {
  if (input.error.code !== 'UNAUTHORIZED') {
    return input.forbidden
  }

  if (!input.returnToParam) {
    return input.signIn
  }

  const returnPath = input.request.nextUrl.pathname + input.request.nextUrl.search

  return appendReturnTo(input.signIn, input.returnToParam, returnPath)
}

async function handleRule(input: {
  authz: ReturnType<typeof createAuthz>
  request: NextRequest
  rule: ResolvedRouteRule
  signIn: string
  forbidden: string
  returnToParam: string | null
}) {
  try {
    await requireRuleAccess(input.authz, input.rule)
    return NextResponse.next()
  } catch (error) {
    if (!AccessDeniedError.is(error)) {
      throw error
    }

    return redirect(
      input.request,
      getRedirectTarget({
        error,
        request: input.request,
        signIn: input.signIn,
        forbidden: input.forbidden,
        returnToParam: input.returnToParam,
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
  returnToParam: string | null
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
      returnToParam: input.returnToParam,
    })
  }

  try {
    await input.authz.requireAuth()
  } catch (error) {
    if (!AccessDeniedError.is(error)) {
      throw error
    }

    return redirect(
      input.request,
      getRedirectTarget({
        error,
        request: input.request,
        signIn: input.signIn,
        forbidden: input.forbidden,
        returnToParam: input.returnToParam,
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
  const returnToParam = resolveReturnToParam(auth.returnTo)

  return async function authzProxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname
    const guestOnlyRoute = findGuestOnlyRoute(guestOnlyRoutes, pathname)

    if (guestOnlyRoute) {
      const session = await options.authz.getSession()
      const target = getGuestOnlyRedirect(guestOnlyRoute, auth.afterSignIn)

      if (session) {
        const returnTarget = (returnToParam ? readReturnTo(request, returnToParam) : null) ?? target

        if (returnTarget) {
          return redirect(request, returnTarget)
        }
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
        returnToParam,
      })
    }

    return NextResponse.next()
  }
}
