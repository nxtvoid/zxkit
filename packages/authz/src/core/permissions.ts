import type { PermissionInput, Permissions } from './types'

export function definePermissions<const TPermissions extends PermissionInput>(
  permissions: TPermissions
) {
  return permissions
}

export function normalizePermissions(input: PermissionInput = {}): Permissions {
  return Object.fromEntries(
    Object.entries(input).map(([resource, actions]) => [resource, [...new Set(actions)]])
  )
}

export function mergePermissions(...entries: PermissionInput[]): Permissions {
  const merged = new Map<string, Set<string>>()

  for (const entry of entries) {
    for (const [resource, actions] of Object.entries(entry)) {
      const current = merged.get(resource) ?? new Set<string>()

      for (const action of actions) {
        current.add(action)
      }

      merged.set(resource, current)
    }
  }

  return Object.fromEntries(
    [...merged.entries()].map(([resource, actions]) => [resource, [...actions]])
  )
}

export function hasPermissions(owned: PermissionInput, required: PermissionInput | undefined) {
  if (!required || Object.keys(required).length === 0) {
    return true
  }

  const normalizedOwned = normalizePermissions(owned)
  const normalizedRequired = normalizePermissions(required)
  const globalActions = normalizedOwned['*'] ?? []

  if (globalActions.includes('*')) {
    return true
  }

  return Object.entries(normalizedRequired).every(([resource, actions]) => {
    const ownedActions = normalizedOwned[resource] ?? []

    if (ownedActions.includes('*')) {
      return true
    }

    return actions.every((action) => ownedActions.includes(action))
  })
}
