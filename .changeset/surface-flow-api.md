---
'@zxkit/surface': minor
---

Add `flow()` for multi-step modals.

Replacing one modal with another swaps the component React renders at that position. Because the two are different component types, React tears the outgoing subtree down — including the `Content` it rendered — and mounts a fresh one. The new panel mounts already open, so the primitive replays its entrance while the overlay stays put, which reads as a flash.

`flow()` renders the `Wrapper` and `Content` once and swaps only the step below them, so the panel never unmounts:

```tsx
const steps = { plan: PlanStep, payment: PaymentStep, done: DoneStep }

createPushModal({
  modals: {
    Checkout: flow<boolean>()({
      Content: DynamicContent,
      initial: 'plan',
      steps,
    }),
  },
})

pushModal('Checkout', { plan: 'pro' })
```

Steps render the body only, and their props are inferred from the component the same way `modal()` does it. Pushing the flow takes the props of its initial step, and `pushModalAsync` resolves the flow's result type.

`Wrapper` is optional and falls back to `defaultWrapper`, like a `modal()` entry. `Content` is required, since there is no `defaultContent`.

`useFlowControls()` drives it from inside a step — `go`, `replaceStep`, `back`, `reset`, plus `step` and `canGoBack`. Pass the steps object as a type argument to have step names and props checked. `useModalControls()` still works inside a step, so any step can close or resolve the whole flow; its `replace()` swaps the whole modal, which is why the step-level move is named `replaceStep`.

Replacing a flow restarts it at `initial`, whether the incoming modal is a different flow or the same one under new props.

Additive: `replace` and `replaceWithModal` are unchanged, and remain the right tool when the next modal genuinely supersedes the current one.
