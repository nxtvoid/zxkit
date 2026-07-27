---
'@zxkit/surface': minor
---

Let a flow be opened at a step other than its registered `initial`.

`initial` was fixed at registration, so a flow reachable from several places always opened on the same screen. Pass a step name before the props to enter somewhere else:

```tsx
pushModal('AppMenu') // the registered initial
pushModal('AppMenu', 'bookmarks') // opens on that step
pushModal('Checkout', 'payment', { amount: 24 })
```

The step is positional rather than a field on the props object, so it cannot collide with a prop name, and the props that follow are checked against the step being entered instead of the initial one. `replaceWithModal` and a handle's `replace` accept the same form, and an unknown step name is reported like an unknown modal is.

The step a flow is opened at becomes the bottom of its stack: `canGoBack` is `false` there and `reset()` returns to it.

Additive — pushing a flow with only its initial step's props works exactly as before.
