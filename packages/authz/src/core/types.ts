export type Awaitable<T> = T | Promise<T>

export type PermissionInput = Record<string, readonly string[] | string[]>

export type Permissions = Record<string, string[]>

export type PermissionRequirement<TCatalog extends PermissionInput = PermissionInput> =
  string extends keyof TCatalog
    ? PermissionInput
    : {
        [TResource in keyof TCatalog]?:
          | Array<Extract<TCatalog[TResource][number], string>>
          | readonly Extract<TCatalog[TResource][number], string>[]
      }

export type AuthzUser = {
  id: string
  [key: string]: unknown
}

export type AuthzSession<TUser extends AuthzUser = AuthzUser> = {
  user: TUser
  [key: string]: unknown
}

export type AuthzRole = {
  id: string
  name: string
  label?: string | null
  description?: string | null
  permissions: PermissionInput
}

export type AuthzMutationCode =
  | 'ROLE_ALREADY_EXISTS'
  | 'ROLE_CREATE_FAILED'
  | 'ROLE_ASSIGNMENT_ALREADY_EXISTS'
  | 'ROLE_ASSIGNMENT_FAILED'
  | 'CACHE_INVALIDATION_FAILED'

export type AuthzMutationResult = {
  success: boolean
  message: string
  code?: AuthzMutationCode
}

export type AuthzRoleResult = AuthzMutationResult & {
  role: AuthzRole | null
}

export type AuthzSnapshot<TUser extends AuthzUser = AuthzUser> = {
  user: TUser
  roles: string[]
  permissions: Permissions
}

export type AuthzAdapter<TUser extends AuthzUser = AuthzUser> = {
  getUserRoles: (input: { userId: string; user: TUser }) => Awaitable<AuthzRole[]>
  listRoles: () => Awaitable<AuthzRole[]>
  createRole: (input: {
    name: string
    label?: string | null
    description?: string | null
    permissions: PermissionInput
  }) => Awaitable<AuthzRole>
  updateRole: (
    roleId: string,
    input: {
      name?: string
      label?: string | null
      description?: string | null
      permissions?: PermissionInput
    }
  ) => Awaitable<AuthzRole>
  deleteRole: (roleId: string) => Awaitable<void>
  assignRole: (input: { userId: string; roleId: string }) => Awaitable<void>
  removeRole: (input: { userId: string; roleId: string }) => Awaitable<void>
  listUserIdsByRole?: (roleId: string) => Awaitable<string[]>
}

export type AuthzCache = {
  get: <T>(key: string) => Awaitable<T | null>
  set: <T>(key: string, value: T, options?: { ttl?: number }) => Awaitable<void>
  delete: (key: string) => Awaitable<void>
  deleteMany?: (keys: string[]) => Awaitable<void>
  clearNamespace?: (namespace: string) => Awaitable<void>
}

export type AuthzRoute<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
  TCatalog extends PermissionInput = PermissionInput,
> = TMeta & {
  path: string
  permissions?: PermissionRequirement<TCatalog>
  roles?: readonly string[]
}
