---
'@zxkit/authz': patch
---

Fix cache invalidation inconsistencies, error message leaks, and performance issues in `@zxkit/authz`.

- `removeRole` now returns `AuthzMutationResult` and handles cache errors consistently with `assignRole`
- `updateRole` and `deleteRole` no longer propagate cache invalidation failures; they log a warning and continue
- `invalidateRole` warns explicitly when neither `adapter.listUserIdsByRole` nor `cache.clearNamespace` is available, preventing silent no-ops
- `ROLE_CREATE_FAILED`, `ROLE_ASSIGNMENT_FAILED`, and `CACHE_INVALIDATION_FAILED` messages no longer expose internal adapter or cache error details
- `getSnapshot` deduplicates concurrent requests for the same user to avoid thundering herd on cache miss
- `hasPermissions` no longer normalizes already-deduplicated snapshot permissions on every call
- `memoryCache` now purges expired entries every 60 seconds to prevent unbounded memory growth
- `patternToRegex` caches compiled `RegExp` instances to avoid recompilation on every middleware request
