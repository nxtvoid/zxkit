# Changelog

## 2.1.0

### Minor Changes

- 9322af3: Let a flow be opened at a step other than its registered `initial`.

  `initial` was fixed at registration, so a flow reachable from several places always opened on the same screen. Pass a step name before the props to enter somewhere else:

  ```tsx
  pushModal('AppMenu') // the registered initial
  pushModal('AppMenu', 'bookmarks') // opens on that step
  pushModal('Checkout', 'payment', { amount: 24 })
  ```

  The step is positional rather than a field on the props object, so it cannot collide with a prop name, and the props that follow are checked against the step being entered instead of the initial one. `replaceWithModal` and a handle's `replace` accept the same form, and an unknown step name is reported like an unknown modal is.

  The step a flow is opened at becomes the bottom of its stack: `canGoBack` is `false` there and `reset()` returns to it.

  Additive — pushing a flow with only its initial step's props works exactly as before.

## 2.0.0

### Major Changes

- b7fea37: Remove all coupling to specific primitive and form libraries.

  `surface` no longer depends on `radix-ui`, and `react-hook-form` is no longer required to use the package. The root entry now has React as its only required peer, so it can be used in a Base UI, React Aria, Radix, or custom-primitive project without pulling a second dialog library into the tree.

  **Breaking: modals without a `Wrapper` need a `defaultWrapper`**

  Previously these fell back to Radix's `Dialog.Root`. Now the primitive is supplied by the app:

  ```diff
  +import { Dialog } from 'radix-ui' // or Base UI, React Aria, your own

   createPushModal({
  +  defaultWrapper: Dialog.Root,
     modals: {
       Confirm: modal<Record<never, never>>(ConfirmModal),
     },
   })
  ```

  A modal with neither a `Wrapper` nor a `defaultWrapper` now throws an explicit error instead of rendering. Modals that already declare their own `Wrapper` are unaffected.

  **Breaking: `usePreservedForm` moved to `@zxkit/surface/react-hook-form`**

  `createResponsiveWrapper` now returns `usePreservedStore` instead of `usePreservedForm`. Compose the react-hook-form integration yourself:

  ```diff
  -import { createResponsiveWrapper } from '@zxkit/surface'
  +import { createResponsiveWrapper } from '@zxkit/surface'
  +import { createPreservedForm } from '@zxkit/surface/react-hook-form'

  -export const { Wrapper, Content, usePreservedState, usePreservedForm } =
  +export const { Wrapper, Content, usePreservedState, usePreservedStore } =
     createResponsiveWrapper({ desktop, mobile })
  +
  +export const usePreservedForm = createPreservedForm(usePreservedStore)
  ```

  Behavior is unchanged, including the `isDirty` baseline after a Dialog ↔ Drawer swap. To support another form library, implement the equivalent of `createPreservedForm` against `usePreservedStore`.

  **Breaking: `modal()` infers props instead of taking them as a type argument**

  `modal<Props>(...)` could not infer `Props` reliably, because it inferred against `React.ComponentType<Props>` — a union, which TypeScript infers poorly. Every entry had to restate the props by hand. `modal()` now captures the component and reads the props off it:

  ```diff
  -DefaultExample: modal<Record<never, never>>(DefaultModalExample),
  -EditOrder: modal<React.ComponentProps<typeof EditOrderModal>>({
  -  Wrapper: DynamicWrapper,
  -  Component: EditOrderModal,
  -}),
  -Confirm: modal<React.ComponentProps<typeof ConfirmModal>, boolean>(ConfirmModal),
  +DefaultExample: modal(DefaultModalExample),
  +EditOrder: modal({ Wrapper: DynamicWrapper, Component: EditOrderModal }),
  +Confirm: modal<boolean>()(ConfirmModal),
  ```

  Migration is deletion: drop the props type argument. Where a result type was declared, move to the curried form `modal<Result>()(...)` — currying is required because TypeScript cannot infer one type argument while another is supplied explicitly.

  This also moves errors to where the mistake is written. Passing a component type where props belong — `modal<React.ComponentType<typeof X>>(X)` — used to compile and then fail at the `pushModal` call site with a confusing arity error. It is now rejected at the registry entry.

  **Fix: modals whose props are all optional no longer demand an argument**

  `ModalArgs` only dropped the props argument when the modal had _no_ props. A component typed `({ text }: { text?: number })` has a non-`never` `keyof`, so `pushModal('Name')` failed with `Expected 2 arguments, but got 1` even though there was nothing to pass. The argument is now optional when every prop is optional, and still required when any prop is required. This also covers components that resolve to `any` — a broken path alias no longer produces a spurious required argument.

  **Breaking: ESM only**

  The package is now built with `tsdown`, matching the other packages in this repo, and ships ESM only — `dist/*.mjs` with `dist/*.d.mts`. The CommonJS output and the `require` export condition are gone, so `require('@zxkit/surface')` no longer works. Consumers on bundlers or modern Node are unaffected; a CJS codebase needs a dynamic `import()`.

  `'use client'` is preserved on the module that needs it, and `mitt` is now an external import rather than inlined, so it dedupes with any copy the consumer already has.

  **Also**
  - `ModalWrapperProps` is now exported, for typing adapters over primitives whose prop names differ.
  - `defaultWrapper` accepts any wrapper, including one returned by `createResponsiveWrapper`. Making the common wrapper the default removes the repeated per-modal `Wrapper:` line.
  - `ContentProps` no longer names Radix-specific callbacks (`onPointerDownOutside`, `onOpenAutoFocus`, and friends); they still pass through the index signature.

### Minor Changes

- b7fea37: Add `flow()` for multi-step modals.

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

### Patch Changes

- b7fea37: Fix modals mounting already open, which skipped the enter animation on some primitives.

  A pushed modal does not exist until it is pushed, so the wrapper's very first render had `open: true`. Primitives that read their entrance off a CSS animation are unaffected — Radix's `data-[state=open]:animate-in` replays on mount. Primitives that read it off the open _transition_ are not: Base UI seeds its internal `mounted` state from `open`, so its `open && !mounted` check never fired, no `data-starting-style` was applied, and the panel appeared with no entrance while the exit still animated.

  The wrapper is now handed one closed render before being opened, so it observes the `false → true` transition a hand-controlled root would give it. The flip runs in a layout effect, not an animation frame, so React commits both renders before the browser paints: no blank frame, no added latency, and the modal is still in the DOM synchronously.

  Replacing a modal keeps the wrapper open, so a replace does not blink it shut or replay the entrance.

- 07e42a2: Stop re-rendering every open modal when the stack changes.

  The provider rebuilds on every push, pop and replace, and each modal's controls value was constructed inline, so every open modal re-rendered with it — a stack of ten cost ten renders per push, and every `useModalControls()` consumer re-rendered along with it. Each instance is now a memoised component with its controls held stable, so a push renders only the modal being pushed.

  `useOnPushModal` and `useOnCloseModal` held the callback in their effect dependencies, so an inline callback — the usual way to write one — tore down and re-registered the listener on every render of the consumer. The callback is now held in a ref: one subscription per name, and the latest callback still runs.

- b7fea37: Name the modal when it is not registered, instead of leaking an internal lookup error.

  `pushModal('TestSheet')` with no such entry reached the registry lookup and failed with `Cannot use 'in' operator to search for '__flow' in undefined`, which says nothing about what the caller did. It now throws:

  ```
  Modal "TestSheet" is not registered with createPushModal. Known modals, closest first: TestModal, AppMenuSheet.
  ```

  Names are ranked by how close they look to the one that missed — a shared stem or a casing-only slip floats to the front — and the list is capped at eight with a `+N more` count, so a registry with hundreds of entries does not bury the message. Flow step errors read the same way.

  Checked on every way into the stack — `pushModal`, `pushModalAsync`, `replaceWithModal`, a handle's `replace`, and `useModalControls().replace` — so the error is raised at the call site rather than during a later render.

  Worth the runtime check even though most of those are typed: `useModalControls()` cannot know which registry it is inside, so its `replace` is the one path where a typo compiles cleanly.

## 1.1.1

### Patch Changes

- Refine the typed modal API with better modal registry inference and safer instance handles for async and replace flows.

## 1.1.0

### Minor Changes

- Add typed modal definitions with `modal(...)`, async modal results with `pushModalAsync`, instance controls through `useModalControls`, and smoother instance-based modal replacement flows.

## 1.0.3

### Patch Changes

- Fix modal stack closing for multiple instances of the same modal and clean published package output.

## 1.0.2 - 2026-02-27

### Minor Changes

- **fix: resolve TS2742 portability errors in declaration emit**

## 1.0.1 - 2026-02-27

### Minor Changes

- fix type error in usePreservedForm

## [1.0.0] - 2026-02-25

### Added

- Initial release of `@zxkit/surface`
- `createResponsiveWrapper` for responsive Dialog/Drawer (SHADCN only)
- `usePreservedState` and `usePreservedForm` for state preservation
- `createPushModal` for router-style modal stack
- Full integration between both systems
- Initial documentation
