// @vitest-environment jsdom

import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { createAuthzClient } from './client.js'
import { defineNavigation, definePermissions, defineRoutes, type AuthzSnapshot } from './index.js'

const permissionCatalog = definePermissions({
  order: ['read', 'create', 'update', 'delete'],
  invoice: ['read', 'export'],
  settings: ['manage'],
})
const typedClient = createAuthzClient(permissionCatalog)
const {
  AuthzProvider,
  Can,
  Guard,
  Role,
  useAllowedNavigation,
  useAllowedRoutes,
  useCan,
  useRoles,
} = typedClient
type TypedCanProps = React.ComponentProps<typeof typedClient.Can>
type TypedUseCanPermissions = Parameters<typeof typedClient.useCan>[0]

const typedCanProps: TypedCanProps = {
  permissions: { order: ['delete'], invoice: ['export'] },
}
const typedUseCanPermissions: TypedUseCanPermissions = {
  settings: ['manage'],
}
const typedUseCanWildcardPermissions: TypedUseCanPermissions = {
  '*': ['*'],
  order: ['*'],
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
const typedUseCanPermissionsInvalidGlobalWildcard: TypedUseCanPermissions = {
  // @ts-expect-error global wildcard only supports the "*" action.
  '*': ['read'],
}

const typedInvalidNavigationRoutes = defineRoutes({
  settings: {
    path: '/settings',
    label: 'Settings',
    permissions: {
      settings: ['delete'],
    },
  },
})

const typedInvalidNavigation = defineNavigation(typedInvalidNavigationRoutes, {
  default: {
    children: [
      {
        children: [{ route: 'settings', icon: 'settings' }],
      },
    ],
  },
})

const typedNavigationRoutes = defineRoutes({
  orders: {
    path: '/orders',
    label: 'Orders',
    permissions: { order: ['read'] },
  },
  account: {
    path: '/account',
    label: 'Account',
  },
})

const typedNavigation = defineNavigation(typedNavigationRoutes, {
  default: {
    direction: 'left',
    children: [
      {
        name: 'General',
        children: [{ route: 'orders', icon: 'orders-icon', exact: true }],
      },
    ],
  },
  userSettings: {
    title: 'Settings',
    backHref: '/orders',
    direction: 'right',
    children: [
      {
        children: [{ route: 'account', icon: 'account-icon', exact: true }],
      },
    ],
  },
})

function TypedInvalidNavigationConsumer() {
  // @ts-expect-error settings only supports manage.
  useAllowedNavigation(typedInvalidNavigation)
  return null
}

function TypedNavigationCommonFieldsConsumer() {
  const areas = useAllowedNavigation(typedNavigation)

  for (const area of Object.values(areas)) {
    const title: string | undefined = area.title
    const backHref: string | undefined = area.backHref
    const direction: 'left' | 'right' | undefined = area.direction

    for (const group of area.children) {
      const name: string | undefined = group.name

      for (const item of group.children) {
        const label: string | undefined = item.label
        const href: string = item.href
        const exact: boolean | undefined = item.exact
        const rightContent: React.ReactNode = item.rightContent

        void [label, href, exact, rightContent]
      }

      void name
    }

    void [title, backHref, direction]
  }

  return null
}

function TypedSnapshotPermissionsConsumer() {
  const snapshot = typedClient.useAuthzSnapshot()
  const context = typedClient.useAuthz()
  const orderPermissions: Array<'read' | 'create' | 'update' | 'delete' | '*'> | undefined =
    snapshot?.permissions.order
  const adminPermissions: Array<'*'> | undefined = snapshot?.permissions['*']
  const invoicePermissions: Array<'read' | 'export' | '*'> | undefined =
    context.snapshot?.permissions.invoice
  const settingsPermissions: Array<'manage' | '*'> | undefined = snapshot?.permissions.settings

  // @ts-expect-error customer is not in the permission catalog.
  const unknownPermissions = snapshot?.permissions.customer
  // @ts-expect-error settings only supports manage.
  const invalidSettingsPermissions: Array<'delete'> | undefined = snapshot?.permissions.settings

  void [
    orderPermissions,
    adminPermissions,
    invoicePermissions,
    settingsPermissions,
    unknownPermissions,
    invalidSettingsPermissions,
  ]

  return null
}

void [
  typedClient,
  typedCanProps,
  typedUseCanPermissions,
  typedUseCanWildcardPermissions,
  typedCanPropsInvalidAction,
  typedUseCanPermissionsInvalidResource,
  typedUseCanPermissionsInvalidGlobalWildcard,
  TypedInvalidNavigationConsumer,
  TypedNavigationCommonFieldsConsumer,
  TypedSnapshotPermissionsConsumer,
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
      roleArea: {
        path: '/role-area',
        label: 'Role area',
        roles: ['orders_manager', 'admin'],
        match: 'any',
      },
      strictRoleArea: {
        path: '/strict-role-area',
        label: 'Strict role area',
        roles: ['orders_manager', 'admin'],
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
    expect(screen.queryByText('Role area')).not.toBeNull()
    expect(screen.queryByText('Strict role area')).toBeNull()
  })

  it('filters typed navigation areas and preserves item metadata', () => {
    function OrdersIcon() {
      return null
    }

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
      account: {
        path: '/account',
        label: 'Account',
      },
    })

    const navigation = defineNavigation(routes, {
      default: {
        direction: 'left',
        children: [
          {
            name: 'General',
            children: [
              { route: 'orders', icon: OrdersIcon },
              { route: 'settings', icon: 'settings-icon', exact: true },
            ],
          },
        ],
      },
      userSettings: {
        title: 'Settings',
        backRoute: 'orders',
        direction: 'right',
        children: [
          {
            name: 'Account',
            children: [{ route: 'account', icon: 'account-icon', exact: true }],
          },
        ],
      },
    })

    function Sidebar() {
      const areas = useAllowedNavigation(navigation)
      const defaultItems = areas.default.children.flatMap((group) => group.children)
      const accountItems = areas.userSettings.children.flatMap((group) => group.children)

      return (
        <nav>
          <span>default-groups:{areas.default.children.length}</span>
          {defaultItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              data-icon={item.icon === OrdersIcon ? 'orders' : ''}
            >
              {item.label as string}
            </a>
          ))}
          {accountItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label as string}
            </a>
          ))}
        </nav>
      )
    }

    const { container } = render(
      <AuthzProvider snapshot={snapshot}>
        <Sidebar />
      </AuthzProvider>
    )

    const nav = container.querySelector('nav')

    expect(nav?.textContent).toContain('default-groups:1')
    expect(nav?.textContent).toContain('Orders')
    expect(nav?.querySelector('[data-icon="orders"]')?.textContent).toBe('Orders')
    expect(nav?.textContent).not.toContain('Settings')
    expect(nav?.textContent).toContain('Account')
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
