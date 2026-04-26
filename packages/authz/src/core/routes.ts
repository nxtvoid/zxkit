import type { AuthzRoute } from './types'

export function defineRoutes<const TRoutes extends Record<string, AuthzRoute>>(routes: TRoutes) {
  return routes
}
