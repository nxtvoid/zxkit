<p align="center">
  <img src="https://raw.githubusercontent.com/nxtvoid/zxkit/main/packages/surface/github.png" alt="surface banner" width="100%" />
</p>

<h1 align="center">@zxkit/surface</h1>

<p align="center">
  Advanced utilities for responsive dialogs and drawers in React. Bring your own primitives — Base UI, React Aria, Radix, or anything else.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zxkit/surface"><img src="https://img.shields.io/npm/v/@zxkit/surface.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@zxkit/surface"><img src="https://img.shields.io/npm/dm/@zxkit/surface.svg" alt="npm downloads" /></a>
  <a href="https://github.com/nxtvoid/zxkit/blob/main/packages/surface/LICENSE"><img src="https://img.shields.io/npm/l/@zxkit/surface.svg" alt="license" /></a>
</p>

---

## Features

- 🧩 **Primitive-agnostic** - No dialog library is bundled or assumed. You pass the components in
- 🖼️ **Responsive Wrapper** - Adapts between Dialog and Drawer based on device breakpoint
- 🧠 **State Preservation** - Keeps form/input state across device changes
- 🪄 **Automatic Cleanup** - Clears state when closed
- 🔗 **Hooks** - `usePreservedState` for persistent values, `usePreservedStore` to build your own
- 🗂️ **Modal Stack** - Push, pop, replace modals with router-like flow
- ⚡ **Event-driven** - Emits events on modal open/close
- 🪶 **One dependency** - `mitt`. React is the only required peer

## Installation

```bash
npm install @zxkit/surface
# or
yarn add @zxkit/surface
# or
pnpm add @zxkit/surface
# or
bun add @zxkit/surface
```

---

## Bring your own primitives

`surface` implements modal _orchestration_ — the stack, the async results, the responsive swap, the preserved state. It deliberately implements no dialog, and depends on none, so it does not care which primitive library you use or whether you switch later.

Anything matching this shape can host a modal:

```ts
type ModalWrapperProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  defaultOpen?: boolean
}
```

Most headless libraries already match it, so you pass the root component directly:

```tsx
// Base UI
import { Dialog } from '@base-ui/react/dialog'
createPushModal({ modals, defaultWrapper: Dialog.Root })

// Radix
import { Dialog } from 'radix-ui'
createPushModal({ modals, defaultWrapper: Dialog.Root })
```

When a library names its props differently, adapt it in your own code — no release of `surface` required:

```tsx
import { DialogTrigger } from 'react-aria-components'
import type { ModalWrapperProps } from '@zxkit/surface'

const AriaRoot = ({ open, onOpenChange, children }: ModalWrapperProps) => (
  <DialogTrigger isOpen={open} onOpenChange={onOpenChange}>
    {children}
  </DialogTrigger>
)

createPushModal({ modals, defaultWrapper: AriaRoot })
```

`defaultWrapper` is used for modals that do not declare a `Wrapper` of their own. A modal with neither throws an explicit error rather than rendering unwrapped.

### Enter animations

A pushed modal does not exist until it is pushed, so the wrapper is handed one closed render before it is opened. Primitives that read their entrance off a CSS animation (Radix's `data-[state=open]:animate-in`) do not need this, since animations replay on mount. Primitives that read it off the open _transition_ do — Base UI seeds its internal `mounted` state from `open`, so a wrapper mounted already open never gets `data-starting-style` and the panel appears with no entrance while the exit still animates.

The flip runs in a layout effect, so React commits both renders before the browser paints: no blank frame, and the modal is in the DOM synchronously. Replacing a modal does not close the wrapper, so a replace never replays the entrance.

---

## Usage Overview

### 1. `createResponsiveWrapper` (responsive.tsx)

- **Adaptive components**: Renders Dialog or Drawer depending on the breakpoint.
- **Automatic breakpoint detection**: Uses `matchMedia` and `useSyncExternalStore`.
- **Smart state preservation**: Keeps form and input state across device changes.
- **Automatic cleanup**: State is cleared when the dialog/drawer is closed.
- **Specialized hooks:**
  - `usePreservedState`: Persists value in a shared store.
  - `usePreservedStore`: Exposes the raw store so form-library integrations can be built on top.

#### Form libraries

`react-hook-form` is not a dependency of the root entry. The integration lives behind its own subpath, so projects using another form library (or none) never pull it in:

```tsx
import { createResponsiveWrapper } from '@zxkit/surface'
import { createPreservedForm } from '@zxkit/surface/react-hook-form'

export const { Wrapper, Content, usePreservedState, usePreservedStore } = createResponsiveWrapper({
  desktop: { Wrapper: Dialog, Content: DialogContent },
  mobile: { Wrapper: Drawer, Content: DrawerContent },
})

export const usePreservedForm = createPreservedForm(usePreservedStore)
```

`usePreservedForm` then behaves as before, including keeping `isDirty` measured against the original defaults after a swap. To support a different form library, write the equivalent of `createPreservedForm` against `usePreservedStore`.

#### Use case

A complex form that starts as a Drawer (mobile) and becomes a Dialog (desktop) when resizing, keeping all user input intact.

---

### 2. `createPushModal` (factory.tsx)

- **Modal stack**: Maintains a stack of open modals, like a browser.
- **LIFO operations**: `pushModal()`, `pushModalAsync()`, `popModal()`, `replaceWithModal()`.
- **Event-driven**: Emits events when modals open/close.
- **Automatic animations**: Keeps closed modals during exit animation.
- **Flexible integration**: Works with any component via custom `Wrapper`.
- **Typed modal registry**: `modal(...)` preserves prop and async result inference.
- **Instance controls**: Handles and `useModalControls()` let you close or replace a specific modal instance.

#### Use case

Modal flows (login → signup → forgot password) with natural back navigation.

---

### Integrated flow

1. `createPushModal` manages the modal stack.
2. Each modal uses `createResponsiveWrapper` to adapt to mobile/desktop.
3. When a modal closes, its state store is automatically cleared.

#### Real example

Purchase flow: cart (responsive), push to checkout (responsive), pop to return to cart without losing information.

---

## `createPushModal` API

### Why use `modal(...)`?

`modal(...)` is a small typing helper for your modal registry. It adds no runtime behavior — it reads the props off your component so `surface` can infer:

- modal props for `pushModal(...)`
- async results for `pushModalAsync(...)`
- prop-less modals that should be callable without passing `{}`

You do not write the props type. It comes from the component:

```tsx
import { createPushModal, modal } from '@zxkit/surface'

const { pushModal, pushModalAsync, ModalProvider } = createPushModal({
  defaultWrapper: Dialog.Root,
  modals: {
    // bare component
    DefaultExample: modal(DefaultModalExample),

    // component with its own wrapper
    EditOrder: modal({ Wrapper: DynamicWrapper, Component: EditOrderModal }),

    // async modal — the result type is the only thing worth writing by hand
    AsyncExample: modal<boolean>()(AsyncModalExample),
  },
})
```

With that registry:

```tsx
pushModal('DefaultExample')

pushModal('EditOrder', { orderId: 'release-42' })
// ^ props checked against EditOrderModal

const result = await pushModalAsync('AsyncExample', {
  title: 'Publish this release?',
})
// result: boolean | undefined
```

`modal<Result>()` is curried because TypeScript cannot infer one type argument while you supply another — passing the result type explicitly would force you to pass the props type too, which is the boilerplate this avoids.

### Cutting repetition with `defaultWrapper`

`defaultWrapper` takes any wrapper, including one built by `createResponsiveWrapper`. If most of your modals share a wrapper, make it the default and let the exceptions opt out:

```tsx
createPushModal({
  defaultWrapper: DynamicWrapper,
  modals: {
    // these three are responsive, and say nothing about it
    EditOrder: modal(EditOrderModal),
    Checkout: modal(CheckoutModal),
    Confirm: modal<boolean>()(ConfirmModal),

    // this one opts out
    Welcome: modal({ Wrapper: Dialog.Root, Component: WelcomeModal }),
  },
})
```

### Unregistered names

Pushing a name that is not in the registry throws with the name and the registered ones:

```
Modal "TestSheet" is not registered with createPushModal. Known modals, closest first: TestModal, AppMenuSheet.
```

Names are ordered by how close they look to the one that missed, and a long registry is capped so the message stays readable:

```
Modal "OrderEditModal" is not registered with createPushModal. Known modals, closest first: OrderEditSheet, Modal0, Modal1, ..., +193 more.
```

Most entry points are typed, so this is normally caught by tsc first. `useModalControls().replace(...)` is the exception — the hook cannot know which registry it is inside, so a typo there compiles cleanly and only this check catches it.

### `pushModal(...)`

Opens a modal and returns a handle for that specific instance.

```tsx
const flow = pushModal('ConfirmDelete', { id: 'release-42' })

flow.close()

flow.replace('DeleteSuccess', {
  id: 'release-42',
})
```

This is instance-based, so it stays precise even if you have multiple open modals with the same name.

### `pushModalAsync(...)`

Opens a modal and returns a promise that resolves when the modal decides the result.

```tsx
const confirmed = await pushModalAsync('ConfirmDelete', {
  id: 'release-42',
})

if (!confirmed) return

await deleteRelease()
```

By default:

- `resolve(value)` resolves with that value
- dismissing the modal resolves `undefined`
- `reject(reason)` rejects the promise
- replacing a pending async modal resolves the previous promise with `undefined`

### `useModalControls()`

Use this inside a modal component created through `createPushModal`.

```tsx
import { useModalControls } from '@zxkit/surface'

const AsyncModalExample = () => {
  const { close, resolve, reject, replace } = useModalControls<boolean>()

  return (
    <>
      <button onClick={() => resolve(true)}>Approve</button>
      <button onClick={() => resolve(false)}>Reject</button>
      <button onClick={() => replace('PublishSuccess', { message: 'Done' })}>Continue</button>
      <button onClick={close}>Decide later</button>
    </>
  )
}
```

Available controls:

- `close()` closes the current modal instance
- `resolve(value)` resolves the current async modal and closes it
- `reject(reason)` rejects the current async modal and closes it
- `replace(name, props)` swaps the current modal instance for another one

### Multi-step modals: `flow(...)`

`replace` swaps one modal for another. React reconciles by component type, so the outgoing modal's subtree — including the `Content` it renders — is torn down and a fresh one is mounted. The new panel mounts already open, so the primitive replays its entrance (`fade-in`, `zoom-in-95`) while the overlay sits still. That reads as a flash.

A flow avoids it by construction: the `Wrapper` and `Content` are rendered **once** and stay mounted, and only the step below them changes.

```tsx
// steps render the body only — no Content of their own
const PlanStep = ({ plan }: { plan: string }) => {
  const { go } = useFlowControls<typeof steps>()

  return <button onClick={() => go('payment', { amount: 24 })}>Continue with {plan}</button>
}

const steps = { plan: PlanStep, payment: PaymentStep, done: DoneStep }

const { pushModal, pushModalAsync } = createPushModal({
  modals: {
    Checkout: flow<boolean>()({
      Content: DynamicContent, // mounted once
      initial: 'plan',
      steps,
    }),
  },
})

pushModal('Checkout', { plan: 'pro' }) // props of the initial step
const paid = await pushModalAsync('Checkout', { plan: 'pro' }) // boolean | undefined
```

Because the panel never unmounts, focus, scroll position and the panel's size transition survive the step change too.

`Wrapper` is optional and falls back to `defaultWrapper`, the same as a `modal()` entry. `Content` is required — there is no `defaultContent`, because the panel is what each flow shapes for itself.

Replacing a flow — with another flow or with itself under new props — restarts it at `initial`. Only stepping keeps the shell.

### `useFlowControls()`

Use inside a step. Pass the steps object as a type argument to get step names and their props checked.

```tsx
const { step, go, replaceStep, back, canGoBack, reset } = useFlowControls<typeof steps>()
```

- `go(name, props)` moves forward, leaving the current step on the stack
- `replaceStep(name, props)` moves without leaving it behind, so `back()` skips it
- `back()` returns to the previous step, no-op on the first
- `reset()` returns to the initial step with its original props
- `step` is the current step name, `canGoBack` whether anything is below it

`useModalControls()` still works inside a step, so any step can `close()`, `resolve()` or `reject()` the whole flow. Its `replace()` swaps the entire modal for a different one — that is why the step-level move is named `replaceStep`, since a step can reach both.

Use `flow` when the screens belong to one task. Use `replace` when the next modal genuinely supersedes the current one and a fresh panel is the honest result.

### `replaceWithModal(...)`

`replaceWithModal(...)` is still available as a global “replace the current top modal” helper.

```tsx
replaceWithModal('PublishSuccess', {
  message: 'Release published',
})
```

Use it when you want simple stack-level behavior. Use the handle or `useModalControls().replace(...)` when you want exact per-instance control.

### Replace flow example

```tsx
import type React from 'react'
import { createPushModal, modal, useModalControls } from '@zxkit/surface'

const StepOneModal = () => {
  const { replace, close } = useModalControls()

  return (
    <>
      <button
        onClick={() =>
          replace('StepTwo', {
            title: 'Review your release',
          })
        }
      >
        Continue
      </button>
      <button onClick={close}>Cancel</button>
    </>
  )
}

const StepTwoModal = ({ title }: { title: string }) => {
  const { close } = useModalControls()

  return <button onClick={close}>{title}</button>
}

const { pushModal, ModalProvider } = createPushModal({
  defaultWrapper: Dialog.Root,
  modals: {
    StepOne: modal<Record<never, never>>(StepOneModal),
    StepTwo: modal<React.ComponentProps<typeof StepTwoModal>>(StepTwoModal),
  },
})

function openFlow() {
  pushModal('StepOne')
}
```

### Async result example

```tsx
import { createPushModal, modal, useModalControls } from '@zxkit/surface'

const ConfirmPublishModal = () => {
  const { resolve, close } = useModalControls<boolean>()

  return (
    <>
      <button onClick={() => resolve(true)}>Approve</button>
      <button onClick={() => resolve(false)}>Reject</button>
      <button onClick={close}>Later</button>
    </>
  )
}

const { pushModalAsync } = createPushModal({
  defaultWrapper: Dialog.Root,
  modals: {
    ConfirmPublish: modal<Record<never, never>, boolean>(ConfirmPublishModal),
  },
})

async function confirmPublish() {
  const approved = await pushModalAsync('ConfirmPublish')

  if (approved) {
    console.log('publish release')
  }
}
```

---

## License

MIT

## Author

nxtvoid
