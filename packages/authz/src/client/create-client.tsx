'use client'

import type {
  AuthzRoute,
  AuthzUser,
  PermissionInput,
  PermissionRequirement,
  PermissionSnapshot,
} from '../core/types'
import type {
  AuthzAllowedNavigation,
  AuthzNavigationConfig,
  AuthzNavigationDefinition,
} from '../core/navigation'
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
  useAllowedNavigation,
  useAuthzRefresh,
  useAuthzSnapshot,
  useCan,
  useCanAccessRoute,
  useHasRole,
  useRoles,
} from './hooks'

export type TypedAuthzSnapshot<TPermissions extends PermissionInput> = {
  user: AuthzUser
  roles: string[]
  permissions: PermissionSnapshot<TPermissions>
}

export type TypedAuthzContextValue<TPermissions extends PermissionInput> = {
  snapshot: TypedAuthzSnapshot<TPermissions> | null
  isPending: boolean
  refresh?: () => Promise<void>
}

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
  useAllowedNavigation: <
    const TRoutes extends Record<string, AuthzRoute<Record<string, unknown>, TPermissions>>,
    const TNavigation extends AuthzNavigationConfig<TRoutes>,
  >(
    navigation: AuthzNavigationDefinition<TRoutes, TNavigation>
  ) => AuthzAllowedNavigation<TRoutes, TNavigation>
  useAuthz: () => TypedAuthzContextValue<TPermissions>
  useAuthzRefresh: () => (() => Promise<void>) | undefined
  useAuthzSnapshot: () => TypedAuthzSnapshot<TPermissions> | null
  useCan: (permissions?: PermissionRequirement<TPermissions>) => boolean
  useCanAccessRoute: (route: AuthzRoute<Record<string, unknown>, TPermissions>) => boolean
  useHasRole: (role: string | readonly string[], options?: { match?: 'all' | 'any' }) => boolean
  useRoles: () => string[]
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
    useAllowedNavigation:
      useAllowedNavigation as TypedAuthzClient<TPermissions>['useAllowedNavigation'],
    useAuthz: useAuthz as TypedAuthzClient<TPermissions>['useAuthz'],
    useAuthzRefresh,
    useAuthzSnapshot: useAuthzSnapshot as TypedAuthzClient<TPermissions>['useAuthzSnapshot'],
    useCan: useCan as TypedAuthzClient<TPermissions>['useCan'],
    useCanAccessRoute: useCanAccessRoute as TypedAuthzClient<TPermissions>['useCanAccessRoute'],
    useHasRole,
    useRoles,
  }
}
