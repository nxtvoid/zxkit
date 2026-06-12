---
'@zxkit/authz': major
---

Security and correctness hardening, result-object role mutations, and resilient cache handling.

**Breaking changes**

- `updateRole` now returns `AuthzRoleResult` (`{ success, message, code?, role }`) and `deleteRole` returns `AuthzMutationResult` (`{ success, message, code? }`) instead of returning the raw role / `void` and throwing adapter errors. New codes: `ROLE_NOT_FOUND`, `ROLE_UPDATE_FAILED`, `ROLE_DELETE_FAILED`. Renaming a role to an existing name reports `ROLE_ALREADY_EXISTS`. Cache invalidation failures report `CACHE_INVALIDATION_FAILED` instead of only warning.
- A permission requirement that lists a resource with an empty action array (e.g. `{ order: [] }`) now requires some access to that resource instead of always passing.

**Fixes**

- Path matching used by the Next.js proxy escapes literal `*` inside segments; `/foo*` no longer behaves as a regex quantifier.
- Proxy config rejects redirect targets starting with `/\`, which URL resolution treats as protocol-relative (external host).
- `assignRole` only reports `ROLE_ASSIGNMENT_ALREADY_EXISTS` for unique violations on the user-role assignment; unrelated unique constraint errors report `ROLE_ASSIGNMENT_FAILED`.
- `AccessDeniedError.is(error)` duck-typed check; the proxy uses it so duplicate installed copies of the package (dual-package hazard) no longer turn auth redirects into 500s.

**Improvements**

- Cache outages no longer break authorization: cache reads/writes degrade to a cache miss with throttled console logging, while invalidation failures keep surfacing as `CACHE_INVALIDATION_FAILED`. New `cacheTimeoutMs` option treats hung cache operations as failures.
- `memoryCache()` returns a `dispose()` method that stops the purge timer and clears entries (exported `MemoryCache` type).
- Shared path-pattern tokenizer in `core/path-pattern.ts` replaces two divergent matcher implementations.
- Bounded proxy regex cache.
