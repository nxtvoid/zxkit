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

export const { AuthzProvider, Can, Guard, useCan } =
  createAuthzClient(permissions)`

export const proxyExample = `import { createAuthzProxy } from '@zxkit/authz/next'

export const proxy = createAuthzProxy({
  authz,
  auth: { signIn: '/login', afterSignIn: '/hub', forbidden: '/hub' },
  public: ['/'],
  guestOnly: ['/login'],
  protected: [{ matcher: '/hub/:path*', routes }],
})`

export const features = [
  {
    title: 'Typed permissions',
    description: 'Resources and actions autocomplete. Invalid ones fail to compile.',
  },
  {
    title: 'Roles in your database',
    description: 'The catalog lives in code; roles and assignments live in Prisma.',
  },
  {
    title: 'Guards everywhere',
    description: 'Can, Guard, and hooks on the client. require and protect on the server.',
  },
  {
    title: 'Next.js proxy',
    description: 'Protected zones, guest-only and public routes from the same definitions.',
  },
  {
    title: 'Cached snapshots',
    description: 'Memory or Redis, invalidated on role mutations, resilient to outages.',
  },
]
