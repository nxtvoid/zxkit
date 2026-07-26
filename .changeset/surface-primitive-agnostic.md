---
'@zxkit/surface': major
---

Remove all coupling to specific primitive and form libraries.

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
