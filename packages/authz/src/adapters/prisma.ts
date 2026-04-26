import type { AuthzAdapter, AuthzRole, PermissionInput } from '../core/types'

type PrismaRoleRecord = {
  id: string
  name: string
  label?: string | null
  description?: string | null
  permissions: unknown
}

type PrismaFindManyArgs = {
  where?: Record<string, unknown>
  include?: Record<string, unknown>
  select?: Record<string, unknown>
}

type PrismaRoleCreateArgs = {
  data: {
    name: string
    label?: string | null
    description?: string | null
    permissions: PermissionInput
  }
}

type PrismaRoleUpdateArgs = {
  where: { id: string }
  data: {
    name?: string
    label?: string | null
    description?: string | null
    permissions?: PermissionInput
  }
}

type PrismaRoleDeleteArgs = {
  where: { id: string }
}

type PrismaUserRoleCreateArgs = {
  data: { userId: string; roleId: string }
}

type PrismaUserRoleDeleteArgs = {
  where: {
    userId_roleId: { userId: string; roleId: string }
  }
}

type PrismaAuthzDb = {
  authzRole: {
    findMany: (args?: PrismaFindManyArgs) => Promise<PrismaRoleRecord[]>
    create: (args: PrismaRoleCreateArgs) => Promise<PrismaRoleRecord>
    update: (args: PrismaRoleUpdateArgs) => Promise<PrismaRoleRecord>
    delete: (args: PrismaRoleDeleteArgs) => Promise<unknown>
  }
  authzUserRole: {
    findMany: (
      args?: PrismaFindManyArgs
    ) => Promise<Array<{ userId: string; role?: PrismaRoleRecord }>>
    create: (args: PrismaUserRoleCreateArgs) => Promise<unknown>
    delete: (args: PrismaUserRoleDeleteArgs) => Promise<unknown>
  }
}

function toRole(record: PrismaRoleRecord): AuthzRole {
  return {
    id: record.id,
    name: record.name,
    label: record.label,
    description: record.description,
    permissions: (record.permissions ?? {}) as PermissionInput,
  }
}

export function prismaAuthzAdapter(db: PrismaAuthzDb): AuthzAdapter {
  return {
    async getUserRoles({ userId }) {
      const rows = await db.authzUserRole.findMany({
        where: { userId },
        include: { role: true },
      })

      return rows.flatMap((row) => (row.role ? [toRole(row.role)] : []))
    },
    async listRoles() {
      return (await db.authzRole.findMany()).map(toRole)
    },
    async createRole(input) {
      return toRole(
        await db.authzRole.create({
          data: input,
        })
      )
    },
    async updateRole(roleId, input) {
      return toRole(
        await db.authzRole.update({
          where: { id: roleId },
          data: input,
        })
      )
    },
    async deleteRole(roleId) {
      await db.authzRole.delete({
        where: { id: roleId },
      })
    },
    async assignRole(input) {
      await db.authzUserRole.create({
        data: input,
      })
    },
    async removeRole(input) {
      await db.authzUserRole.delete({
        where: {
          userId_roleId: input,
        },
      })
    },
    async listUserIdsByRole(roleId) {
      const rows = await db.authzUserRole.findMany({
        where: { roleId },
        select: { userId: true },
      })

      return rows.map((row) => row.userId)
    },
  }
}
