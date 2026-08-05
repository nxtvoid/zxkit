# @zxkit/noti

## 1.0.0

### Major Changes

- Initial release. A React notification singleton: one notification at a time, rendered as a Dynamic Island that morphs from a compact pill to an open card and back. A replacement mutates the record in place, so the island reshapes on the same DOM node instead of remounting — no stack, no queue, no exit-then-enter flicker.

  Object-only API through the `noti` client: `show`, `success`, `error`, `warning`, `info` and `action`, each taking a single `NotiOptions` object and returning the singleton's `NotiId`. `promise(promise | () => promise, options)` shows loading and then the outcome while returning the original promise untouched, with the latest invocation winning over a slow one still in flight. `dismiss(id?)` and `clear(position?)` close it. Identity belongs to the library: callers cannot mint an id.

  Motion is driven by the Web Animations API and CSS only — no animation dependency. The silhouette is an SVG canvas (`feGaussianBlur` / `feColorMatrix` / `feComposite`) measured from the element it belongs to, so it follows `--noti-width` and `--noti-compact-height` wherever the cascade resolves them. `autopilot` opens and collapses the island on its own with per-call delays, or opts out entirely with `false` while hover and focus still open it. Pause holds accumulate across `hover`, `focus`, `document-hidden` and `programmatic`: the countdown resumes only once every one is released.

  Accessibility is part of the contract, not a prop. The live region announces politely by default and assertively under `important`; a repeated call with the same content neither re-announces nor re-morphs. The island is never a tab stop, its controls are reachable while it is still compact, focusing one opens it, and showing a notification never moves focus. `prefers-reduced-motion` replaces the spring with a fade and drops the outgoing heading layer.

  Dismissal by close button, swipe (allowed directions derived from the anchor), API or timeout, each reported to `onDismiss` / `onAutoClose` with a `DismissReason`. `duration` accepts `null`, `0`, negatives and `Infinity` as sticky. `dismissible: false` removes every user route out.

  `NotiOutlet` mounts once and carries the defaults every call inherits: six anchor positions, `offset`, `theme` (`light` / `dark` / `system`), per-state `icons`, `dir` for RTL, swipe configuration, and close-button labelling. Styles inject themselves by default with `nonce` support for a strict CSP, or come from `@zxkit/noti/styles.css` and `@zxkit/noti/tokens.css`. `unstyled` keeps the behaviour and the semantics and hands the whole visual contract to `classNames` and the `data-noti-*` attributes. A second outlet keeps its defaults and its holds but draws nothing, and says so.

  ESM-only, React 19 peer, safe to import from a server component: the outlet renders nothing on the server and the React layer keeps its own `'use client'` boundary. Verified by unit suites over the store, reducer, timer, promise adapter, swipe gesture, generated CSS and the rendered outlet, including axe checks on the interactive card.
