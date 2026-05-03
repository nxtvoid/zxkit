import type { PathPattern } from './pathname'
import {
  findGuestOnlyRoute,
  findProtectedZone,
  findRouteRule,
  isGuestOnlyConfig,
  matchesAny,
  resolveProtectedZones,
  routeRequiresAuthorization,
} from './proxy-routes'
import {
  AuthzProxyConfigError,
  type AuthzGuestOnlyRoute,
  type AuthzProxyAuth,
  type AuthzProxyOptions,
  type ResolvedProtectedZone,
  type ResolvedProxyConfig,
  type ResolvedRouteRule,
} from './proxy-types'

function assertInternalPath(name: string, path: string | undefined) {
  if (!path) {
    return
  }

  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new AuthzProxyConfigError(`${name} must be an internal path starting with "/".`)
  }
}

function ruleRequiresAuthorization(rule: ResolvedRouteRule | undefined) {
  return routeRequiresAuthorization(rule?.route)
}

function validateSafeRedirectTarget(input: {
  name: string
  target: string | undefined
  publicPatterns: readonly PathPattern[]
  protectedZones: readonly ResolvedProtectedZone[]
  guestOnlyRoutes: readonly AuthzGuestOnlyRoute[]
}) {
  if (!input.target) {
    return
  }

  assertInternalPath(input.name, input.target)

  if (findGuestOnlyRoute(input.guestOnlyRoutes, input.target)) {
    throw new AuthzProxyConfigError(
      `${input.name} points to "${input.target}", but that path is guest-only.`
    )
  }

  if (matchesAny(input.publicPatterns, input.target)) {
    return
  }

  const zone = findProtectedZone(input.protectedZones, input.target)

  if (!zone) {
    return
  }

  const rule = findRouteRule(zone.routeRules, input.target)

  if (!rule) {
    throw new AuthzProxyConfigError(
      `${input.name} points to "${input.target}", but that path is not defined inside its protected zone.`
    )
  }

  if (ruleRequiresAuthorization(rule)) {
    throw new AuthzProxyConfigError(
      `${input.name} points to "${input.target}", but that route requires permissions or roles.`
    )
  }
}

function validateProxyConfig(input: {
  auth: AuthzProxyAuth
  publicPatterns: readonly PathPattern[]
  protectedZones: readonly ResolvedProtectedZone[]
  guestOnlyRoutes: readonly AuthzGuestOnlyRoute[]
}) {
  assertInternalPath('auth.signIn', input.auth.signIn)
  assertInternalPath('auth.forbidden', input.auth.forbidden)
  assertInternalPath('auth.afterSignIn', input.auth.afterSignIn)

  for (const route of input.guestOnlyRoutes) {
    if (isGuestOnlyConfig(route)) {
      assertInternalPath('guestOnly.redirectTo', route.redirectTo)
    }
  }

  const signInIsPublic =
    matchesAny(input.publicPatterns, input.auth.signIn) ||
    Boolean(findGuestOnlyRoute(input.guestOnlyRoutes, input.auth.signIn))

  if (
    !signInIsPublic &&
    matchesAny(
      input.protectedZones.map((zone) => zone.matcher),
      input.auth.signIn
    )
  ) {
    throw new AuthzProxyConfigError(
      `auth.signIn points to "${input.auth.signIn}", but that path is inside a protected zone.`
    )
  }

  validateSafeRedirectTarget({
    name: 'auth.afterSignIn',
    target: input.auth.afterSignIn,
    publicPatterns: input.publicPatterns,
    protectedZones: input.protectedZones,
    guestOnlyRoutes: input.guestOnlyRoutes,
  })
  validateSafeRedirectTarget({
    name: 'auth.forbidden',
    target: input.auth.forbidden,
    publicPatterns: input.publicPatterns,
    protectedZones: input.protectedZones,
    guestOnlyRoutes: input.guestOnlyRoutes,
  })
}

export function resolveProxyConfig(options: AuthzProxyOptions): ResolvedProxyConfig {
  const config = {
    auth: options.auth,
    publicPatterns: options.public ?? [],
    guestOnlyRoutes: options.guestOnly ?? [],
    protectedZones: resolveProtectedZones(options.protected),
  }

  validateProxyConfig(config)

  return config
}
