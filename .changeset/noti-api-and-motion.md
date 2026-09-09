---
'@zxkit/noti': major
---

Give each notification an invocation id and add targeted `update` and `loading` methods while retaining one visual island. Add optional priority and per-state defaults, asynchronous action feedback with retry protection, persistent expansion timing, full titles in expanded cards, and Escape dismissal.

Add `cancelButton` and `keepExpanded` for persistent, two-action notifications. Both actions share pending protection, and removed controls release stale focus pauses.

Migration: ids are no longer shared, close buttons are enabled by default, loading details can expand, titles retain their supplied casing, and dismissal reasons include `escape`. See the README for configuration and migration examples.
