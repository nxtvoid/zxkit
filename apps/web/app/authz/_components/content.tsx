import { Code2, Database, GitBranch, RefreshCw, Route, ShieldCheck } from 'lucide-react'

export const permissionExample = `import { definePermissions } from '@zxkit/authz'

export const permissions = definePermissions({
  order: ['read', 'create', 'update', 'delete'],
  invoice: ['read', 'export'],
  settings: ['manage'],
})`

export const serverExample = `import { createAuthz, redisCache } from '@zxkit/authz'
import { prismaAuthzAdapter } from '@zxkit/authz/prisma'

export const authz = createAuthz({
  permissions,
  getSession,
  adapter: prismaAuthzAdapter(db),
  cache: redisCache(redis, { ttl: 60 * 30 }),
})

export const deleteOrder = authz.protect(
  { order: ['delete'] },
  async ({ user }, orderId: string) => {
    return orders.delete({ orderId, deletedBy: user.id })
  }
)`

export const clientExample = `'use client'

import { createAuthzClient } from '@zxkit/authz/client'
import { permissions } from './permissions'

export const authzClient = createAuthzClient(permissions)
export const { AuthzProvider, Can, Guard, useCan } = authzClient`

export const roleExample = `const created = await authz.createRole({
  name: 'orders_manager',
  label: 'Orders manager',
  permissions: { order: ['read', 'update'] },
})

if (created.success && created.role) {
  await authz.assignRole({
    userId,
    roleId: created.role.id,
  })
}`

export const useCases = [
  {
    title: 'Typed permissions',
    description:
      'Define resources and actions once. TypeScript completes order, invoice, settings, and rejects actions that do not exist.',
    icon: Code2,
  },
  {
    title: 'Database roles',
    description:
      'Store roles and assignments in Prisma. The permission catalog stays in code while user access changes in the database.',
    icon: Database,
  },
  {
    title: 'UI guards',
    description:
      'Use Can, Guard, and hooks from a typed client helper to hide actions without fetching again.',
    icon: ShieldCheck,
  },
  {
    title: 'Protected routes',
    description:
      'Reuse the same requirements for sidebars, server checks, and the Next.js proxy before rendering.',
    icon: Route,
  },
  {
    title: 'Invalidated cache',
    description:
      'Cache per-user snapshots with memory or Redis. Package mutations clear the affected snapshots.',
    icon: RefreshCw,
  },
  {
    title: 'Complete flow',
    description:
      'Protect server actions, create roles, assign users, and refresh the UI when permissions change.',
    icon: GitBranch,
  },
]

export const flow = [
  'Define the permission catalog with definePermissions.',
  'Create authz on the server with session, adapter, and cache.',
  'Load a snapshot and pass it to AuthzProvider.',
  'Use Can, Guard, useCan, require, and protect with the same types.',
]
