// @vitest-environment jsdom

import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { createAuthzClient } from './client.js'
import { definePermissions, defineRoutes, type AuthzSnapshot } from './index.js'

const permissionCatalog = definePermissions({
  order: ['read', 'create', 'update', 'delete'],
  invoice: ['read', 'export'],
  settings: ['manage'],
})
const typedClient = createAuthzClient(permissionCatalog)
const { AuthzProvider, Can, Guard, Role, useAllowedRoutes, useCan, useRoles } = typedClient
type TypedCanProps = React.ComponentProps<typeof typedClient.Can>
type TypedUseCanPermissions = Parameters<typeof typedClient.useCan>[0]

const typedCanProps: TypedCanProps = {
  permissions: { order: ['delete'], invoice: ['export'] },
}
const typedUseCanPermissions: TypedUseCanPermissions = {
  settings: ['manage'],
}

const typedCanPropsInvalidAction: TypedCanProps = {
  permissions: {
    // @ts-expect-error settings only supports manage.
    settings: ['delete'],
  },
}

const typedUseCanPermissionsInvalidResource: TypedUseCanPermissions = {
  // @ts-expect-error customer is not in the permission catalog.
  customer: ['read'],
}

void [
  typedClient,
  typedCanProps,
  typedUseCanPermissions,
  typedCanPropsInvalidAction,
  typedUseCanPermissionsInvalidResource,
]

const snapshot: AuthzSnapshot = {
  user: { id: 'user-1', name: 'Ada' },
  roles: ['orders_manager', 'billing_viewer'],
  permissions: {
    order: ['read', 'delete'],
    invoice: ['read'],
  },
}

describe('AuthzProvider', () => {
  it('checks permissions locally from a snapshot', () => {
    function Label() {
      const canDeleteOrders = useCan({ order: ['delete'] })
      const roles = useRoles()

      return (
        <>
          <span>{canDeleteOrders ? 'can-delete-orders' : 'blocked'}</span>
          <span>{roles.join(',')}</span>
        </>
      )
    }

    render(
      <AuthzProvider snapshot={snapshot}>
        <Can permissions={{ invoice: ['read'] }} fallback={<span>invoice-blocked</span>}>
          <span>invoice-visible</span>
        </Can>
        <Role role='orders_manager' fallback={<span>role-blocked</span>}>
          <span>role-visible</span>
        </Role>
        <Label />
      </AuthzProvider>
    )

    expect(screen.queryByText('invoice-visible')).not.toBeNull()
    expect(screen.queryByText('role-visible')).not.toBeNull()
    expect(screen.queryByText('can-delete-orders')).not.toBeNull()
    expect(screen.queryByText('orders_manager,billing_viewer')).not.toBeNull()
  })

  it('filters allowed routes without fetching', () => {
    const routes = defineRoutes({
      orders: {
        path: '/orders',
        label: 'Orders',
        permissions: { order: ['read'] },
      },
      settings: {
        path: '/settings',
        label: 'Settings',
        permissions: { settings: ['manage'] },
      },
    })

    function Sidebar() {
      const allowedRoutes = useAllowedRoutes(routes)

      return (
        <nav>
          {allowedRoutes.map((route) => (
            <a key={route.path} href={route.path}>
              {route.label as string}
            </a>
          ))}
        </nav>
      )
    }

    render(
      <AuthzProvider snapshot={snapshot}>
        <Sidebar />
      </AuthzProvider>
    )

    expect(screen.queryByText('Orders')).not.toBeNull()
    expect(screen.queryByText('Settings')).toBeNull()
  })

  it('supports guards and refresh callbacks', async () => {
    const refresh = vi.fn(async () => {})

    function RefreshButton() {
      return <button onClick={() => refresh()}>refresh</button>
    }

    render(
      <AuthzProvider snapshot={snapshot} refresh={refresh}>
        <Guard permissions={{ order: ['delete'] }} forbidden={<span>blocked</span>}>
          <span>guard-visible</span>
        </Guard>
        <Guard permissions={{ settings: ['manage'] }} forbidden={<span>settings-blocked</span>}>
          <span>settings-visible</span>
        </Guard>
        <RefreshButton />
      </AuthzProvider>
    )

    expect(screen.queryByText('guard-visible')).not.toBeNull()
    expect(screen.queryByText('settings-blocked')).not.toBeNull()

    fireEvent.click(screen.getByText('refresh'))

    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
