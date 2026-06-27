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

  const normalizedRequired = normalizePermissions(required)
  const globalActions = owned['*'] ?? []

  if (globalActions.includes('*')) {
    return true
  }

  return Object.entries(normalizedRequired).every(([resource, actions]) => {
    const ownedActions = owned[resource] ?? []

    if (ownedActions.includes('*')) {
      return true
    }

    // A resource listed with no actions still requires some access to it;
    // otherwise a typo like `{ order: [] }` would silently grant everyone.
    if (actions.length === 0) {
      return ownedActions.length > 0
    }

    return actions.every((action) => ownedActions.includes(action))
  })
}

// Returns the subset of `required` the owner does NOT have, keyed by resource.
// An empty object means every requirement is satisfied. Mirrors hasPermissions
// (wildcards, empty-action-array semantics) so the two never disagree. Useful
// for richer 403 messages and audit logs instead of a bare boolean.
export function getMissingPermissions(
  owned: PermissionInput,
  required: PermissionInput | undefined
): Permissions {
  if (!required || Object.keys(required).length === 0) {
    return {}
  }

  const normalizedRequired = normalizePermissions(required)
  const globalActions = owned['*'] ?? []

  if (globalActions.includes('*')) {
    return {}
  }

  const missing: Permissions = {}

  for (const [resource, actions] of Object.entries(normalizedRequired)) {
    const ownedActions = owned[resource] ?? []

    if (ownedActions.includes('*')) {
      continue
    }

    if (actions.length === 0) {
      if (ownedActions.length === 0) {
        missing[resource] = []
      }
      continue
    }

    const missingActions = actions.filter((action) => !ownedActions.includes(action))

    if (missingActions.length > 0) {
      missing[resource] = missingActions
    }
  }

  return missing
}

// Keeps the items whose required permissions the owner satisfies. The selector
// maps an item to its requirement; items that map to undefined always pass.
export function filterByPermission<TItem>(
  owned: PermissionInput,
  items: readonly TItem[],
  select: (item: TItem) => PermissionInput | undefined
): TItem[] {
  return items.filter((item) => hasPermissions(owned, select(item)))
}
