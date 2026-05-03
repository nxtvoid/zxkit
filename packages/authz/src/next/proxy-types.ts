import type { AuthzRoute, AuthzRouteMap } from '../core/types'
import type { createAuthz } from '../server/create-authz'
import type { PathPattern } from './pathname'

export type AuthzProxyAuth = {
  signIn: string
  afterSignIn: string
  forbidden: string
}

export type AuthzGuestOnlyRoute =
  | PathPattern
  | {
      matcher: PathPattern
      redirectTo?: string
    }

export type AuthzProtectedZone<TRoutes extends AuthzRouteMap = AuthzRouteMap> = {
  matcher: PathPattern
  routes: TRoutes
  recursive?: boolean
  denyUnmatched?: boolean
}

export type AuthzProxyOptions<TRoutes extends AuthzRouteMap = AuthzRouteMap> = {
  authz: ReturnType<typeof createAuthz>
  auth: AuthzProxyAuth
  public?: readonly PathPattern[]
  guestOnly?: readonly AuthzGuestOnlyRoute[]
  protected: AuthzProtectedZone<TRoutes> | readonly AuthzProtectedZone<TRoutes>[]
}

export class AuthzProxyConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthzProxyConfigError'
  }
}

export type ResolvedRouteRule = {
  matcher: PathPattern
  route: AuthzRoute
}

export type ResolvedProtectedZone = Omit<AuthzProtectedZone, 'routes'> & {
  routeRules: ResolvedRouteRule[]
}

export type ResolvedProxyConfig = {
  auth: AuthzProxyAuth
  publicPatterns: readonly PathPattern[]
  guestOnlyRoutes: readonly AuthzGuestOnlyRoute[]
  protectedZones: ResolvedProtectedZone[]
}
