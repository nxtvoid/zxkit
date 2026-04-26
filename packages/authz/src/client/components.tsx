'use client'

import * as React from 'react'
import type { AuthzRoute, PermissionInput, PermissionRequirement } from '../core/types'
import { hasPermissions } from '../core/permissions'
import { hasMatchingRole } from '../core/roles'
import { useAuthz } from './context'
import { useCan, useRoles } from './hooks'

export type CanProps<TPermissions extends PermissionInput = PermissionInput> = {
  permissions?: PermissionRequirement<TPermissions>
  loading?: React.ReactNode
  fallback?: React.ReactNode
  children?: React.ReactNode
}

export type AuthzCanComponent<TPermissions extends PermissionInput = PermissionInput> = (
  props: CanProps<TPermissions>
) => React.ReactElement | null

export type RoleProps = {
  role?: string
  roles?: readonly string[]
  match?: 'all' | 'any'
  loading?: React.ReactNode
  fallback?: React.ReactNode
  children?: React.ReactNode
}

export type AuthzRoleComponent = (props: RoleProps) => React.ReactElement | null

export type GuardProps<TPermissions extends PermissionInput = PermissionInput> =
  CanProps<TPermissions> &
    RoleProps & {
      route?: AuthzRoute<Record<string, unknown>, TPermissions>
      forbidden?: React.ReactNode
    }

export type AuthzGuardComponent<TPermissions extends PermissionInput = PermissionInput> = (
  props: GuardProps<TPermissions>
) => React.ReactElement | null

export function Can<TPermissions extends PermissionInput = PermissionInput>({
  permissions,
  loading = null,
  fallback = null,
  children,
}: CanProps<TPermissions>) {
  const { isPending } = useAuthz()
  const allowed = useCan(permissions)

  if (isPending) {
    return <>{loading}</>
  }

  return <>{allowed ? children : fallback}</>
}

export function Role({
  role,
  roles,
  match = 'all',
  loading = null,
  fallback = null,
  children,
}: RoleProps) {
  const { isPending } = useAuthz()
  const ownedRoles = useRoles()
  const requiredRoles = role ? [role] : (roles ?? [])
  const allowed = hasMatchingRole(ownedRoles, requiredRoles, match)

  if (isPending) {
    return <>{loading}</>
  }

  return <>{allowed ? children : fallback}</>
}

export function Guard<TPermissions extends PermissionInput = PermissionInput>({
  route,
  permissions,
  role,
  roles,
  match = 'all',
  loading = null,
  fallback = null,
  forbidden = fallback,
  children,
}: GuardProps<TPermissions>) {
  const { isPending, snapshot } = useAuthz()
  const requiredRoles = route?.roles ?? (role ? [role] : roles)
  const requiredPermissions = route?.permissions ?? permissions
  const allowed =
    hasMatchingRole(snapshot?.roles ?? [], requiredRoles, match) &&
    hasPermissions(snapshot?.permissions ?? {}, requiredPermissions as PermissionInput | undefined)

  if (isPending) {
    return <>{loading}</>
  }

  return <>{allowed ? children : forbidden}</>
}
