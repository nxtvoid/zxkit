import { describe, expect, it, vi } from 'vitest'
import { prismaAuthzAdapter } from './prisma.js'

describe('prismaAuthzAdapter', () => {
  it('maps Prisma role records to the authz adapter contract', async () => {
    const db = {
      authzRole: {
        findMany: vi.fn(async () => [
          {
            id: 'role-orders',
            name: 'orders_viewer',
            permissions: { order: ['read'] },
          },
        ]),
        create: vi.fn(async ({ data }) => ({
          id: 'role-created',
          ...data,
        })),
        update: vi.fn(async ({ where, data }) => ({
          id: where.id,
          name: data.name ?? 'orders_viewer',
          permissions: data.permissions ?? {},
        })),
        delete: vi.fn(async () => ({})),
      },
      authzUserRole: {
        findMany: vi.fn(async () => [
          {
            userId: 'user-1',
            role: {
              id: 'role-orders',
              name: 'orders_viewer',
              permissions: { order: ['read'] },
            },
          },
        ]),
        create: vi.fn(async () => ({})),
        delete: vi.fn(async () => ({})),
      },
    }
    const adapter = prismaAuthzAdapter(db)

    await expect(
      adapter.getUserRoles({ userId: 'user-1', user: { id: 'user-1' } })
    ).resolves.toEqual([
      {
        id: 'role-orders',
        name: 'orders_viewer',
        permissions: { order: ['read'] },
      },
    ])

    await adapter.assignRole({ userId: 'user-1', roleId: 'role-orders' })
    await adapter.removeRole({ userId: 'user-1', roleId: 'role-orders' })

    expect(db.authzUserRole.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', roleId: 'role-orders' },
    })
    expect(db.authzUserRole.delete).toHaveBeenCalledWith({
      where: { userId_roleId: { userId: 'user-1', roleId: 'role-orders' } },
    })
  })
})
