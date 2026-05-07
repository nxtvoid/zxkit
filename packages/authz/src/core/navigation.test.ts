import { describe, expect, it } from 'vitest'
import {
  defineNavigation,
  getAllowedNavigation,
  getCurrentNavigationNode,
  getNavigationBreadcrumb,
} from './navigation'
import { defineRoutes } from './routes'
import type { AuthzSnapshot } from './types'

const routes = defineRoutes({
  hub: {
    path: '/hub',
    label: 'Home',
  },
  orders: {
    path: '/hub/orders',
    label: 'Orders',
    permissions: { order: ['read'] },
  },
  invoices: {
    path: '/hub/invoices',
    label: 'Invoices',
    permissions: { invoice: ['read'] },
  },
  settings: {
    path: '/hub/settings',
    label: 'Settings',
    permissions: { settings: ['manage'] },
  },
})

defineRoutes({
  invalid: {
    path: '/invalid',
    // @ts-expect-error exact is navigation/UI metadata, not route metadata.
    exact: true,
  },
})

defineRoutes({
  invalid: {
    path: '/invalid-permissions',
    // @ts-expect-error permissions must be a resource-to-actions map.
    permissions: 'order:read',
  },
})

function OrdersIcon() {
  return null
}

const navigation = defineNavigation(routes, {
  default: {
    direction: 'left',
    children: [
      {
        name: 'General',
        children: [
          { route: 'hub', icon: 'dashboard', exact: false },
          { route: 'orders', icon: OrdersIcon },
          { route: 'settings', icon: 'settings' },
        ],
      },
      {
        name: 'Empty after filtering',
        children: [{ route: 'invoices', icon: 'invoice' }],
      },
    ],
  },
  flat: {
    children: [
      { route: 'hub', icon: 'dashboard' },
      { route: 'settings', icon: 'settings' },
    ],
  },
  nested: {
    children: [
      {
        name: 'Admin',
        children: [
          {
            name: 'Deep',
            children: [{ route: 'settings', icon: 'settings' }],
          },
        ],
      },
      {
        name: 'Visible',
        children: [{ route: 'orders', icon: 'orders' }],
      },
    ],
  },
})

defineNavigation(routes, {
  default: {
    children: [
      {
        children: [
          // @ts-expect-error unknown is not a route key.
          { route: 'unknown', icon: 'missing' },
        ],
      },
    ],
  },
})

const snapshot: AuthzSnapshot = {
  user: { id: 'user-1' },
  roles: ['orders_manager'],
  permissions: {
    order: ['read'],
  },
}

describe('navigation helpers', () => {
  it('filters a navigation tree and keeps UI metadata', () => {
    const allowedNavigation = getAllowedNavigation(navigation, snapshot)

    expect(allowedNavigation.default.direction).toBe('left')
    expect(allowedNavigation.default.children).toHaveLength(1)
    expect(allowedNavigation.default.children[0]?.name).toBe('General')
    expect(allowedNavigation.default.children[0]?.children).toHaveLength(2)
    expect(allowedNavigation.default.children[0]?.children[0]).toMatchObject({
      route: 'hub',
      path: '/hub',
      href: '/hub',
      label: 'Home',
      exact: false,
      icon: 'dashboard',
    })
    expect(allowedNavigation.default.children[0]?.children[1]?.icon).toBe(OrdersIcon)
  })

  it('supports flat navigation without groups', () => {
    const allowedNavigation = getAllowedNavigation(navigation, snapshot)

    expect(allowedNavigation.flat.children.map((item) => item.route)).toEqual(['hub'])
  })

  it('removes empty nested groups', () => {
    const allowedNavigation = getAllowedNavigation(navigation, snapshot)

    expect(allowedNavigation.nested.children).toHaveLength(1)
    expect(allowedNavigation.nested.children[0]?.name).toBe('Visible')
    expect(allowedNavigation.nested.children[0]?.children[0]?.route).toBe('orders')
  })

  it('returns public navigation when no snapshot exists', () => {
    const allowedNavigation = getAllowedNavigation(navigation, null)

    expect(allowedNavigation.default.children).toHaveLength(1)
    expect(allowedNavigation.default.children[0]?.children.map((item) => item.route)).toEqual([
      'hub',
    ])
  })

  it('returns the current allowed breadcrumb for a pathname', () => {
    const breadcrumb = getNavigationBreadcrumb(navigation, '/hub/orders/123?tab=details', snapshot)
    const current = getCurrentNavigationNode(navigation, '/hub/orders/123', snapshot)

    expect(breadcrumb.map((item) => item.name ?? item.label)).toEqual(['General', 'Orders'])
    expect(breadcrumb.every((item) => !('children' in item))).toBe(true)
    expect(current).toMatchObject({
      route: 'orders',
      href: '/hub/orders',
      icon: OrdersIcon,
    })
    expect(current).not.toHaveProperty('children')
  })

  it('falls back to allowed ancestors without leaking unauthorized entries', () => {
    const breadcrumb = getNavigationBreadcrumb(navigation, '/hub/settings', snapshot)
    const current = getCurrentNavigationNode(navigation, '/hub/settings', snapshot)

    expect(breadcrumb.map((item) => item.name ?? item.label)).toEqual(['General', 'Home'])
    expect(current).toMatchObject({
      route: 'hub',
      href: '/hub',
    })
    expect(current).not.toHaveProperty('children')
  })

  it('returns empty breadcrumb and null node for unmatched pathname', () => {
    const breadcrumb = getNavigationBreadcrumb(navigation, '/not-found', snapshot)
    const current = getCurrentNavigationNode(navigation, '/not-found', snapshot)

    expect(breadcrumb).toEqual([])
    expect(current).toBeNull()
  })

  it('matches dynamic route segments in breadcrumb', () => {
    const dynamicRoutes = defineRoutes({
      orders: { path: '/orders', label: 'Orders' },
      orderDetails: { path: '/orders/:id', label: 'Order details' },
    })

    const dynamicNavigation = defineNavigation(dynamicRoutes, {
      default: {
        children: [
          {
            name: 'Sales',
            children: [{ route: 'orders' }, { route: 'orderDetails' }],
          },
        ],
      },
    })

    const breadcrumb = getNavigationBreadcrumb(dynamicNavigation, '/orders/123', null)
    const current = getCurrentNavigationNode(dynamicNavigation, '/orders/123', null)

    expect(breadcrumb.map((item) => item.name ?? item.label)).toEqual(['Sales', 'Order details'])
    expect(current).toMatchObject({ href: '/orders/:id', label: 'Order details' })
    expect(current).not.toHaveProperty('children')
  })
})
