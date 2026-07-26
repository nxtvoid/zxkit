---
'@zxkit/surface': patch
---

Name the modal when it is not registered, instead of leaking an internal lookup error.

`pushModal('TestSheet')` with no such entry reached the registry lookup and failed with `Cannot use 'in' operator to search for '__flow' in undefined`, which says nothing about what the caller did. It now throws:

```
Modal "TestSheet" is not registered with createPushModal. Known modals, closest first: TestModal, AppMenuSheet.
```

Names are ranked by how close they look to the one that missed — a shared stem or a casing-only slip floats to the front — and the list is capped at eight with a `+N more` count, so a registry with hundreds of entries does not bury the message. Flow step errors read the same way.

Checked on every way into the stack — `pushModal`, `pushModalAsync`, `replaceWithModal`, a handle's `replace`, and `useModalControls().replace` — so the error is raised at the call site rather than during a later render.

Worth the runtime check even though most of those are typed: `useModalControls()` cannot know which registry it is inside, so its `replace` is the one path where a typo compiles cleanly.
