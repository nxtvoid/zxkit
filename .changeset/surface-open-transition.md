---
'@zxkit/surface': patch
---

Fix modals mounting already open, which skipped the enter animation on some primitives.

A pushed modal does not exist until it is pushed, so the wrapper's very first render had `open: true`. Primitives that read their entrance off a CSS animation are unaffected — Radix's `data-[state=open]:animate-in` replays on mount. Primitives that read it off the open _transition_ are not: Base UI seeds its internal `mounted` state from `open`, so its `open && !mounted` check never fired, no `data-starting-style` was applied, and the panel appeared with no entrance while the exit still animated.

The wrapper is now handed one closed render before being opened, so it observes the `false → true` transition a hand-controlled root would give it. The flip runs in a layout effect, not an animation frame, so React commits both renders before the browser paints: no blank frame, no added latency, and the modal is still in the DOM synchronously.

Replacing a modal keeps the wrapper open, so a replace does not blink it shut or replay the entrance.
