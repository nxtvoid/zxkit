'use client'

import type { AuthzRoute, PermissionInput, PermissionRequirement } from '../core/types'
import {
  Can,
  Guard,
  Role,
  type AuthzCanComponent,
  type AuthzGuardComponent,
  type AuthzRoleComponent,
} from './components'
import { AuthzProvider, type AuthzProviderComponent, useAuthz } from './context'
import {
  useAllowedRoutes,
  useAuthzRefresh,
  useAuthzSnapshot,
  useCan,
  useCanAccessRoute,
  useHasRole,
  useRoles,
} from './hooks'

export type TypedAuthzClient<TPermissions extends PermissionInput> = {
  AuthzProvider: AuthzProviderComponent
  Can: AuthzCanComponent<TPermissions>
  Guard: AuthzGuardComponent<TPermissions>
  Role: AuthzRoleComponent
  useAllowedRoutes: <
    const TRoutes extends Record<string, AuthzRoute<Record<string, unknown>, TPermissions>>,
  >(
    routes: TRoutes
  ) => Array<TRoutes[keyof TRoutes]>
  useAuthz: typeof useAuthz
  useAuthzRefresh: typeof useAuthzRefresh
  useAuthzSnapshot: typeof useAuthzSnapshot
  useCan: (permissions?: PermissionRequirement<TPermissions>) => boolean
  useCanAccessRoute: (route: AuthzRoute<Record<string, unknown>, TPermissions>) => boolean
  useHasRole: typeof useHasRole
  useRoles: typeof useRoles
}

export function createAuthzClient<const TPermissions extends PermissionInput>(
  permissions: TPermissions
): TypedAuthzClient<TPermissions> {
  void permissions

  return {
    AuthzProvider,
    Can: Can as AuthzCanComponent<TPermissions>,
    Guard: Guard as AuthzGuardComponent<TPermissions>,
    Role,
    useAllowedRoutes: useAllowedRoutes as TypedAuthzClient<TPermissions>['useAllowedRoutes'],
    useAuthz,
    useAuthzRefresh,
    useAuthzSnapshot,
    useCan: useCan as TypedAuthzClient<TPermissions>['useCan'],
    useCanAccessRoute: useCanAccessRoute as TypedAuthzClient<TPermissions>['useCanAccessRoute'],
    useHasRole,
    useRoles,
  }
}
