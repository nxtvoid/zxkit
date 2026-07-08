---
'@zxkit/authz': minor
---

Add opt-in `auth.returnTo` to `createAuthzProxy`. When enabled, an unauthenticated user redirected to `signIn` keeps the requested path as a query param (`?callbackUrl=<path>` by default, or a custom name via a string). A signed-in user hitting a `guestOnly` route is then redirected to the validated `returnTo` target instead of `afterSignIn`. Only applied on the no-session (`UNAUTHORIZED`) redirect, not on `FORBIDDEN`, and the target is validated as an internal path to prevent open redirects (protocol-relative, encoded tab/newline, backslash, and dot-segment tricks are all rejected). Also exports `sanitizeReturnTo` from `@zxkit/authz/next` so sign-in pages can validate the query param with the same rules before passing it to their auth library.
