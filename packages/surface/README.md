<p align="center">
  <img src="https://raw.githubusercontent.com/nxtvoid/zxkit/main/packages/surface/github.png" alt="surface banner" width="100%" />
</p>

<h1 align="center">@zxkit/surface</h1>

<p align="center">
  Advanced utilities for responsive dialogs and drawers in React, exclusively for SHADCN Dialog and Drawer components.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zxkit/surface"><img src="https://img.shields.io/npm/v/@zxkit/surface.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@zxkit/surface"><img src="https://img.shields.io/npm/dm/@zxkit/surface.svg" alt="npm downloads" /></a>
  <a href="https://github.com/nxtvoid/zxkit/blob/main/packages/surface/LICENSE"><img src="https://img.shields.io/npm/l/@zxkit/surface.svg" alt="license" /></a>
</p>

---

## Features

- 🖼️ **Responsive Wrapper** - Adapts between Dialog and Drawer based on device breakpoint
- 🧠 **State Preservation** - Keeps form/input state across device changes
- 🪄 **Automatic Cleanup** - Clears state when closed
- 🔗 **Hooks** - `usePreservedState`, `usePreservedForm` for persistent values
- 🗂️ **Modal Stack** - Push, pop, replace modals with router-like flow
- ⚡ **Event-driven** - Emits events on modal open/close
- 🌀 **Flexible Integration** - Works with custom wrappers

> **Note:** Only for SHADCN Dialog and Drawer components.

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

## Usage Overview

### 1. `createResponsiveWrapper` (responsive.tsx)

- **Adaptive components**: Renders Dialog or Drawer depending on the breakpoint.
- **Automatic breakpoint detection**: Uses `matchMedia` and `useSyncExternalStore`.
- **Smart state preservation**: Keeps form and input state across device changes.
- **Automatic cleanup**: State is cleared when the dialog/drawer is closed.
- **Specialized hooks:**
  - `usePreservedState`: Persists value in a shared store.
  - `usePreservedForm`: Integrates with `react-hook-form` and preserves values across remounts.

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

`modal(...)` is a small typing helper for your modal registry. It does not add runtime behavior by itself, but it gives `surface` enough information to infer:

- modal props for `pushModal(...)`
- async results for `pushModalAsync(...)`
- prop-less modals that should be callable without passing `{}`

```tsx
import type React from 'react'
import { createPushModal, modal } from '@zxkit/surface'

const { pushModal, pushModalAsync, ModalProvider } = createPushModal({
  modals: {
    DefaultExample: modal<Record<never, never>>(DefaultModalExample),
    AsyncExample: modal<React.ComponentProps<typeof AsyncModalExample>, boolean>({
      Wrapper: DynamicWrapper,
      Component: AsyncModalExample,
    }),
  },
})
```

With that registry:

```tsx
pushModal('DefaultExample')

const result = await pushModalAsync('AsyncExample', {
  title: 'Publish this release?',
})
// result: boolean | undefined
```

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
