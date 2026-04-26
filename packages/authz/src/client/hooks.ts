'use client'

import * as React from 'react'
import type { AuthzRoute, PermissionInput, PermissionRequirement } from '../core/types'
import { hasPermissions } from '../core/permissions'
import { hasMatchingRole } from '../core/roles'
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

export function useHasRole(role: string | readonly string[], options?: { match?: 'all' | 'any' }) {
  const { snapshot } = useAuthz()
  const roles = Array.isArray(role) ? role : [role]
  return hasMatchingRole(snapshot?.roles ?? [], roles, options?.match)
}

export function useCanAccessRoute<TPermissions extends PermissionInput = PermissionInput>(
  route: AuthzRoute<Record<string, unknown>, TPermissions>
) {
  const { snapshot } = useAuthz()
  return (
    hasMatchingRole(snapshot?.roles ?? [], route.roles) &&
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
          hasMatchingRole(snapshot?.roles ?? [], route.roles) &&
          hasPermissions(
            snapshot?.permissions ?? {},
            route.permissions as PermissionInput | undefined
          )
      ),
    [routes, snapshot?.permissions, snapshot?.roles]
  )
}
