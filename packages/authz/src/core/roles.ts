export function hasMatchingRole(
  ownedRoles: readonly string[],
  requiredRoles: readonly string[] | undefined,
  match: 'all' | 'any' = 'all'
) {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true
  }

  return match === 'all'
    ? requiredRoles.every((role) => ownedRoles.includes(role))
    : requiredRoles.some((role) => ownedRoles.includes(role))
}
