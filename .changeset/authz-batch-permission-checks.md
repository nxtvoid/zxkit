---
'@zxkit/authz': minor
---

Add batch/OR checks, scoped authorization, route protection, audit hooks, and catalog validation. All snapshot-bound helpers resolve the snapshot a single time.

- Batch & OR: `canEach` (keyed batch), `canAny` / `requireAny` (OR), `canAll` (AND over a dynamic list), `hasRoleEach` (keyed role batch), `missingPermissions`, and `filterByPermission`. Client parallels `useCanEach`, `useCanAny`, `useHasRoleEach`, plus an `any` prop on `<Can>`.
- `authorize()` resolves one snapshot and returns synchronous checkers (`can`, `canAny`, `canAll`, `hasRole`, `missingPermissions`, `when`), ideal for a server action running several conditional Prisma queries. `when(req, run, fallback?)` runs work only when allowed.
- `protectRoute(route, handler)` gates a handler on a `defineRoutes` route, mirroring `protect` / `protectRole` / `protectAuth`.
- Audit hooks: `onDenied` / `onGranted` on `createAuthz` observe throwing guards (`kind`: `permission` | `role` | `route` | `auth`); non-throwing checks stay silent and hook errors never propagate.
- `validateRolePermissions(role)` flags stored permissions outside the code catalog (catalog-drift detection). `listPermissions()` returns the current permission map.
- Exported `Authz<TUser, TPermissions>` instance type and `getMissingPermissions` / `filterByPermission` core utilities.
