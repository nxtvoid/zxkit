'use client'

import * as React from 'react'
import type { AuthzSnapshot, AuthzUser } from '../core/types'

export type AuthzClientContextValue<TUser extends AuthzUser = AuthzUser> = {
  snapshot: AuthzSnapshot<TUser> | null
  isPending: boolean
  refresh?: () => Promise<void>
}

export type AuthzProviderProps<TUser extends AuthzUser = AuthzUser> = {
  snapshot: AuthzSnapshot<TUser> | null
  isPending?: boolean
  refresh?: () => Promise<void>
  children: React.ReactNode
}

export type AuthzProviderComponent<TUser extends AuthzUser = AuthzUser> = (
  props: AuthzProviderProps<TUser>
) => React.ReactElement | null

const AuthzClientContext = React.createContext<AuthzClientContextValue | null>(null)

export function AuthzProvider<TUser extends AuthzUser = AuthzUser>({
  snapshot,
  isPending = false,
  refresh,
  children,
}: AuthzProviderProps<TUser>) {
  const value = React.useMemo<AuthzClientContextValue<TUser>>(
    () => ({
      snapshot,
      isPending,
      refresh,
    }),
    [isPending, refresh, snapshot]
  )

  return (
    <AuthzClientContext.Provider value={value as AuthzClientContextValue}>
      {children}
    </AuthzClientContext.Provider>
  )
}

export function useAuthz() {
  const context = React.useContext(AuthzClientContext)

  if (!context) {
    throw new Error('AuthzProvider is required to use @zxkit/authz client hooks.')
  }

  return context
}
