---
'@zxkit/surface': patch
---

Stop re-rendering every open modal when the stack changes.

The provider rebuilds on every push, pop and replace, and each modal's controls value was constructed inline, so every open modal re-rendered with it — a stack of ten cost ten renders per push, and every `useModalControls()` consumer re-rendered along with it. Each instance is now a memoised component with its controls held stable, so a push renders only the modal being pushed.

`useOnPushModal` and `useOnCloseModal` held the callback in their effect dependencies, so an inline callback — the usual way to write one — tore down and re-registered the listener on every render of the consumer. The callback is now held in a ref: one subscription per name, and the latest callback still runs.
