import type { AuthzRole, AuthzSnapshot, AuthzUser } from './types'
import { mergePermissions } from './permissions'

export function createSnapshot<TUser extends AuthzUser>(
  user: TUser,
  roles: readonly AuthzRole[]
): AuthzSnapshot<TUser> {
  return {
    user,
    roles: roles.map((role) => role.name),
    permissions: mergePermissions(...roles.map((role) => role.permissions)),
  }
}

export function createSnapshotKey(userId: string) {
  return `authz:user:${userId}:snapshot`
}

export const SNAPSHOT_NAMESPACE = 'authz:user:'
