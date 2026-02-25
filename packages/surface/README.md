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
- **LIFO operations**: `pushModal()`, `popModal()`, `replaceWithModal()`.
- **Event-driven**: Emits events when modals open/close.
- **Automatic animations**: Keeps closed modals during exit animation.
- **Flexible integration**: Works with any component via custom `Wrapper`.

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

## License

MIT

## Author

nxtvoid
