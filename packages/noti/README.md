<p align="center">
  <img src="https://raw.githubusercontent.com/nxtvoid/zxkit/main/packages/noti/github.png" alt="noti banner" width="100%" />
</p>

<h1 align="center">@zxkit/noti</h1>

<p align="center">
  One notification, one island: an object-only API and a pill that morphs into a card and back, on the same DOM node.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zxkit/noti"><img src="https://img.shields.io/npm/v/@zxkit/noti.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@zxkit/noti"><img src="https://img.shields.io/npm/dm/@zxkit/noti.svg" alt="npm downloads" /></a>
  <a href="https://github.com/nxtvoid/zxkit/blob/main/packages/noti/LICENSE"><img src="https://img.shields.io/npm/l/@zxkit/noti.svg" alt="license" /></a>
</p>

---

- **One notification** — a record or nothing. No stack, no queue, no limit.
- **Objects only** — one options object per call. No string form.
- **Latest eligible invocation wins** — stale timers, exits and promise results are dropped.
- **No runtime dependencies** — the spring is a `linear()` easing, not a library.
- **No stylesheet to import** — the CSS ships inside the JS.
- **Accessible by construction** — a structural `li`, one live region, no nested controls.

## Install

```sh
bun add @zxkit/noti
```

React 19 only.

## Quick start

```tsx
// app/layout.tsx
import { NotiOutlet } from '@zxkit/noti'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>
        {children}
        <NotiOutlet position='top-right' closeButton />
      </body>
    </html>
  )
}
```

```ts
import { noti } from '@zxkit/noti'

noti.success({ title: 'Changes saved' })
noti.error({ title: 'Could not save', description: 'Try again in a few minutes.' })
```

Every method takes **one options object**. There is no string form:

```ts
noti('Message') // ✗ not callable
noti.success('Saved') // ✗ TypeError
noti.error('Failed', { duration: 4000 }) // ✗ TypeError
```

## Methods

| Call                       | Meaning                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `noti.loading(options)`    | Sticky loading state.                                        |
| `noti.update(id, options)` | Update a live invocation; false for a stale or dismissed id. |
| `noti.show(options)`       | Without `type`, reads as a success.                          |
| `noti.success(options)`    | —                                                            |
| `noti.error(options)`      | —                                                            |
| `noti.warning(options)`    | —                                                            |
| `noti.info(options)`       | —                                                            |
| `noti.action(options)`     | A success carrying a `button`.                               |
| `noti.promise(p, spec)`    | Loading, then the outcome. Returns the original promise.     |
| `noti.dismiss(id?)`        | Closes it. Another id closes nothing.                        |
| `noti.clear(position?)`    | Closes it, or only if it currently sits at `position`.       |

Every call returns a unique invocation id. A stale id cannot dismiss a replacement. The visual island remains the same DOM node.

```ts
const id = noti.info({ title: 'New comment' })
noti.dismiss(id)
```

## Examples

### Loading

`noti.loading(options)` shows a sticky loading state. The `show` form below is also supported.

```ts
noti.show({ type: 'loading', title: 'Uploading file…' })
```

### Replacing

A second call replaces the first on the same DOM node — a morph, not a remount.

```ts
noti.show({ type: 'loading', title: 'Uploading…' })
// later
noti.success({ title: 'Upload complete' })
```

### Sticky

`null`, `0`, negatives and `Infinity` all mean "never auto-close".

```ts
noti.warning({ title: 'Offline', description: 'Changes are queued.', duration: null })
```

### A button

```ts
noti.action({
  title: 'File uploaded',
  description: 'Share it with your team?',
  button: { title: 'Share now', onClick: () => share(file) },
})
```

By default, the button does **not** close the notification — a control that dismisses what it
just confirmed takes the confirmation away. Pending handlers block repeated clicks and pause expiry. Rejected handlers show a visible error and keep expiry paused until a successful retry or dismissal.

### Two actions, always expanded

```ts
noti.action({
  title: 'Delete product?',
  description: 'Choose Cancel to keep the product.',
  duration: null,
  keepExpanded: true,
  dismissible: false,
  cancelButton: {
    title: 'Cancel',
    onClick: () => {},
    dismissOnSuccess: true,
  },
  button: {
    title: 'Delete',
    onClick: () => deleteProduct(product.id),
    dismissOnSuccess: true,
  },
})
```

`cancelButton` accepts the same options as `button` and appears first with a neutral
style. While either handler is pending, both actions block additional clicks.
`keepExpanded` opens the details automatically and prevents interaction or autopilot
from collapsing them; it does not disable expiry, so use `duration: null` to wait for
a decision. `dismissible: false` hides the X and disables Escape and swipe dismissal.

This remains a nonmodal notification: it does not block the page or return a decision
promise, and another notification may replace it.

### Promise

```ts
const project = await noti.promise(saveProject(), {
  position: 'bottom-center', // the whole flow; a message may still override it
  loading: { title: 'Saving project…' },
  success: (value) => ({ title: 'Project saved', description: value.name }),
  error: (error) => ({ title: 'Could not save', description: toMessage(error) }),
  finally: () => setBusy(false),
})
```

- Messages are objects or factories, never strings.
- `action` replaces `success` when present, for an outcome with a button.
- Omit `success` to dismiss on success instead of announcing one.
- Accepts a promise or a factory; a factory's synchronous throw becomes a rejection.
- Returns **the original promise**, errors still typed `unknown`. Nothing is
  swallowed or retimed.
- While pending, a promise cannot be dismissed with the close button, Escape or
  swipe. Programmatic dismissal remains available; it hides feedback without
  cancelling the operation. Use an explicit action to implement cancellation.

```ts
void noti.promise(() => publish(post), {
  loading: { title: 'Publishing…' },
  action: (url) => ({
    title: 'Published',
    button: { title: 'View', onClick: () => open(url) },
  }),
})
```

### Latest invocation wins

```ts
void noti.promise(slowSave(), { loading: { title: 'Saving…' }, success: { title: 'Saved' } })
noti.error({ title: 'Connection lost' }) // arrives first
```

The slow result lands on nothing. It cannot overwrite the error, resurrect a
dismissed notification, or close the island with an old countdown.

### Autopilot

The island arrives compact, opens itself, and returns: `expand` after 150ms,
`collapse` after 4000ms, out of a 6000ms life. Both delays are clamped to the
notification's own lifetime.

```ts
noti.info({ title: 'Synced', autopilot: false }) // opens only on hover and focus
noti.info({ title: 'Synced', autopilot: { expand: 0, collapse: 2000 } })
```

Loading expands when it has details or a button, including cancellation controls. Long titles appear in full inside the expanded card.

### Per-call appearance

```ts
noti.success({
  title: 'Saved',
  fill: '#0b3b2e', // island surface; opts out of the theme
  roundness: 24,
  styles: { title: 'text-emerald-300', description: 'text-xs' },
})
```

### Screen-reader urgency

```ts
noti.error({ title: 'Payment failed', important: true }) // role="alert", assertive
noti.info({ title: 'Read-only mode', dismissible: false }) // no close button, no swipe
```

## Updating and professional defaults

```ts
const id = noti.loading({ title: 'Uploading', description: '1 of 20 files' })
noti.update(id, { description: '12 of 20 files' })
noti.update(id, { type: 'success', title: 'Upload complete', description: null })
```

`update` merges fields, preserves the public id and restarts its timer. Changing
`type` resets duration to the new state's defaults unless explicitly supplied.
Other resolved fields remain unchanged; pass overrides to change them.
It does not fire `onDismiss`. Stale or exiting ids return `false`. Updating a
promise's loading invocation takes ownership away from its automatic outcome.

```tsx
<NotiOutlet
  closeButtonLabel='Close notification'
  actionErrorLabel='Could not complete the action. Please try again.'
  stateOptions={{
    error: { duration: null, priority: 10, autopilot: { collapse: null } },
    action: { duration: null, autopilot: { collapse: null } },
  }}
/>
```

Defaults resolve from library, to `options`, to `stateOptions[type]`, to call options.
`priority` is a finite number, default `0`. Lower-priority calls are dropped while
a higher-priority notice is live; equal priority replaces it. There is no queue.
A suppressed call returns its own inert id, which cannot close the visible notice.
Dismissal releases the slot. `important` controls screen-reader urgency independently.
Promise outcomes inherit their loading priority unless explicitly overridden.

`autopilot: { collapse: null }` keeps details open until interaction collapses them
or the notice expires. Use `duration: null` to disable expiry as well.

```ts
noti.action({
  title: 'Restore the deleted file?',
  duration: null,
  button: {
    title: 'Restore',
    pendingTitle: 'Restoring...',
    errorTitle: 'Restore failed. Try again.',
    onClick: () => restoreFile(),
    dismissOnSuccess: true,
  },
})
```

Buttons also accept `disabled`. Pending actions use `aria-busy` and `aria-disabled`
while retaining keyboard focus. `dismissOnSuccess` only closes the invocation
that started the action. Failure text is configurable per button or through the
outlet's `actionErrorLabel`.

### Migration from 1.x

- IDs identify individual invocations. Retain the returned id for targeted dismissal or updates.
- Close buttons are enabled by default; use `closeButton={false}` to hide them.
- Loading notices expand when they have details or controls.
- Title casing is preserved as supplied.
- Dismiss callbacks can receive the `escape` reason.

## `NotiOptions`

| Option         | Type                                                        | Default                           |
| -------------- | ----------------------------------------------------------- | --------------------------------- |
| `priority`     | `number`                                                    | `0`                               |
| `title`        | `ReactNode`                                                 | the state's own name              |
| `description`  | `ReactNode`                                                 | —                                 |
| `type`         | `success` `loading` `error` `warning` `info` `action`       | `success`                         |
| `position`     | `NotiPosition`                                              | the outlet's                      |
| `duration`     | `number \| null`                                            | `6000`, `Infinity` for `loading`  |
| `autopilot`    | `boolean \| { expand?: number; collapse?: number \| null }` | `{ expand: 150, collapse: 4000 }` |
| `icon`         | `ReactNode \| ComponentType \| null`                        | the state's glyph                 |
| `styles`       | `{ title?, description?, badge?, button? }`                 | —                                 |
| `fill`         | `string`                                                    | `var(--noti-surface)`             |
| `roundness`    | `number`                                                    | `16`                              |
| `button`       | `NotiButton`                                                | —                                 |
| `cancelButton` | `NotiButton`                                                | —                                 |
| `keepExpanded` | `boolean`                                                   | `false`                           |
| `important`    | `boolean`                                                   | `false`                           |
| `dismissible`  | `boolean`                                                   | `true`                            |
| `onDismiss`    | `(context: NotiDismissContext) => void`                     | —                                 |
| `onAutoClose`  | `(context: NotiDismissContext) => void`                     | —                                 |

No `id`, no `outletId`, no `appearance`: identity belongs to the library, and
there is one outlet.

### `NotiButton`

Both `button` and `cancelButton` accept:

| Option             | Type                                        | Default                     |
| ------------------ | ------------------------------------------- | --------------------------- |
| `title`            | `ReactNode`                                 | required                    |
| `onClick`          | `(event) => unknown` (may return a promise) | required                    |
| `accessibleLabel`  | `string`                                    | —                           |
| `disabled`         | `boolean`                                   | `false`                     |
| `pendingTitle`     | `ReactNode`                                 | `title`                     |
| `errorTitle`       | `ReactNode`                                 | outlet's `actionErrorLabel` |
| `dismissOnSuccess` | `boolean`                                   | `false`                     |

Explicitly disabled actions are removed from keyboard navigation. Pending actions
retain focus, use `aria-disabled`, and block both handlers until settlement.

## `NotiOutlet`

Mount one, once. A second one warns and renders nothing.

```tsx
<NotiOutlet
  position='top-right'
  offset={24}
  options={{ duration: 8000 }}
  theme='system'
  closeButton
  swipeThreshold={45}
  classNames={{ item: 'shadow-2xl', title: 'font-medium' }}
/>
```

| Prop               | Type                                      | Default                            |
| ------------------ | ----------------------------------------- | ---------------------------------- |
| `position`         | six positions                             | `top-right`                        |
| `offset`           | `number \| string \| { top?, right?, … }` | `24`                               |
| `options`          | `Partial<NotiOptions>`                    | —                                  |
| `stateOptions`     | Per-state `Partial<NotiOptions>`          | -                                  |
| `actionErrorLabel` | `string`                                  | `Action failed. Please try again.` |
| `theme`            | `light \| dark \| system`                 | `system`                           |
| `icons`            | `Partial<Record<NotiState, …>>`           | built-in glyphs                    |
| `closeButton`      | `boolean`                                 | `true`                             |
| `closeButtonLabel` | `string`                                  | `Close notification`               |
| `closeButtonIcon`  | `ReactNode`                               | `×`                                |
| `dir`              | `ltr \| rtl \| auto`                      | —                                  |
| `swipe`            | `boolean`                                 | `true`                             |
| `swipeThreshold`   | `number` (px of travel)                   | `45`                               |
| `injectStyles`     | `boolean`                                 | `true`                             |
| `nonce`            | `string`                                  | —                                  |
| `unstyled`         | `boolean`                                 | `false`                            |
| `className`        | `string`                                  | —                                  |
| `classNames`       | `Partial<Record<NotiSlot, string>>`       | —                                  |
| `style`            | `CSSProperties`                           | —                                  |

`options` is merged into every call and the call always wins. `styles` merges
one slot at a time rather than replacing the object:

```tsx
<NotiOutlet options={{ styles: { title: 'a', description: 'b' } }} />
```

```ts
noti.success({ title: 'Saved', styles: { title: 'c' } })
// → title: 'c', description: 'b'
```

### Your own glyphs

Either an element or the component itself:

```tsx
<NotiOutlet
  icons={{
    error: CircleXIcon, // the component
    success: CircleCheckIcon,
    info: <InfoIcon strokeWidth={3} />, // an element, when it needs props
    loading: null, // no badge for this state
  }}
/>
```

```ts
noti.error({ title: 'Failed', icon: CircleXIcon })
noti.error({ title: 'Failed', icon: <CircleXIcon className='rotate-45' /> })
noti.info({ title: 'Heads up', icon: null }) // no badge, whatever the outlet says
```

Three layers, narrowest first: a call's own `icon`, the outlet's `icons`, the
built-in set. Icons resolve at render, so changing them restyles the
notification already on screen. The glyph is sized by `--noti-glyph-size` (16px
inside a 24px badge) and tinted with the state's accent.

> **The component form needs a client boundary.** React Server Components
> cannot serialize a function, so `icons={{ error: CircleXIcon }}` in a
> **server** component fails with _"Functions cannot be passed directly to
> Client Components"_. Mark the file `'use client'`, or pass the element form.

## Theming

`theme` picks the palette; `system` follows `prefers-color-scheme`.

```tsx
<NotiOutlet theme='light' /> // white island, dark text
<NotiOutlet theme='dark' /> // dark island, light text
<NotiOutlet theme='system' /> // default
```

The outlet writes the resolved value to `data-noti-theme`, which is where the
colour tokens live. Override them anywhere the cascade reaches — `:root`, a
theme class, or the outlet itself:

```css
:root {
  --noti-width: 380px;
  --noti-spring-duration: 600ms;
}

[data-noti-theme='dark'] {
  --noti-surface: #101014;
  --noti-success: oklch(0.8 0.18 160);
}
```

| Token                                                             | What it paints                             | Light                       | Dark                        |
| ----------------------------------------------------------------- | ------------------------------------------ | --------------------------- | --------------------------- |
| `--noti-surface`                                                  | the island itself                          | `#ffffff`                   | `#1a1a1a`                   |
| `--noti-shadow`                                                   | a filter chain lifting the island          | two soft `drop-shadow`s     | a transparent `drop-shadow` |
| `--noti-fg`                                                       | title, button, close                       | `#18181b`                   | `#f5f5f5`                   |
| `--noti-muted`                                                    | description                                | `#71717a`                   | `#a7a7aa`                   |
| `--noti-success` `-error` `-warning` `-info` `-action` `-neutral` | the state accent: glyph, badge tint, title | darkened for a white island | lifted for a dark one       |

`--noti-shadow` is appended to the SVG goo filter, so it must stay a valid
filter chain — never `none`. Both offsets are zero, because a top-anchored
island is drawn flipped.

Geometry and motion are theme-independent:

| Token                                                     | Default                 |
| --------------------------------------------------------- | ----------------------- |
| `--noti-width`                                            | `350px`                 |
| `--noti-compact-height`                                   | `40px`                  |
| `--noti-icon-size` / `--noti-glyph-size`                  | `24px` / `16px`         |
| `--noti-font-size-title` / `--noti-font-size-description` | `0.825rem` / `0.875rem` |
| `--noti-line-height`                                      | `1.25rem`               |
| `--noti-spring` / `--noti-settle`                         | `linear()` curves       |
| `--noti-spring-duration`                                  | `600ms`                 |
| `--noti-fade-duration` / `--noti-fade-delay`              | `360ms` / `0ms`         |

These are read back by the island itself, not only by the stylesheet: the SVG
silhouette is measured against the width the element actually got, and the
scripted animations run on the spring duration you set. Override one and the
whole morph follows.

A call's `fill` replaces `--noti-surface` for that notification and stops
following the theme, which is the point of passing one.

## Styling

There is no stylesheet to import: the CSS ships inside the JS and the outlet
injects it on mount, once. It goes **first** in `<head>`, so your own rules win
at equal specificity.

```tsx
<NotiOutlet nonce={cspNonce} /> // for a Content Security Policy that needs one
<NotiOutlet injectStyles={false} /> // you own it: import '@zxkit/noti/styles.css'
```

`@zxkit/noti/styles.css` and `@zxkit/noti/tokens.css` ship as plain files for
that last case.

Three layers, in increasing specificity — tokens, outlet slots, per-call styles:

```tsx
<NotiOutlet classNames={{ item: 'shadow-2xl', description: 'text-xs' }} />
```

```ts
noti.success({ title: 'Saved', styles: { title: 'text-emerald-400' } })
```

`unstyled` drops the appearance and keeps the behaviour and the semantics, in
which case `classNames` and the attributes below are the whole visual contract.
It does not stop the injection: the SVG silhouette is drawn by those rules, and
it is the product rather than decoration.

### Attributes

Parts: `item`, `content`, `header`, `heading-stack`, `heading-layer`, `icon`,
`title`, `body`, `description`, `actions`, `button`, `close`, `island-canvas`,
`island-svg`, `island-pill`, `island-body`, plus `outlet` on the list itself.

| Attribute              | On                   | Values                                                             |
| ---------------------- | -------------------- | ------------------------------------------------------------------ |
| `data-noti-state`      | item                 | `success` `error` `warning` `info` `action` `loading`              |
| `data-noti-phase`      | item                 | `entering` `visible` `exiting`                                     |
| `data-noti-position`   | item, outlet         | the six positions                                                  |
| `data-noti-edge`       | item                 | `top` `bottom` — which way it grows                                |
| `data-noti-expanded`   | item                 | present while the card is open                                     |
| `data-noti-paused`     | item                 | present while the countdown is held                                |
| `data-noti-swiping`    | item                 | present during a gesture                                           |
| `data-noti-truncated`  | item                 | present while the heading is too long and fades                    |
| `data-noti-ready`      | item                 | present once transitions are allowed                               |
| `data-noti-visible`    | body, actions, close | present while the island is open                                   |
| `data-noti-theme`      | outlet               | `light` `dark`                                                     |
| `data-noti-unstyled`   | outlet               | present when `unstyled`                                            |
| `data-noti-icon-state` | icon                 | the layer's own state, which differs from the item's mid-crossfade |

Two you set yourself: `data-noti-no-swipe` on anything inside the island a
gesture must not start from, and `data-noti-styles` on the injected `<style>`.

## Motion

The whole morph is **one spring**, and the browser owns it. Every geometric
value is measured from the DOM and published as a custom property; the
stylesheet transitions all of them on the same 600ms curve, sampled from
Motion's `spring(bounce: 0.25)` as a `linear()` easing. Nothing runs per frame
in JavaScript.

- **The silhouette** is two SVG rectangles through one alpha-merging filter.
  The blur becomes the concave neck between pill and card — a shape no border
  radius can express.
- **Details wait for expansion.** The description and full title fade in only after the geometry finishes opening. `--noti-fade-delay` adds an optional delay after that point. Closing or replacing cancels the pending reveal.
- **Closing does not rebound.** An overshoot would drive the body height below
  zero and flash it back, so the collapse is critically damped.
- **Dismissal reverses arrival.** An expanded card collapses into its pill before
  the pill fades and moves out. Swipe follows the gesture directly; reduced motion
  uses a short fade.
- **Refreshing collapses first.** A call arriving while the island is open
  collapses it, swaps the content, and lets autopilot reopen it. A second call
  replaces the pending one: updates never queue.
- **The heading crossfades through a blur**, which is what makes
  `loading → success` read as one object changing its mind.
- **Entry and exit** run on the Web Animations API — interruptible, with a
  completion callback that cannot be missed.

Under `prefers-reduced-motion` nothing travels, resizes or blurs. The state
still changes; it arrives instead of moving.

## Accessibility

- The root is an `li`. It carries structure, never interaction.
- **One** live region, `aria-atomic`, spanning heading and description, so the
  notification is announced as a complete message. The description stays in
  the tree while compact, so opening it later re-announces nothing.
- `important: true` is the only route to `role="alert"` / assertive. Errors are
  polite by default.
- The button is a real `button` and a **sibling** of the live region, never
  nested in another control. A non-textual label takes `accessibleLabel`.
- The island is not a tab stop and carries no `aria-expanded` — an attribute a
  `listitem` may not have. Its controls stay in the tab order while it is
  compact, and focusing one opens it.
- Hover, focus **and** tap open the island and hold its countdown. Hover is
  refused on touch, where `pointerleave` arrives with the release and would shut
  the island inside the same gesture; a tap toggles instead, and a press
  anywhere else closes it and hands the countdown back.
- The close button is visible by default, even while compact. Escape dismisses from inside the notice. `dismissible: false` disables user dismissal.
- Focus never moves on its own, and dismissing a notification that holds focus
  hands it back where it came from.
- SSR-safe: nothing touches the DOM on import or during the server render.

## Exports

```ts
import { noti, NotiOutlet } from '@zxkit/noti'
```

Plus the types: `NotiApi`, `NotiOptions`, `NotiState`, `NotiPosition`,
`NotiButton`, `NotiContent`, `NotiStyles`, `NotiId`, `NotiTheme`, `NotiSlot`,
`NotiClassNames`, `NotiOutletProps`, `NotiOffset`, `NotiPromiseOptions`,
`NotiPromiseMessage`, `NotiPromiseResolver`, `NotiDismissContext`,
`DismissReason`, `NotiIcon`, `NotiIcons` and `NotiAutopilot`.

The store, the reducer, the timers and the item component are internal: a public
store is a public invitation to a second notification.

## Browser support

The island needs `linear()` easings, `color-mix()`, `oklch()`, `ResizeObserver`
and the Web Animations API — recent Chromium, Firefox and WebKit.

Behaviour, accessibility and the generated stylesheet are covered by the unit
suite, including axe over a rendered interactive card.

## License

MIT © [nxtvoid](https://github.com/nxtvoid)
</content>
