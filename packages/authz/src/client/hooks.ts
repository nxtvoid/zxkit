'use client'

import * as React from 'react'
import type {
  AuthzRoute,
  AuthzRouteMap,
  PermissionInput,
  PermissionRequirement,
} from '../core/types'
import { hasPermissions } from '../core/permissions'
import { hasMatchingRole } from '../core/roles'
import {
  getAllowedNavigation,
  getCurrentNavigationNode,
  getNavigationBreadcrumb,
  type AuthzNavigationConfig,
  type AuthzNavigationDefinition,
} from '../core/navigation'
import { useAuthz } from './context'

export function useAuthzSnapshot() {
  return useAuthz().snapshot
}

export function useAuthzRefresh() {
  return useAuthz().refresh
}

export function useRoles() {
  return useAuthz().snapshot?.roles ?? []
}

export function useCan<TPermissions extends PermissionInput = PermissionInput>(
  permissions?: PermissionRequirement<TPermissions>
) {
  const { snapshot } = useAuthz()
  return hasPermissions(snapshot?.permissions ?? {}, permissions as PermissionInput | undefined)
}

// Client parallel of authz.canEach: many keyed checks against the provider
// snapshot. Destructure by name instead of calling useCan once per flag.
export function useCanEach<TChecks extends Record<string, PermissionRequirement<PermissionInput>>>(
  checks: TChecks
): Record<keyof TChecks, boolean> {
  const permissions = useAuthz().snapshot?.permissions

  return React.useMemo(() => {
    const owned = permissions ?? {}
    const result = {} as Record<keyof TChecks, boolean>

    for (const key in checks) {
      result[key] = hasPermissions(owned, checks[key] as PermissionInput)
    }

    return result
  }, [checks, permissions])
}

// Client parallel of authz.canAny: OR across a list of requirements.
export function useCanAny<TPermissions extends PermissionInput = PermissionInput>(
  requirements: readonly PermissionRequirement<TPermissions>[]
) {
  const permissions = useAuthz().snapshot?.permissions

  return React.useMemo(
    () =>
      requirements.some((requirement) =>
        hasPermissions(permissions ?? {}, requirement as PermissionInput)
      ),
    [requirements, permissions]
  )
}

export function useHasRole(role: string | readonly string[], options?: { match?: 'all' | 'any' }) {
  const { snapshot } = useAuthz()
  const roles = Array.isArray(role) ? role : [role]
  return hasMatchingRole(snapshot?.roles ?? [], roles, options?.match)
}

// Role parallel of useCanEach: many keyed role checks against the snapshot.
export function useHasRoleEach<TChecks extends Record<string, string | readonly string[]>>(
  checks: TChecks,
  options?: { match?: 'all' | 'any' }
): Record<keyof TChecks, boolean> {
  const roles = useAuthz().snapshot?.roles
  const match = options?.match

  return React.useMemo(() => {
    const owned = roles ?? []
    const result = {} as Record<keyof TChecks, boolean>

    for (const key in checks) {
      const value = checks[key]
      const required = Array.isArray(value) ? value : [value as string]
      result[key] = hasMatchingRole(owned, required, match)
    }

    return result
  }, [checks, roles, match])
}

export function useCanAccessRoute<TPermissions extends PermissionInput = PermissionInput>(
  route: AuthzRoute<Record<string, unknown>, TPermissions>
) {
  const { snapshot } = useAuthz()
  return (
    hasMatchingRole(snapshot?.roles ?? [], route.roles, route.match) &&
    hasPermissions(snapshot?.permissions ?? {}, route.permissions as PermissionInput | undefined)
  )
}

export function useAllowedRoutes<const TRoutes extends Record<string, AuthzRoute>>(
  routes: TRoutes
) {
  const { snapshot } = useAuthz()

  return React.useMemo(
    () =>
      Object.values(routes).filter(
        (route) =>
          hasMatchingRole(snapshot?.roles ?? [], route.roles, route.match) &&
          hasPermissions(
            snapshot?.permissions ?? {},
            route.permissions as PermissionInput | undefined
          )
      ),
    [routes, snapshot?.permissions, snapshot?.roles]
  )
}

export function useAllowedNavigation<
  const TRoutes extends AuthzRouteMap,
  const TNavigation extends AuthzNavigationConfig<TRoutes>,
>(navigation: AuthzNavigationDefinition<TRoutes, TNavigation>) {
  const { snapshot } = useAuthz()

  return React.useMemo(() => getAllowedNavigation(navigation, snapshot), [navigation, snapshot])
}

export function useNavigationBreadcrumb<
  const TRoutes extends AuthzRouteMap,
  const TNavigation extends AuthzNavigationConfig<TRoutes>,
>(navigation: AuthzNavigationDefinition<TRoutes, TNavigation>, pathname: string) {
  const { snapshot } = useAuthz()

  return React.useMemo(
    () => getNavigationBreadcrumb(navigation, pathname, snapshot),
    [navigation, pathname, snapshot]
  )
}

export function useCurrentNavigationNode<
  const TRoutes extends AuthzRouteMap,
  const TNavigation extends AuthzNavigationConfig<TRoutes>,
>(navigation: AuthzNavigationDefinition<TRoutes, TNavigation>, pathname: string) {
  const { snapshot } = useAuthz()

  return React.useMemo(
    () => getCurrentNavigationNode(navigation, pathname, snapshot),
    [navigation, pathname, snapshot]
  )
}
