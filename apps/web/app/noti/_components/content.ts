export const outletMountExample = `// app/layout.tsx — no stylesheet to import.
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
}`

export const imperativeExample = `import { noti } from '@zxkit/noti'

noti.success({ title: 'Changes saved' })
noti.warning({ title: 'Session expiring' })
noti.error({
  title: 'Could not save',
  description: 'Try again in a few minutes.',
})

// Works outside React: no hook, no provider, no context.
export async function saveDraft(draft: Draft) {
  await db.drafts.upsert(draft)
  noti.success({ title: 'Draft saved' })
}`

export const singletonExample = `noti.success({ title: 'Changes saved' })
noti.error({ title: 'Could not save' })   // replaces it — same node, same island

// Every call returns the same logical id, because there is one notification.
const id = noti.info({ title: 'New comment' })
noti.dismiss(id)

// A call that arrives while the island is open collapses it first, swaps the
// content, then lets autopilot open it again. Never a card swapped for a card.`

export const optionsExample = `noti.show({
  type: 'success',
  title: 'Changes saved',
  description: 'All 12 records synced.',

  position: 'top-right',      // omitted keeps the live position
  duration: 6000,             // null, 0, negatives and Infinity are sticky
  autopilot: { expand: 150, collapse: 4000 },

  icon: <CheckIcon />,        // null removes the badge entirely
  styles: { title: 'font-semibold', description: 'text-xs' },
  fill: '#1a1a1a',
  roundness: 16,
})`

export const promiseExample = `const project = await noti.promise(saveProject(), {
  loading: { title: 'Saving project…' },
  success: (value) => ({ title: 'Project saved', description: value.name }),
  error: (error) => ({ title: 'Could not save', description: toMessage(error) }),
  action: (value) => ({
    title: 'Project ready',
    button: { title: 'Open', onClick: () => openProject(value) },
  }),
})

// The original promise comes back: it resolves and rejects exactly as it would
// have without noti, and the error stays typed as unknown.`

export const latestWinsExample = `// A slow request starts…
void noti.promise(slowSave(), {
  loading: { title: 'Saving…' },
  success: { title: 'Saved' },
})

// …and something more important happens before it settles.
noti.error({ title: 'Connection lost' })

// The slow result lands on nothing: it no longer owns the island, so it cannot
// overwrite it or bring a dismissed notification back. Latest invocation wins.`

export const buttonExample = `noti.action({
  title: 'File uploaded',
  description: 'Share it with your team?',
  button: {
    title: 'Share now',
    onClick: () => share(file),
    accessibleLabel: 'Share the uploaded file',
  },
})

// The button does not close the notification. A control that dismisses what it
// just confirmed takes the confirmation away.
// A rejected handler is reported and the island stays up.`

export const timerExample = `// Hover, focus and a hidden tab are three independent holds on one countdown.
// It resumes only when the last of them is gone.

// A replacement restarts the countdown even when the duration is identical:
// in a singleton, milliseconds alone cannot tell one notification from another.
noti.success({ title: 'Saved', duration: 4000 })
noti.success({ title: 'Saved again', duration: 4000 })  // full 4s, not 4s minus

// null, 0, negatives and Infinity all mean "never auto-close".
noti.error({ title: 'Payment declined', duration: null })`

export const iconsExample = `<NotiOutlet
  position='bottom-right'
  closeButton
  icons={{
    error: CircleXIcon,                  // the component itself
    success: CircleCheckIcon,
    info: <InfoIcon strokeWidth={3} />,  // an element, when it needs props
  }}
/>

// A state you leave out keeps its built-in glyph.
// null drops the badge for that state entirely.
<NotiOutlet icons={{ loading: null }} />

// Three layers, narrowest first: the call, then the outlet, then the built-ins.
noti.error({ title: 'Failed', icon: CircleXIcon })   // wins over icons.error
noti.error({ title: 'Failed', icon: null })          // no badge at all

// Passing the component itself needs a client boundary: React Server
// Components cannot serialize a function. Mark the file 'use client', or use
// the element form, which crosses that boundary fine.

// Presentation, resolved at render rather than baked into the record — so
// changing it restyles the notification that is already on screen.`

export const stylingExample = `/* The CSS ships inside the JS: the outlet injects it on mount, first in
   <head>, so your own stylesheet still wins at equal specificity. */
<NotiOutlet nonce={cspNonce} />          // for a strict Content Security Policy
<NotiOutlet injectStyles={false} />      // you own it: import '@zxkit/noti/styles.css'

/* Every value is a token. Override them anywhere the cascade reaches. */
:root {
  --noti-width: 380px;
  --noti-compact-height: 40px;
  --noti-success: oklch(0.7 0.18 160);
}

/* Or style by slot, in whatever CSS system you already use. */
<NotiOutlet
  classNames={{ item: 'shadow-2xl', title: 'text-sm font-medium' }}
  options={{ styles: { description: 'text-xs' } }}
/>

/* A call's styles win over the outlet's, one slot at a time. */
noti.success({ title: 'Saved', styles: { title: 'text-emerald-400' } })

/* Or keep the behaviour and the semantics, and none of the appearance. */
<NotiOutlet unstyled classNames={{ item: 'my-island' }} />`

export const accessibilityExample = `// The root is an li, never a button. Making the whole island a control with
// its action nested inside is exactly what no screen reader or keyboard user
// can untangle.
<li data-noti-item data-noti-state='action' data-noti-phase='visible'>
  <svg data-noti-island-canvas aria-hidden='true' />
  <div role='status' aria-live='polite' aria-atomic='true'>
    <span data-noti-icon aria-hidden='true' />
    <div data-noti-title>File uploaded</div>
    <div data-noti-description>Share it with your team?</div>
  </div>
  <div data-noti-actions>
    <button data-noti-button>Share now</button>
    <button data-noti-close aria-label='Close notification'>…</button>
  </div>
</li>

// Assertive announcements are opt-in, even for errors.
noti.error({ title: 'Payment declined', important: true })`

export const features = [
  {
    title: 'One island',
    description:
      'The store holds a record or nothing at all. No stack, no queue, no limit, no second outlet — a new call replaces the live one, even mid-exit.',
  },
  {
    title: 'Objects only',
    description:
      'Every creation method takes one options object. There is no string form and no positional second argument, so a call reads the same everywhere.',
  },
  {
    title: 'Latest invocation wins',
    description:
      'Each call mints a new instance. A stale timer, exit or promise settlement is dropped rather than applied to the notification that replaced it.',
  },
  {
    title: 'Physical refresh',
    description:
      'An open island collapses before it changes what it says, then opens again. Same DOM node, one continuous silhouette, never a card swapped for a card.',
  },
  {
    title: 'Timers that hold',
    description:
      'Hover, focus, a hidden document and an explicit pause are separate reasons. The countdown resumes only when the last one is gone.',
  },
  {
    title: 'Accessible by construction',
    description:
      'A structural li, one polite live region, a real button as its sibling, and no control nested inside another. Focus never moves on its own.',
  },
  {
    title: 'No animation dependency',
    description:
      'The silhouette is an SVG filter, the morph is the Web Animations API on measured values, and the rest is CSS. Interruptible, and zero runtime deps.',
  },
  {
    title: 'Yours to style',
    description:
      'A stylesheet you import, tokens you override, a class per slot, per-call styles, or unstyled. Never coupled to a CSS framework.',
  },
]
