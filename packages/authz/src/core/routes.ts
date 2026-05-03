import type { AuthzRouteMap } from './types'

export function defineRoutes<const TRoutes extends AuthzRouteMap>(routes: TRoutes) {
  return routes
}
