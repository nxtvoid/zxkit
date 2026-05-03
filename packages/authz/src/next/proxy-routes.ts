import type { AuthzRoute, AuthzRouteMap } from '../core/types'
import { matchesPathname, type PathPattern } from './pathname'
import type {
  AuthzGuestOnlyRoute,
  AuthzProxyOptions,
  ResolvedProtectedZone,
  ResolvedRouteRule,
} from './proxy-types'

function toArray<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value as T]
}

function normalizePath(path: string) {
  if (path === '/') {
    return path
  }

  return path.replace(/\/+$/, '')
}

export function isGuestOnlyConfig(
  entry: AuthzGuestOnlyRoute
): entry is Exclude<AuthzGuestOnlyRoute, PathPattern> {
  return typeof entry === 'object' && !Array.isArray(entry) && 'matcher' in entry
}

export function matchesAny(patterns: readonly PathPattern[], pathname: string) {
  return patterns.some((pattern) => matchesPathname(pattern, pathname))
}

function getRouteMatchers(route: AuthzRoute, recursive: boolean) {
  const path = normalizePath(route.path)

  if (!recursive) {
    return [path]
  }

  if (path === '/') {
    return ['/', '/:path*']
  }

  return [path, `${path}/:path*`]
}

function getProtectedZoneBasePaths(matcher: PathPattern) {
  const matchers = Array.isArray(matcher) ? matcher : [matcher]

  return matchers.flatMap((entry) => {
    const normalized = normalizePath(entry.startsWith('/') ? entry : `/${entry}`)

    if (!normalized.endsWith('/:path*')) {
      return []
    }

    return [normalizePath(normalized.slice(0, -'/:path*'.length) || '/')]
  })
}

function getPatternSpecificity(pattern: string) {
  const normalized = pattern.startsWith('/') ? pattern : `/${pattern}`
  const tokens = normalized.split('/').filter(Boolean)
  const staticSegments = tokens.filter((token) => !token.startsWith(':')).length
  const wildcardSegments = tokens.filter((token) => token === ':path*').length
  const dynamicSegments = tokens.filter(
    (token) => token.startsWith(':') && token !== ':path*'
  ).length

  return {
    staticSegments,
    wildcardSegments,
    dynamicSegments,
    length: normalized.length,
  }
}

type PatternSpecificity = ReturnType<typeof getPatternSpecificity>

function comparePatternSpecificity(left: PatternSpecificity, right: PatternSpecificity) {
  if (left.staticSegments !== right.staticSegments) {
    return right.staticSegments - left.staticSegments
  }

  if (left.wildcardSegments !== right.wildcardSegments) {
    return left.wildcardSegments - right.wildcardSegments
  }

  if (left.dynamicSegments !== right.dynamicSegments) {
    return left.dynamicSegments - right.dynamicSegments
  }

  return right.length - left.length
}

function getBestPatternSpecificity(pattern: PathPattern) {
  const matchers = Array.isArray(pattern) ? pattern : [pattern]

  return (
    matchers
      .map((matcher) => getPatternSpecificity(matcher))
      .sort(comparePatternSpecificity)[0] ?? {
      staticSegments: 0,
      wildcardSegments: 0,
      dynamicSegments: 0,
      length: 0,
    }
  )
}

function getRuleSpecificity(rule: ResolvedRouteRule) {
  return getBestPatternSpecificity(rule.matcher)
}

function sortRulesBySpecificity(rules: readonly ResolvedRouteRule[]) {
  return [...rules].sort((left, right) => {
    return comparePatternSpecificity(getRuleSpecificity(left), getRuleSpecificity(right))
  })
}

function sortZonesBySpecificity(zones: readonly ResolvedProtectedZone[]) {
  return [...zones].sort((left, right) => {
    return comparePatternSpecificity(
      getBestPatternSpecificity(left.matcher),
      getBestPatternSpecificity(right.matcher)
    )
  })
}

export function routeRequiresAuthorization(route: AuthzRoute | undefined) {
  const permissions = route?.permissions
  return Boolean(
    route?.roles?.length ||
    (permissions && typeof permissions === 'object' && Object.keys(permissions).length > 0)
  )
}

function createRulesFromRoutes(
  routes: AuthzRouteMap,
  options: { protectedMatcher: PathPattern; recursive: boolean }
) {
  const zoneBasePaths = getProtectedZoneBasePaths(options.protectedMatcher)

  return Object.values(routes).map((route) => ({
    matcher: getRouteMatchers(
      route as AuthzRoute,
      options.recursive && !zoneBasePaths.includes(normalizePath(route.path))
    ),
    route: route as AuthzRoute,
  }))
}

export function resolveProtectedZones(
  protectedZones: AuthzProxyOptions['protected']
): ResolvedProtectedZone[] {
  return sortZonesBySpecificity(
    toArray(protectedZones).map((zone) => {
      const recursive = zone.recursive ?? true
      return {
        matcher: zone.matcher,
        recursive,
        denyUnmatched: zone.denyUnmatched ?? true,
        routeRules: sortRulesBySpecificity([
          ...createRulesFromRoutes(zone.routes, { protectedMatcher: zone.matcher, recursive }),
        ]),
      }
    })
  )
}

export function findRouteRule(routeRules: readonly ResolvedRouteRule[], pathname: string) {
  return routeRules.find((routeRule) => matchesPathname(routeRule.matcher, pathname))
}

export function findGuestOnlyRoute(routes: readonly AuthzGuestOnlyRoute[], pathname: string) {
  return routes.find((route) =>
    matchesPathname(isGuestOnlyConfig(route) ? route.matcher : route, pathname)
  )
}

export function findProtectedZone(zones: readonly ResolvedProtectedZone[], pathname: string) {
  return zones.find((zone) => matchesPathname(zone.matcher, pathname))
}

export function getGuestOnlyRedirect(route: AuthzGuestOnlyRoute, fallback: string | undefined) {
  return isGuestOnlyConfig(route) ? (route.redirectTo ?? fallback) : fallback
}
