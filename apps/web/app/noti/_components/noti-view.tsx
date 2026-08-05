import { CodeBlock } from '@zxkit/ui/code-block'
import { CopyButton } from '@zxkit/ui/copy-button'
import { NotiPlayground } from './noti-playground'
import {
  accessibilityExample,
  buttonExample,
  features,
  iconsExample,
  imperativeExample,
  latestWinsExample,
  optionsExample,
  outletMountExample,
  promiseExample,
  singletonExample,
  stylingExample,
  timerExample,
} from './content'

type Section = {
  id: string
  label: string
  title: string
  description: string
  code: string
}

type Group = {
  id: string
  title: string
  summary: string
  sections: Section[]
}

const groups: Group[] = [
  {
    id: 'setup',
    title: 'Setup',
    summary: 'One outlet in the root layout, then calls from anywhere in the app.',
    sections: [
      {
        id: 'mount',
        label: 'Mount',
        title: 'NotiOutlet',
        description:
          'One outlet in your root layout and you are done. It publishes its position and defaults to the store, holds the countdown while the tab is hidden, and unregisters cleanly on unmount.',
        code: outletMountExample,
      },
      {
        id: 'imperative',
        label: 'Imperative',
        title: 'noti.success({ … })',
        description:
          'Callable from anywhere — an event handler, a server action wrapper, a websocket callback. Every method takes an options object; there is no string form to fall back to.',
        code: imperativeExample,
      },
    ],
  },
  {
    id: 'behaviour',
    title: 'Behaviour',
    summary:
      'What happens when calls overlap, promises settle late, and countdowns are held from three directions at once.',
    sections: [
      {
        id: 'singleton',
        label: 'Singleton',
        title: 'one notification',
        description:
          'A second call replaces the first instead of stacking on it. Same record id, same DOM node, so the change is a morph rather than a mount.',
        code: singletonExample,
      },
      {
        id: 'options',
        label: 'Options',
        title: 'the whole contract',
        description:
          'Content, placement, timing, geometry and per-slot styles in one object. Anything omitted falls back to the outlet, then to the library.',
        code: optionsExample,
      },
      {
        id: 'promise',
        label: 'Promise',
        title: 'noti.promise',
        description:
          'Loading, then success, error or an action with a button — from one call. You get the untouched promise back and the error stays typed as unknown.',
        code: promiseExample,
      },
      {
        id: 'staleness',
        label: 'Staleness',
        title: 'latest invocation wins',
        description:
          'Every call mints a new instance. A settlement that no longer owns the island is dropped, so a slow request cannot overwrite what replaced it or resurrect what you dismissed.',
        code: latestWinsExample,
      },
      {
        id: 'action',
        label: 'Action',
        title: 'one button',
        description:
          'A real button, sibling to the live region, never nested inside another control. It acts and leaves the notification standing.',
        code: buttonExample,
      },
      {
        id: 'timers',
        label: 'Timers',
        title: 'holds and restarts',
        description:
          'Pausing is a set of reasons, not a boolean, so hover and focus cannot cancel each other out. A replacement restarts the countdown by identity, not by duration.',
        code: timerExample,
      },
    ],
  },
  {
    id: 'presentation',
    title: 'Presentation',
    summary: 'Glyphs, tokens and markup — the parts you are meant to replace.',
    sections: [
      {
        id: 'icons',
        label: 'Icons',
        title: 'your own glyphs',
        description:
          "Replace the built-in glyph for the states you name. A state you leave out keeps its own, null drops the badge, and a call's own icon still wins over both.",
        code: iconsExample,
      },
      {
        id: 'styling',
        label: 'Styling',
        title: 'tokens and slots',
        description:
          'A stylesheet you import, tokens you override, a class per slot, styles per call, or nothing at all. The package is not coupled to any CSS framework.',
        code: stylingExample,
      },
      {
        id: 'accessibility',
        label: 'Accessibility',
        title: 'the markup',
        description:
          'Polite by default, assertive only on request, no control nested inside another, and focus that stays exactly where the user left it.',
        code: accessibilityExample,
      },
    ],
  },
]

const jumpLinks = [
  { id: 'live', title: 'Live' },
  ...groups.map((group) => ({ id: group.id, title: group.title })),
  { id: 'design', title: 'Design' },
]

export function NotiView() {
  return (
    <div className='mx-auto w-full max-w-2xl px-1 py-14 md:py-20'>
      <header>
        <p className='text-muted-foreground font-mono text-sm'>@zxkit/noti</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl'>
          One notification, one island.
        </h1>
        <p className='text-muted-foreground mt-4 text-base leading-7'>
          A React notification with a single mental model: an object-only API, one live instance,
          and a pill that morphs into a card and back on the same DOM node. Timers and async
          settlements are protected against stale state, and nothing interactive is nested inside
          another control.
        </p>

        <div className='mt-8 flex flex-wrap items-center gap-x-6 gap-y-3'>
          <span className='bg-muted/30 inline-flex items-center gap-1 rounded-lg py-1 pr-1 pl-3'>
            <code className='font-mono text-sm'>bun add @zxkit/noti</code>
            <CopyButton value='bun add @zxkit/noti' />
          </span>
          <a
            className='text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors'
            href='https://github.com/nxtvoid/zxkit/tree/main/packages/noti#readme'
            target='_blank'
            rel='noopener noreferrer'
          >
            Documentation
          </a>
        </div>

        <nav
          aria-label='On this page'
          className='border-border mt-8 flex flex-wrap gap-2 border-t pt-6'
        >
          {jumpLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className='border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground rounded-full border px-3 py-1 font-mono text-xs transition-colors'
            >
              {link.title}
            </a>
          ))}
        </nav>
      </header>

      <section id='live' className='mt-14 scroll-mt-24'>
        <div className='flex items-baseline gap-3'>
          <h2 className='text-lg font-semibold tracking-tight'>Live</h2>
          <span className='bg-border h-px flex-1' aria-hidden='true' />
          <span className='text-muted-foreground font-mono text-xs'>mounted in the layout</span>
        </div>
        <p className='text-muted-foreground mt-2 text-sm leading-6'>
          A single <code className='font-mono text-xs'>&lt;NotiOutlet /&gt;</code> sits in this
          route&apos;s layout, with the package&apos;s own stylesheet and no overrides. Hover or tap
          the island to open it and hold its countdown, or throw it out towards the edge it is
          anchored to.
        </p>
        <div className='border-border bg-muted/20 mt-6 rounded-xl border p-5'>
          <NotiPlayground />
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.id} id={group.id} className='mt-16 scroll-mt-24'>
          <div className='flex items-baseline gap-3'>
            <h2 className='text-lg font-semibold tracking-tight'>{group.title}</h2>
            <span className='bg-border h-px flex-1' aria-hidden='true' />
            <span className='text-muted-foreground font-mono text-xs'>
              {group.sections.length} snippets
            </span>
          </div>
          <p className='text-muted-foreground mt-2 text-sm leading-6'>{group.summary}</p>

          <div className='mt-8 grid gap-10'>
            {group.sections.map((section) => (
              <article
                key={section.id}
                id={section.id}
                // `min-w-0`: a grid item's automatic minimum is its content's,
                // and a code block never wraps. Without it the article is as
                // wide as the longest line and the page scrolls sideways
                // instead of the snippet.
                className='border-border min-w-0 scroll-mt-24 border-t pt-6'
              >
                <p className='text-muted-foreground font-mono text-xs uppercase'>{section.label}</p>
                <h3 className='mt-2 font-mono text-sm font-medium'>{section.title}</h3>
                <p className='text-muted-foreground mt-2 text-sm leading-6'>
                  {section.description}
                </p>
                <div className='mt-4'>
                  <CodeBlock code={section.code} />
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section id='design' className='mt-16 scroll-mt-24'>
        <div className='flex items-baseline gap-3'>
          <h2 className='text-lg font-semibold tracking-tight'>Design</h2>
          <span className='bg-border h-px flex-1' aria-hidden='true' />
          <span className='text-muted-foreground font-mono text-xs'>
            {features.length} decisions
          </span>
        </div>

        <dl className='border-border mt-8 grid gap-5 border-t pt-8'>
          {features.map((feature) => (
            <div key={feature.title} className='grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4'>
              <dt className='text-sm font-medium'>{feature.title}</dt>
              <dd className='text-muted-foreground text-sm leading-6'>{feature.description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
