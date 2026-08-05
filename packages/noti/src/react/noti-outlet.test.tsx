// @vitest-environment jsdom

import { StrictMode, act, forwardRef, memo } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { createNotiApi, type NotiApi } from '../client'
import { FALLBACK_MARGIN, SPRING_DURATION } from '../core/constants'
import { createNotiStore, type NotiStore } from '../core/store'
import type { NotiPosition } from '../types'
import {
  createFakeTimerHost,
  stubMatchMedia,
  stubPointerEvents,
  type FakeTimerHost,
} from '../test-utils'
import { NotiOutletWithStore } from './noti-outlet'

// Store mutations are driven from outside React, so `act` has to be usable
// outside Testing Library's own wrappers.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

beforeAll(stubPointerEvents)

let restoreMatchMedia = () => {}

// A desktop by default: hover exists, and the user has not asked for less motion.
const DESKTOP = { '(hover: hover) and (pointer: fine)': true }

beforeEach(() => {
  restoreMatchMedia = stubMatchMedia(DESKTOP)
})

afterEach(() => {
  restoreMatchMedia()
  vi.restoreAllMocks()
  cleanup()
})

function setup(): { noti: NotiApi; store: NotiStore; clock: FakeTimerHost } {
  const clock = createFakeTimerHost()
  const store = createNotiStore({ timerHost: clock.host, exitDuration: 0, warn: () => {} })

  return { noti: createNotiApi(store), store, clock }
}

/**
 * The imperative API is called from outside React, so anything it changes needs
 * an `act()` boundary before the DOM can be asserted on.
 */
function push<T>(run: () => T): T {
  let result: T | undefined
  act(() => {
    result = run()
  })

  return result as T
}

/** Advances the store's own clock. */
function advance(clock: FakeTimerHost, ms: number): void {
  act(() => {
    clock.advance(ms)
  })
}

/** Advances the real timers the refresh and autopilot delays run on. */
function tick(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function items(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-noti-item]'))
}

function firstItem(): HTMLElement {
  const [item] = items()
  if (item === undefined) throw new Error('no notification rendered')

  return item
}

function outlet(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-noti-outlet]')
}

function textOf(element: Element | null): string {
  return element?.textContent ?? ''
}

/** jsdom has no `TransitionEvent`, and the listener reads `propertyName`. */
function endTransition(target: Element, propertyName: string): void {
  const event = new Event('transitionend', { bubbles: true })
  Object.defineProperty(event, 'propertyName', { value: propertyName })
  target.dispatchEvent(event)
}

/**
 * Opens the island, the way a user reaches its controls.
 *
 * The stylesheet hides the action row and the close control with `visibility`
 * while the island is compact, which takes them out of the accessibility tree —
 * so `getByRole` cannot see them either, and should not.
 */
function open(item: HTMLElement): void {
  fireEvent.pointerEnter(item)
}

function reduceMotion(): void {
  restoreMatchMedia()
  restoreMatchMedia = stubMatchMedia({ ...DESKTOP, '(prefers-reduced-motion: reduce)': true })
}

const POSITIONS: NotiPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

describe('NotiOutlet', () => {
  it('renders nothing until there is something to show', () => {
    const { store } = setup()
    const { container } = render(<NotiOutletWithStore store={store} />)

    expect(container.innerHTML).toBe('')
  })

  it('renders every state as one island', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} />)

    for (const [call, state] of [
      [() => noti.success({ title: 'Saved' }), 'success'],
      [() => noti.error({ title: 'Failed' }), 'error'],
      [() => noti.warning({ title: 'Careful' }), 'warning'],
      [() => noti.info({ title: 'Heads up' }), 'info'],
      [() => noti.action({ title: 'Ready' }), 'action'],
      [() => noti.show({ type: 'loading', title: 'Working' }), 'loading'],
    ] as const) {
      push(call)
      expect(items()).toHaveLength(1)
      expect(firstItem().getAttribute('data-noti-state')).toBe(state)
    }
  })

  it('never renders more than one notification, whatever the sequence', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} />)

    push(() => noti.success({ title: 'One' }))
    push(() => noti.error({ title: 'Two' }))
    push(() => noti.info({ title: 'Three', position: 'bottom-left' }))
    push(() => noti.warning({ title: 'Four' }))

    expect(items()).toHaveLength(1)
    expect(document.querySelectorAll('[data-noti-outlet]')).toHaveLength(1)
  })

  it('keeps the same DOM node across a replacement', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} />)

    push(() => noti.success({ title: 'First' }))
    const node = firstItem()

    push(() => noti.error({ title: 'Second' }))
    expect(firstItem()).toBe(node)
    expect(node.getAttribute('data-noti-state')).toBe('error')
  })

  it('replaces a notification that is still leaving', () => {
    const { animations, restore } = installControlledAnimations()

    try {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Going' }))
      push(() => {
        noti.dismiss()
      })
      expect(firstItem().getAttribute('data-noti-phase')).toBe('exiting')

      push(() => noti.error({ title: 'Arriving' }))
      expect(items()).toHaveLength(1)
      expect(firstItem().getAttribute('data-noti-phase')).toBe('entering')
      expect(textOf(firstItem())).toContain('Arriving')
    } finally {
      restore()
      animations.length = 0
    }
  })

  it('removes the notification once its exit animation finishes', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} />)
    push(() => noti.success({ title: 'Saved' }))

    push(() => {
      noti.dismiss()
    })
    // jsdom has no Web Animations API, so the exit reports "finished" at once.
    expect(items()).toHaveLength(0)
    expect(store.getCurrent()).toBeNull()
  })

  describe('positions', () => {
    it.each(POSITIONS)('anchors a single notification at %s', (position) => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} position={position} />)
      push(() => noti.success({ title: 'Saved' }))

      expect(outlet()?.getAttribute('data-noti-position')).toBe(position)
      expect(firstItem().getAttribute('data-noti-position')).toBe(position)
      expect(firstItem().getAttribute('data-noti-edge')).toBe(
        position.startsWith('bottom') ? 'top' : 'bottom'
      )
    })

    it('lets a call override the outlet position', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} position='top-right' />)
      push(() => noti.success({ title: 'Saved', position: 'bottom-left' }))

      expect(outlet()?.getAttribute('data-noti-position')).toBe('bottom-left')
    })
  })

  describe('expansion', () => {
    it('arrives compact and opens on hover', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() =>
        noti.success({ title: 'Saved', description: 'Everything is synced.', autopilot: false })
      )
      const item = firstItem()

      expect(item.getAttribute('data-noti-expanded')).toBeNull()
      fireEvent.pointerEnter(item)
      expect(item.getAttribute('data-noti-expanded')).toBe('')
      expect(store.getCurrent()?.expanded).toBe(true)

      fireEvent.pointerLeave(item)
      expect(item.getAttribute('data-noti-expanded')).toBeNull()
    })

    it('leaves the island out of the tab order and its controls in it', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} closeButton />)
      push(() =>
        noti.action({
          title: 'File uploaded',
          description: 'Share it?',
          autopilot: false,
          button: { title: 'Share now', onClick: () => {} },
        })
      )

      // The island itself is structure, so it is not a tab stop and carries no
      // `aria-expanded` — an attribute a `listitem` may not have anyway.
      expect(firstItem().getAttribute('tabindex')).toBeNull()
      expect(firstItem().getAttribute('aria-expanded')).toBeNull()

      // Its controls stay reachable while it is compact: hiding them until it
      // opens would leave the keyboard with no way in.
      expect(store.getCurrent()?.expanded).toBe(false)
      expect(screen.getByRole('button', { name: 'Share now' })).toBeDefined()
      expect(screen.getByRole('button', { name: 'Close notification' })).toBeDefined()
    })

    it('opens the island when one of its controls takes focus', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} closeButton />)
      push(() => noti.success({ title: 'Saved', description: 'Synced.', autopilot: false }))

      const close = screen.getByRole('button', { name: 'Close notification' })
      act(() => {
        close.focus()
      })
      fireEvent.focusIn(close)

      expect(store.getCurrent()?.expanded).toBe(true)
    })

    it('opens on focus too, so the keyboard is not a second-class path', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() =>
        noti.success({ title: 'Saved', description: 'Everything is synced.', autopilot: false })
      )
      const item = firstItem()

      fireEvent.focusIn(item)
      expect(store.getCurrent()?.expanded).toBe(true)
      fireEvent.focusOut(item)
      expect(store.getCurrent()?.expanded).toBe(false)
    })

    it('opens itself and returns to a pill on autopilot', () => {
      vi.useFakeTimers()
      try {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        push(() =>
          noti.success({
            title: 'Saved',
            description: 'Everything is synced.',
            autopilot: { expand: 150, collapse: 2_000 },
          })
        )

        expect(store.getCurrent()?.expanded).toBe(false)
        tick(150)
        expect(store.getCurrent()?.expanded).toBe(true)

        tick(1_850)
        expect(store.getCurrent()?.expanded).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it('never opens for a loading notification', () => {
      vi.useFakeTimers()
      try {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        push(() =>
          noti.show({
            type: 'loading',
            title: 'Uploading',
            description: 'Contacting the server…',
            button: { title: 'Cancel', onClick: () => {} },
          })
        )
        const item = firstItem()

        // Inside the autopilot window, not past it: the default collapse lands
        // at 4000ms, so only checking after it would hide an island that did
        // open — over a silhouette still drawn compact.
        tick(150)
        expect(store.getCurrent()?.expanded).toBe(false)
        expect(item.querySelector('[data-noti-body][data-noti-visible]')).toBeNull()

        tick(4_850)
        expect(store.getCurrent()?.expanded).toBe(false)

        fireEvent.pointerEnter(item)
        expect(store.getCurrent()?.expanded).toBe(false)
        expect(item.getAttribute('aria-expanded')).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })

    it('never opens itself for an island whose only content is the close button', () => {
      vi.useFakeTimers()
      try {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} closeButton />)
        // No description and no button: opening reveals an empty card.
        push(() => noti.success({ title: 'Link copied' }))

        // Past the expand delay but well short of the collapse, or an island
        // that opened and closed again would look like one that never opened.
        tick(1_000)
        expect(store.getCurrent()?.expanded).toBe(false)
        expect(firstItem().getAttribute('data-noti-expanded')).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })

    it('stays a pill on hover when the close button is all there is', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} closeButton />)
      push(() => noti.success({ title: 'Link copied' }))

      // Opening would reveal an empty card with a control floating in it.
      fireEvent.pointerEnter(firstItem())
      expect(store.getCurrent()?.expanded).toBe(false)
      expect(firstItem().getAttribute('data-noti-expanded')).toBeNull()

      // Still reachable: the control is rendered and keeps its own seat.
      expect(screen.getByRole('button', { name: 'Close notification' })).not.toBeNull()
    })

    it('never draws a body for an island with nothing to reveal', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} closeButton />)
      push(() => noti.success({ title: 'Link copied' }))
      fireEvent.pointerEnter(firstItem())

      const svg = document.querySelector('[data-noti-island-svg]')
      const canvas = document.querySelector<HTMLElement>('[data-noti-island-canvas]')
      const height = Number(svg?.getAttribute('height') ?? 0)
      // jsdom resolves no `var()`, so the rect's height is read at its source.
      const bodyHeight = Number.parseFloat(
        canvas?.style.getPropertyValue('--noti-body-rect-height') ?? '0'
      )

      // A body over a capsule that never opens is the blob hanging off it.
      expect(height).toBe(40)
      expect(bodyHeight).toBe(0)
    })

    it('anchors the close button to the pill while compact', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} closeButton position='bottom-left' />)
      push(() => noti.success({ title: 'Link copied' }))

      const item = firstItem()
      const inset = Number.parseFloat(item.style.getPropertyValue('--noti-close-inset'))
      const pillWidth = Number.parseFloat(item.style.getPropertyValue('--noti-pill-width'))

      // Left-aligned: a fixed inset would strand the control at the far right
      // of the full-width box, nowhere near the capsule.
      expect(inset).toBeGreaterThan(8)
      expect(inset).toBeLessThan(350 - pillWidth + 20)
    })

    it('stays compact with nothing more to say', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved' }))
      const item = firstItem()

      fireEvent.pointerEnter(item)
      expect(store.getCurrent()?.expanded).toBe(false)
      expect(item.getAttribute('aria-expanded')).toBeNull()
    })
  })

  describe('refresh', () => {
    it('collapses before it swaps what an open island says', () => {
      vi.useFakeTimers()
      try {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        push(() => noti.success({ title: 'First', description: 'Old body', autopilot: false }))
        const item = firstItem()

        fireEvent.pointerEnter(item)
        expect(item.getAttribute('data-noti-expanded')).toBe('')

        push(() => noti.error({ title: 'Second', description: 'New body' }))
        // Collapsed already, but still saying the old thing.
        expect(item.getAttribute('data-noti-expanded')).toBeNull()
        expect(textOf(item)).toContain('First')
        expect(textOf(item)).not.toContain('Second')

        tick(SPRING_DURATION + FALLBACK_MARGIN)
        expect(textOf(firstItem())).toContain('Second')
        expect(textOf(firstItem())).not.toContain('First')
      } finally {
        vi.useRealTimers()
      }
    })

    it('changes a compact island straight away', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'First' }))

      push(() => noti.error({ title: 'Second' }))
      expect(textOf(firstItem())).toContain('Second')
    })

    it('keeps only the last of two rapid updates pending', () => {
      vi.useFakeTimers()
      try {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        push(() => noti.success({ title: 'First', description: 'Body', autopilot: false }))
        fireEvent.pointerEnter(firstItem())

        push(() => noti.error({ title: 'Second' }))
        push(() => noti.warning({ title: 'Third' }))

        tick(SPRING_DURATION + FALLBACK_MARGIN)
        expect(textOf(firstItem())).toContain('Third')
        expect(textOf(firstItem())).not.toContain('Second')

        // No queue: nothing else lands after the pending view was replaced.
        tick(1_000)
        expect(textOf(firstItem())).toContain('Third')
      } finally {
        vi.useRealTimers()
      }
    })

    it('ignores a transition that finished somewhere below the island', () => {
      vi.useFakeTimers()
      try {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        push(() => noti.success({ title: 'First', description: 'Body', autopilot: false }))
        const item = firstItem()
        fireEvent.pointerEnter(item)

        push(() => noti.error({ title: 'Second' }))

        // The SVG silhouette animates a `height` of its own, and `transitionend`
        // bubbles. Committing on it would cut the swap in mid-morph.
        const canvas = document.querySelector('[data-noti-island-body]')
        expect(canvas).not.toBeNull()
        act(() => {
          endTransition(canvas as Element, 'height')
        })
        expect(textOf(firstItem())).toContain('First')

        // The island's own collapse is the signal, and it commits at once —
        // without waiting out the fallback timeout.
        act(() => {
          endTransition(item, 'height')
        })
        expect(textOf(firstItem())).toContain('Second')
      } finally {
        vi.useRealTimers()
      }
    })

    it('refuses to open while the swap is still pending', () => {
      vi.useFakeTimers()
      try {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        push(() => noti.success({ title: 'First', description: 'Body', autopilot: false }))
        const item = firstItem()

        fireEvent.pointerEnter(item)
        push(() => noti.error({ title: 'Second', description: 'New body' }))
        expect(store.getCurrent()?.expanded).toBe(false)

        // Hovering now would open a card that is still showing the old content.
        fireEvent.pointerLeave(item)
        fireEvent.pointerEnter(item)
        expect(store.getCurrent()?.expanded).toBe(false)
        expect(textOf(firstItem())).toContain('First')

        tick(SPRING_DURATION + FALLBACK_MARGIN)
        fireEvent.pointerLeave(item)
        fireEvent.pointerEnter(firstItem())
        expect(store.getCurrent()?.expanded).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })

    it('leaves the outgoing heading in the presentation it was wearing', () => {
      const { animations, restore } = installControlledAnimations()

      try {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        push(() => noti.success({ title: 'Saved', styles: { title: 'first-title' } }))
        push(() => noti.error({ title: 'Failed', styles: { title: 'second-title' } }))

        const current = document.querySelector('[data-noti-heading-layer="current"]')
        const previous = document.querySelector('[data-noti-heading-layer="previous"]')
        expect(previous).not.toBeNull()

        // The layer on its way out must not be repainted in the colours of the
        // content arriving, halfway through the blur.
        expect(current?.querySelector('[data-noti-title]')?.className).toContain('second-title')
        expect(previous?.querySelector('[data-noti-title]')?.className).toContain('first-title')

        act(() => {
          for (const animation of [...animations]) animation.finish()
        })
      } finally {
        restore()
      }
    })

    it('crossfades the outgoing heading and then drops it', () => {
      const { animations, restore } = installControlledAnimations()

      try {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        push(() => noti.show({ type: 'loading', title: 'Uploading' }))
        animations.length = 0

        push(() => noti.success({ title: 'Uploaded' }))

        const leaving = document.querySelector('[data-noti-heading-layer="previous"]')
        expect(leaving).not.toBeNull()
        expect(leaving?.getAttribute('aria-hidden')).toBe('true')
        expect(textOf(leaving)).toContain('Uploading')

        // A blur, not a plain fade: the old heading defocuses as it leaves.
        const blurred = animations.filter((animation) =>
          animation.keyframes.some((frame) => String(frame['filter']).includes('blur'))
        )
        expect(blurred.length).toBeGreaterThan(0)

        act(() => {
          for (const animation of [...animations]) animation.finish()
        })
        expect(document.querySelector('[data-noti-heading-layer="previous"]')).toBeNull()
      } finally {
        restore()
      }
    })
  })

  describe('timers', () => {
    it('holds the countdown while the pointer is on the island', () => {
      const { noti, store, clock } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved', duration: 1_000 }))
      const item = firstItem()

      fireEvent.pointerEnter(item)
      advance(clock, 5_000)
      expect(items()).toHaveLength(1)
      expect(store.getCurrent()?.paused).toBe(true)

      fireEvent.pointerLeave(item)
      advance(clock, 1_000)
      expect(items()).toHaveLength(0)
    })

    it('holds it again while something inside has focus', () => {
      const { noti, store, clock } = setup()
      render(<NotiOutletWithStore store={store} closeButton />)
      push(() => noti.success({ title: 'Saved', duration: 1_000 }))

      fireEvent.focusIn(firstItem())
      advance(clock, 5_000)
      expect(items()).toHaveLength(1)

      fireEvent.focusOut(firstItem())
      advance(clock, 1_000)
      expect(items()).toHaveLength(0)
    })

    it('holds the countdown while the document is hidden', () => {
      const { noti, store, clock } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved', duration: 1_000 }))

      const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      advance(clock, 5_000)
      expect(items()).toHaveLength(1)

      hidden.mockReturnValue(false)
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      advance(clock, 1_000)
      expect(items()).toHaveLength(0)
    })
  })

  describe('touch', () => {
    it('does not take the hover hold from a tap', () => {
      const { noti, store, clock } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved', duration: 1_000 }))

      // A tap fires `pointerenter` too, but touch has no reliable leave.
      fireEvent.pointerEnter(firstItem(), { pointerType: 'touch' })
      expect(store.getCurrent()?.paused).toBe(false)

      advance(clock, 1_000)
      expect(items()).toHaveLength(0)
    })

    it('ignores hover entirely where the pointer cannot hover', () => {
      restoreMatchMedia()
      restoreMatchMedia = stubMatchMedia({ '(hover: hover) and (pointer: fine)': false })

      const { noti, store, clock } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved', duration: 1_000 }))

      fireEvent.pointerEnter(firstItem(), { pointerType: 'mouse' })
      advance(clock, 1_000)
      expect(items()).toHaveLength(0)
    })

    it('still opens on focus, so the keyboard loses nothing', () => {
      restoreMatchMedia()
      restoreMatchMedia = stubMatchMedia({ '(hover: hover) and (pointer: fine)': false })

      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} closeButton />)
      push(() => noti.success({ title: 'Saved', description: 'Body' }))

      fireEvent.focusIn(firstItem())
      expect(store.getCurrent()?.expanded).toBe(true)
    })

    describe('tap', () => {
      /** A finger down and up in the same place, wherever it lands. */
      function tap(node: Element, at: { x?: number; y?: number } = {}): void {
        const point = { clientX: at.x ?? 0, clientY: at.y ?? 0 }
        fireEvent.pointerDown(node, { pointerId: 1, pointerType: 'touch', ...point })
        fireEvent.pointerUp(node, { pointerId: 1, pointerType: 'touch', ...point })
      }

      /** Autopilot off: the tap has to be the only thing that opens it. */
      function quiet(noti: NotiApi): void {
        push(() =>
          noti.info({
            title: 'Quiet update',
            description: 'Body',
            autopilot: false,
            duration: 5_000,
          })
        )
      }

      beforeEach(() => {
        restoreMatchMedia()
        restoreMatchMedia = stubMatchMedia({ '(hover: hover) and (pointer: fine)': false })
      })

      it('opens the island a pointer could never hover, and closes it again', () => {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        quiet(noti)

        tap(firstItem())
        expect(store.getCurrent()?.expanded).toBe(true)
        // Held like a hover: the card must not time out while it is being read.
        expect(store.getCurrent()?.paused).toBe(true)

        tap(firstItem())
        expect(store.getCurrent()?.expanded).toBe(false)
        expect(store.getCurrent()?.paused).toBe(false)
      })

      it('gives the countdown back when the next press lands elsewhere', () => {
        const { noti, store, clock } = setup()
        render(<NotiOutletWithStore store={store} />)
        quiet(noti)

        tap(firstItem())
        expect(store.getCurrent()?.paused).toBe(true)

        fireEvent.pointerDown(document.body, { pointerId: 2, pointerType: 'touch' })
        expect(store.getCurrent()?.expanded).toBe(false)
        expect(store.getCurrent()?.paused).toBe(false)

        // A hold nobody released would have kept this one on screen for good.
        advance(clock, 5_000)
        expect(items()).toHaveLength(0)
      })

      it('ignores a tap that lands beside the pill', () => {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        quiet(noti)

        // The item is as wide as the outlet; the pill is a fraction of it, over
        // on the anchored side. jsdom lays nothing out, so the silhouette says
        // where it is.
        const pill = document.querySelector('[data-noti-island-pill]')
        vi.spyOn(pill as Element, 'getBoundingClientRect').mockReturnValue({
          x: 200,
          y: 500,
          left: 200,
          right: 340,
          top: 500,
          bottom: 540,
          width: 140,
          height: 40,
          toJSON: () => ({}),
        })

        // Transparent: this one belongs to whatever the page put underneath.
        tap(firstItem(), { x: 20, y: 520 })
        expect(store.getCurrent()?.expanded).toBe(false)

        tap(firstItem(), { x: 260, y: 520 })
        expect(store.getCurrent()?.expanded).toBe(true)
      })

      it('does not read a swipe as a tap', () => {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} position='bottom-right' />)
        quiet(noti)

        const item = firstItem()
        fireEvent.pointerDown(item, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 })
        fireEvent.pointerMove(item, { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 0 })
        fireEvent.pointerUp(item, { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 0 })

        // Short of the dismiss threshold, so it returns to rest — but it was a
        // drag, and a drag that ends must not leave the card open behind it.
        expect(store.getCurrent()?.expanded).toBe(false)
      })

      it('leaves the button its own taps', () => {
        const onClick = vi.fn()
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        push(() =>
          noti.action({
            title: 'Uploaded',
            description: 'Body',
            autopilot: false,
            button: { title: 'Share', onClick },
          })
        )

        tap(firstItem())
        expect(store.getCurrent()?.expanded).toBe(true)

        // Acting inside the card must not collapse the card it is acting in.
        const button = screen.getByRole('button', { name: 'Share' })
        tap(button)
        fireEvent.click(button)
        expect(store.getCurrent()?.expanded).toBe(true)
        expect(onClick).toHaveBeenCalledTimes(1)
      })

      it('never opens a loading island, whichever pointer asks', () => {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        push(() =>
          noti.show({ type: 'loading', title: 'Uploading', description: 'Contacting the server…' })
        )

        tap(firstItem())
        expect(store.getCurrent()?.expanded).toBe(false)
      })
    })
  })

  describe('lifecycle', () => {
    it('does not let autopilot reopen a card that is leaving', () => {
      // Without a controlled exit the record is removed at once and there is
      // no `exiting` window for the timer to land in.
      const { animations, restore } = installControlledAnimations()
      vi.useFakeTimers()

      try {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        push(() => noti.success({ title: 'Saved', description: 'Body' }))

        // Dismissed before the expand delay elapses.
        push(() => {
          noti.dismiss()
        })
        expect(store.getCurrent()?.phase).toBe('exiting')

        tick(1_000)
        expect(store.getCurrent()?.phase).toBe('exiting')
        expect(store.getCurrent()?.expanded).toBe(false)
        expect(firstItem().getAttribute('data-noti-expanded')).toBeNull()
      } finally {
        vi.useRealTimers()
        restore()
        animations.length = 0
      }
    })
  })

  describe('empty content', () => {
    it('treats a falsy description as no description at all', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      // What `condition && <p/>` produces when the condition is false.
      push(() => noti.success({ title: 'Saved', description: false }))

      const item = firstItem()
      fireEvent.pointerEnter(item)
      expect(store.getCurrent()?.expanded).toBe(false)
      expect(item.querySelector('[data-noti-body]')).toBeNull()
    })

    it('ignores a button without a handler', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() =>
        noti.action({
          title: 'Saved',
          button: null as unknown as { title: string; onClick: () => void },
        })
      )

      expect(items()).toHaveLength(1)
      expect(firstItem().querySelector('[data-noti-button]')).toBeNull()
    })
  })

  describe('button', () => {
    it('renders as a sibling of the live region, never inside another control', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() =>
        noti.action({
          title: 'File uploaded',
          description: 'Share it with your team?',
          button: { title: 'Share now', onClick: () => {} },
        })
      )

      open(firstItem())
      const button = screen.getByRole('button', { name: 'Share now' })
      expect(button.closest('[role="status"]')).toBeNull()
      expect(button.parentElement?.closest('button')).toBeNull()
    })

    it('does not close the notification', () => {
      const { noti, store } = setup()
      const onClick = vi.fn()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.action({ title: 'File uploaded', button: { title: 'Share now', onClick } }))

      open(firstItem())
      fireEvent.click(screen.getByRole('button', { name: 'Share now' }))
      expect(onClick).toHaveBeenCalledTimes(1)
      expect(items()).toHaveLength(1)
    })

    it('reports a handler that throws straight away and stays on screen', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() =>
        noti.action({
          title: 'Saved',
          button: {
            title: 'Undo',
            onClick: () => {
              throw new Error('handler exploded')
            },
          },
        })
      )

      open(firstItem())
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

      // React reports an uncaught handler error itself, so the assertion has
      // to be that *this* library caught it and said so.
      expect(items()).toHaveLength(1)
      expect(error).toHaveBeenCalledWith('[noti] button handler failed', expect.any(Error))
    })

    it('reports a rejected thenable that is not a native promise', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() =>
        noti.action({
          title: 'Saved',
          button: {
            title: 'Undo',
            // A promise from another realm fails `instanceof Promise`.
            onClick: () => ({
              then: (_resolve: unknown, reject: (reason: unknown) => void) => {
                reject(new Error('thenable rejected'))
              },
            }),
          },
        })
      )

      open(firstItem())
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
      await act(async () => {
        await Promise.resolve()
      })

      expect(items()).toHaveLength(1)
      expect(error).toHaveBeenCalled()
    })

    it('reports a rejected handler and stays on screen', async () => {
      const { noti, store } = setup()
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      render(<NotiOutletWithStore store={store} />)
      push(() =>
        noti.action({
          title: 'File uploaded',
          button: { title: 'Share now', onClick: () => Promise.reject(new Error('offline')) },
        })
      )

      open(firstItem())
      fireEvent.click(screen.getByRole('button', { name: 'Share now' }))
      await act(async () => {
        await Promise.resolve()
      })

      expect(items()).toHaveLength(1)
      expect(error).toHaveBeenCalled()
    })

    it('takes an accessible name when the label is not plain text', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() =>
        noti.action({
          title: 'File uploaded',
          button: {
            title: <span aria-hidden='true'>↗</span>,
            accessibleLabel: 'Share now',
            onClick: () => {},
          },
        })
      )

      open(firstItem())
      expect(screen.getByRole('button', { name: 'Share now' })).toBeDefined()
    })
  })

  describe('close button', () => {
    it('is opt-in', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved' }))

      expect(screen.queryByRole('button', { name: 'Close notification' })).toBeNull()
    })

    it('dismisses when it is asked for', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} closeButton />)
      push(() => noti.success({ title: 'Saved' }))

      open(firstItem())
      fireEvent.click(screen.getByRole('button', { name: 'Close notification' }))
      expect(items()).toHaveLength(0)
    })

    it('disappears for a notification the user may not close', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} closeButton />)
      push(() => noti.success({ title: 'Saved', dismissible: false }))

      expect(screen.queryByRole('button', { name: 'Close notification' })).toBeNull()
    })
  })

  describe('swipe', () => {
    /**
     * Release speed is measured from the events' own timestamps, and synthetic
     * events carry the wall clock. Freezing it keeps these tests about distance
     * — the thing they actually assert — instead of about how busy the machine
     * was when they ran.
     */
    let restoreClock = () => {}

    beforeEach(() => {
      const descriptor = Object.getOwnPropertyDescriptor(Event.prototype, 'timeStamp')
      // Non-zero on purpose: React's synthetic event does
      // `nativeEvent.timeStamp || Date.now()`, so a frozen zero falls straight
      // back through to the wall clock this is here to escape.
      Object.defineProperty(Event.prototype, 'timeStamp', { configurable: true, get: () => 1_000 })

      restoreClock = () => {
        if (descriptor === undefined) Reflect.deleteProperty(Event.prototype, 'timeStamp')
        else Object.defineProperty(Event.prototype, 'timeStamp', descriptor)
      }
    })

    afterEach(() => {
      restoreClock()
    })

    function throwItem(item: HTMLElement, to: { x?: number; y?: number }): void {
      fireEvent.pointerDown(item, { pointerId: 1, clientX: 0, clientY: 0 })
      fireEvent.pointerMove(item, { pointerId: 1, clientX: to.x ?? 0, clientY: to.y ?? 0 })
      fireEvent.pointerUp(item, { pointerId: 1, clientX: to.x ?? 0, clientY: to.y ?? 0 })
    }

    it('dismisses when thrown past the threshold in an allowed direction', () => {
      const { noti, store } = setup()
      const onDismiss = vi.fn()
      render(<NotiOutletWithStore store={store} position='bottom-right' />)
      push(() => noti.success({ title: 'Saved', onDismiss }))

      throwItem(firstItem(), { x: 120 })

      expect(items()).toHaveLength(0)
      expect(onDismiss).toHaveBeenCalledWith(expect.objectContaining({ reason: 'swipe' }))
    })

    it('snaps back when released short of the threshold', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} position='bottom-right' />)
      push(() => noti.success({ title: 'Saved' }))

      throwItem(firstItem(), { x: 20 })
      expect(items()).toHaveLength(1)
      expect(firstItem().style.transform).not.toContain('20px')
    })

    it('refuses a direction the notification cannot leave by', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} position='bottom-right' />)
      push(() => noti.success({ title: 'Saved' }))

      // Anchored bottom-right, so leftwards is inwards: it rubber-bands instead.
      throwItem(firstItem(), { x: -200 })
      expect(items()).toHaveLength(1)
    })

    it('throws out from where the finger let go, not from rest', () => {
      const { animations, restore } = installControlledAnimations()

      try {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} position='bottom-right' />)
        push(() => noti.success({ title: 'Saved' }))
        animations.length = 0

        push(() => {
          throwItem(firstItem(), { x: 120 })
        })

        const exit = animations.find((animation) =>
          animation.keyframes.some((frame) => String(frame['transform']).includes('100%'))
        )
        expect(exit).toBeDefined()

        // Starting at rest would snap the island back for a frame first.
        expect(String(exit?.keyframes[0]?.['transform'])).toContain('120px')
      } finally {
        restore()
      }
    })

    it('is never the only way out', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} swipe={false} closeButton />)
      push(() => noti.success({ title: 'Saved' }))

      throwItem(firstItem(), { x: 200 })
      expect(items()).toHaveLength(1)

      open(firstItem())
      fireEvent.click(screen.getByRole('button', { name: 'Close notification' }))
      expect(items()).toHaveLength(0)
    })

    it('leaves a notification the user may not close alone', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} position='bottom-right' />)
      push(() => noti.success({ title: 'Saved', dismissible: false }))

      throwItem(firstItem(), { x: 200 })
      expect(items()).toHaveLength(1)
    })

    it('does not start from a control, so the button still gets its click', () => {
      const { noti, store } = setup()
      const onClick = vi.fn()
      render(<NotiOutletWithStore store={store} position='bottom-right' />)
      push(() => noti.action({ title: 'Saved', button: { title: 'Undo', onClick } }))

      open(firstItem())
      const button = screen.getByRole('button', { name: 'Undo' })
      fireEvent.pointerDown(button, { pointerId: 1, clientX: 0, clientY: 0 })
      fireEvent.pointerMove(firstItem(), { pointerId: 1, clientX: 200, clientY: 0 })
      fireEvent.pointerUp(firstItem(), { pointerId: 1, clientX: 200, clientY: 0 })
      expect(items()).toHaveLength(1)

      fireEvent.click(button)
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('abandons the gesture on pointercancel', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} position='bottom-right' />)
      push(() => noti.success({ title: 'Saved' }))
      const item = firstItem()

      fireEvent.pointerDown(item, { pointerId: 1, clientX: 0, clientY: 0 })
      fireEvent.pointerMove(item, { pointerId: 1, clientX: 200, clientY: 0 })
      fireEvent.pointerCancel(item, { pointerId: 1 })

      expect(items()).toHaveLength(1)
    })

    it('does not begin a swipe while text is selected', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} position='bottom-right' />)
      push(() => noti.success({ title: 'Saved' }))

      const selection = vi
        .spyOn(globalThis, 'getSelection')
        .mockReturnValue({ isCollapsed: false } as Selection)

      throwItem(firstItem(), { x: 200 })
      expect(items()).toHaveLength(1)
      selection.mockRestore()
    })
  })

  describe('presentation', () => {
    it('resolves the theme, and lets it be forced', () => {
      const { noti, store } = setup()
      const { rerender } = render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved' }))

      expect(outlet()?.getAttribute('data-noti-theme')).toBe('light')

      rerender(<NotiOutletWithStore store={store} theme='dark' />)
      expect(outlet()?.getAttribute('data-noti-theme')).toBe('dark')
    })

    it('marks an unstyled outlet so the stylesheet skips it', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} unstyled />)
      push(() => noti.success({ title: 'Saved' }))

      expect(outlet()?.hasAttribute('data-noti-unstyled')).toBe(true)
    })

    it('applies a class per slot', () => {
      const { noti, store } = setup()
      render(
        <NotiOutletWithStore
          store={store}
          closeButton
          classNames={{
            item: 'my-item',
            content: 'my-content',
            icon: 'my-icon',
            title: 'my-title',
            description: 'my-description',
            actions: 'my-actions',
            button: 'my-button',
            close: 'my-close',
          }}
        />
      )
      push(() =>
        noti.action({
          title: 'Saved',
          description: 'Everything is synced.',
          button: { title: 'Undo', onClick: () => {} },
        })
      )

      expect(firstItem().className).toBe('my-item')
      expect(document.querySelector('[data-noti-content]')?.className).toBe('my-content')
      expect(document.querySelector('[data-noti-title]')?.className).toBe('my-title')
      expect(document.querySelector('[data-noti-description]')?.className).toBe('my-description')
      expect(document.querySelector('[data-noti-icon]')?.className).toBe('my-icon')
      expect(document.querySelector('[data-noti-actions]')?.className).toBe('my-actions')
      expect(document.querySelector('[data-noti-button]')?.className).toBe('my-button')
      expect(document.querySelector('[data-noti-close]')?.className).toBe('my-close')
    })

    it('merges call styles over the outlet defaults, slot by slot', () => {
      const { noti, store } = setup()
      render(
        <NotiOutletWithStore
          store={store}
          options={{ styles: { title: 'outlet-title', description: 'outlet-description' } }}
        />
      )
      push(() =>
        noti.success({
          title: 'Saved',
          description: 'Everything is synced.',
          styles: { title: 'call-title' },
        })
      )

      expect(document.querySelector('[data-noti-title]')?.className).toBe('call-title')
      expect(document.querySelector('[data-noti-description]')?.className).toBe(
        'outlet-description'
      )
    })

    it('renders a custom icon, and none at all when asked', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)

      push(() => noti.success({ title: 'Saved', icon: <span data-testid='custom-icon' /> }))
      expect(screen.getByTestId('custom-icon')).toBeDefined()
      expect(document.querySelector('[data-noti-state-icon]')).toBeNull()

      push(() => noti.success({ title: 'Saved again', icon: null }))
      expect(document.querySelector('[data-noti-icon]')).toBeNull()

      push(() => noti.success({ title: 'Saved once more' }))
      expect(document.querySelector('[data-noti-state-icon]')).not.toBeNull()
    })

    it('takes a glyph per state from the outlet', () => {
      const { noti, store } = setup()
      render(
        <NotiOutletWithStore
          store={store}
          icons={{
            info: <span data-testid='outlet-info' />,
            error: <span data-testid='outlet-error' />,
          }}
        />
      )

      push(() => noti.info({ title: 'Heads up' }))
      expect(screen.getByTestId('outlet-info')).toBeDefined()
      expect(document.querySelector('[data-noti-state-icon]')).toBeNull()

      push(() => noti.error({ title: 'Failed' }))
      expect(screen.getByTestId('outlet-error')).toBeDefined()

      // A state the outlet left out keeps the built-in glyph.
      push(() => noti.success({ title: 'Saved' }))
      expect(document.querySelector('[data-noti-state-icon]')).not.toBeNull()
    })

    it('takes a component as well as an element', () => {
      const { noti, store } = setup()

      function PlainIcon() {
        return <span data-testid='plain' />
      }

      // What icon libraries actually export. `lucide-react` icons are
      // `forwardRef` objects, so `typeof === 'function'` would miss them and
      // then React would refuse them as a child.
      const ForwardedIcon = forwardRef<HTMLSpanElement>((props, ref) => (
        <span {...props} ref={ref} data-testid='forwarded' />
      ))
      ForwardedIcon.displayName = 'ForwardedIcon'
      const MemoIcon = memo(function MemoIcon() {
        return <span data-testid='memoized' />
      })

      render(
        <NotiOutletWithStore
          store={store}
          icons={{ info: PlainIcon, error: ForwardedIcon, warning: MemoIcon }}
        />
      )

      push(() => noti.info({ title: 'Heads up' }))
      expect(screen.getByTestId('plain')).toBeDefined()

      push(() => noti.error({ title: 'Failed' }))
      expect(screen.getByTestId('forwarded')).toBeDefined()

      push(() => noti.warning({ title: 'Careful' }))
      expect(screen.getByTestId('memoized')).toBeDefined()
    })

    it('takes a component for a single call too', () => {
      const { noti, store } = setup()

      function CallIcon() {
        return <span data-testid='call-component' />
      }

      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved', icon: CallIcon }))

      expect(screen.getByTestId('call-component')).toBeDefined()
      expect(document.querySelector('[data-noti-state-icon]')).toBeNull()
    })

    it('still renders a plain string as a glyph', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} icons={{ info: '✱' }} />)
      push(() => noti.info({ title: 'Heads up' }))

      expect(textOf(document.querySelector('[data-noti-icon]'))).toBe('✱')
    })

    it('lets a call override the outlet glyph, and drop it', () => {
      const { noti, store } = setup()
      render(
        <NotiOutletWithStore store={store} icons={{ info: <span data-testid='outlet-info' /> }} />
      )

      push(() => noti.info({ title: 'Heads up', icon: <span data-testid='call-icon' /> }))
      expect(screen.getByTestId('call-icon')).toBeDefined()
      expect(screen.queryByTestId('outlet-info')).toBeNull()

      push(() => noti.info({ title: 'Heads up again', icon: null }))
      expect(document.querySelector('[data-noti-icon]')).toBeNull()
    })

    it('drops the badge for a state the outlet set to null', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} icons={{ loading: null }} />)

      push(() => noti.show({ type: 'loading', title: 'Working' }))
      expect(document.querySelector('[data-noti-icon]')).toBeNull()

      push(() => noti.success({ title: 'Done' }))
      expect(document.querySelector('[data-noti-icon]')).not.toBeNull()
    })

    it('restyles the notification already on screen', () => {
      const { noti, store } = setup()
      const { rerender } = render(<NotiOutletWithStore store={store} />)
      push(() => noti.info({ title: 'Heads up' }))
      expect(document.querySelector('[data-noti-state-icon]')).not.toBeNull()

      // Presentation, resolved at render: it is not baked into the record.
      rerender(
        <NotiOutletWithStore store={store} icons={{ info: <span data-testid='late-info' /> }} />
      )
      expect(screen.getByTestId('late-info')).toBeDefined()
      expect(store.getCurrent()?.icon).toBeUndefined()
    })

    it('keeps the outgoing glyph on its own state during a crossfade', () => {
      const { animations, restore } = installControlledAnimations()

      try {
        const { noti, store } = setup()
        render(
          <NotiOutletWithStore
            store={store}
            icons={{
              loading: <span data-testid='outlet-loading' />,
              success: <span data-testid='outlet-success' />,
            }}
          />
        )

        push(() => noti.show({ type: 'loading', title: 'Uploading' }))
        push(() => noti.success({ title: 'Uploaded' }))

        const leaving = document.querySelector('[data-noti-heading-layer="previous"]')
        expect(leaving?.querySelector('[data-testid="outlet-loading"]')).not.toBeNull()

        const current = document.querySelector('[data-noti-heading-layer="current"]')
        expect(current?.querySelector('[data-testid="outlet-success"]')).not.toBeNull()

        act(() => {
          for (const animation of [...animations]) animation.finish()
        })
      } finally {
        restore()
      }
    })

    it('mirrors for right-to-left', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} dir='rtl' />)
      push(() => noti.success({ title: 'Saved' }))

      expect(outlet()?.getAttribute('dir')).toBe('rtl')
    })

    it('leaves --noti-width to the cascade instead of pinning it inline', () => {
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved' }))

      // An inline write would outrank the token the README invites you to set.
      expect(outlet()?.style.getPropertyValue('--noti-width')).toBe('')
    })

    it('draws the silhouette on the width the element actually has', () => {
      const width = vi.spyOn(HTMLLIElement.prototype, 'offsetWidth', 'get').mockReturnValue(380)

      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved' }))

      // A 380px island with a 350px silhouette misaligns pill, header and mask.
      const svg = document.querySelector('[data-noti-island-svg]')
      expect(svg?.getAttribute('width')).toBe('380')
      expect(svg?.getAttribute('viewBox')).toBe('0 0 380 40')
      expect(document.querySelector('[data-noti-island-body]')?.getAttribute('width')).toBe('380')

      width.mockRestore()
    })
  })

  describe('motion preferences', () => {
    it('does not retain an outgoing layer under reduced motion', () => {
      reduceMotion()
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.show({ type: 'loading', title: 'Uploading' }))
      push(() => noti.success({ title: 'Uploaded' }))

      expect(document.querySelector('[data-noti-heading-layer="previous"]')).toBeNull()
      expect(textOf(firstItem())).toContain('Uploaded')
    })

    it('applies a refresh immediately under reduced motion', () => {
      reduceMotion()
      const { noti, store } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'First', description: 'Body', autopilot: false }))
      fireEvent.pointerEnter(firstItem())

      push(() => noti.error({ title: 'Second' }))
      expect(textOf(firstItem())).toContain('Second')
    })

    it('moves nothing on arrival, and only fades', () => {
      reduceMotion()
      const { animations, restore } = installControlledAnimations()

      try {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        push(() => noti.success({ title: 'Saved' }))

        expect(animations.length).toBeGreaterThan(0)
        for (const animation of animations) {
          for (const frame of animation.keyframes) {
            expect(frame['transform']).toBeUndefined()
            expect(frame['filter']).toBeUndefined()
          }
        }
      } finally {
        restore()
      }
    })
  })

  describe('resilience', () => {
    it('renders nothing on the server', () => {
      const { noti, store } = setup()
      noti.success({ title: 'Saved' })

      expect(renderToStaticMarkup(<NotiOutletWithStore store={store} />)).toBe('')
    })

    it('registers exactly one outlet under StrictMode double effects', () => {
      const clock = createFakeTimerHost()
      const warn = vi.fn()
      const store = createNotiStore({ timerHost: clock.host, exitDuration: 0, warn })

      render(
        <StrictMode>
          <NotiOutletWithStore store={store} />
        </StrictMode>
      )

      expect(warn).not.toHaveBeenCalled()
    })

    it('warns when a second outlet is mounted', () => {
      const clock = createFakeTimerHost()
      const warn = vi.fn()
      const store = createNotiStore({ timerHost: clock.host, exitDuration: 0, warn })

      render(
        <>
          <NotiOutletWithStore store={store} />
          <NotiOutletWithStore store={store} />
        </>
      )

      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toContain('More than one <NotiOutlet>')
    })

    it('still renders the island once with a second outlet mounted', () => {
      const clock = createFakeTimerHost()
      const store = createNotiStore({ timerHost: clock.host, exitDuration: 0, warn: () => {} })
      const noti = createNotiApi(store)

      render(
        <>
          <NotiOutletWithStore store={store} />
          <NotiOutletWithStore store={store} position='bottom-left' />
        </>
      )
      push(() => noti.success({ title: 'Saved' }))

      // Two islands would compete for the same hover, focus and countdown.
      expect(items()).toHaveLength(1)
      // And the seat that draws is the one whose defaults are in force.
      expect(firstItem().getAttribute('data-noti-position')).toBe('top-right')
    })

    it('hands the island to the surviving outlet when the first unmounts', () => {
      const { noti, store } = setup()
      const first = render(<NotiOutletWithStore store={store} />)
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved' }))
      expect(items()).toHaveLength(1)

      act(() => {
        first.unmount()
      })

      expect(items()).toHaveLength(1)
      expect(textOf(firstItem())).toContain('Saved')
    })

    it('renders when ResizeObserver is unavailable', () => {
      const resizeObserver = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver')
      Reflect.deleteProperty(globalThis, 'ResizeObserver')

      try {
        const { noti, store } = setup()
        render(<NotiOutletWithStore store={store} />)
        push(() => noti.success({ title: 'Saved' }))

        expect(textOf(firstItem())).toContain('Saved')
      } finally {
        if (resizeObserver !== undefined) {
          Object.defineProperty(globalThis, 'ResizeObserver', resizeObserver)
        }
      }
    })

    it('holds the countdown when it mounts into a tab that is already hidden', () => {
      const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
      const { noti, store, clock } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved', duration: 1_000 }))

      // No `visibilitychange` is coming: the tab was already in the background.
      advance(clock, 5_000)
      expect(items()).toHaveLength(1)

      hidden.mockReturnValue(false)
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      advance(clock, 1_000)
      expect(items()).toHaveLength(0)
    })

    it('releases the hidden-document hold when it unmounts', () => {
      const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
      const { noti, store, clock } = setup()
      const { unmount } = render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved', duration: 1_000 }))

      // The store outlives the outlet, so a hold left behind would pause every
      // notification after it with nothing able to release it.
      unmount()
      hidden.mockReturnValue(false)

      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Again', duration: 1_000 }))
      advance(clock, 1_000)
      expect(items()).toHaveLength(0)
    })

    it('releases the hover hold when the island goes under the pointer', () => {
      const { noti, store, clock } = setup()
      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved', duration: 1_000 }))

      fireEvent.pointerEnter(firstItem())
      // Dismissed by API: the element leaves without a `pointerleave` to follow.
      push(() => {
        noti.dismiss()
      })
      advance(clock, 0)
      expect(items()).toHaveLength(0)

      push(() => noti.success({ title: 'Next', duration: 1_000 }))
      advance(clock, 1_000)
      expect(items()).toHaveLength(0)
    })

    it('releases the focus hold when the island goes from under the keyboard', () => {
      const { noti, store, clock } = setup()
      render(<NotiOutletWithStore store={store} closeButton />)
      push(() => noti.success({ title: 'Saved', duration: 1_000 }))

      fireEvent.focusIn(firstItem())
      push(() => {
        noti.dismiss()
      })
      advance(clock, 0)

      push(() => noti.success({ title: 'Next', duration: 1_000 }))
      advance(clock, 1_000)
      expect(items()).toHaveLength(0)
    })

    it('releases a hover hold when the outlet unmounts under the pointer', () => {
      const { noti, store, clock } = setup()
      const { unmount } = render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved', duration: 1_000 }))

      fireEvent.pointerEnter(firstItem())
      unmount()

      render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Again', duration: 1_000 }))
      advance(clock, 1_000)
      expect(items()).toHaveLength(0)
    })

    it('hands focus back when the notification is dismissed under it', () => {
      const { noti, store } = setup()
      render(
        <>
          <button type='button'>Outside</button>
          <NotiOutletWithStore store={store} closeButton />
        </>
      )
      push(() => noti.success({ title: 'Saved' }))

      const outside = screen.getByRole('button', { name: 'Outside' })
      outside.focus()

      const item = firstItem()
      fireEvent.focusIn(item, { relatedTarget: outside })
      act(() => {
        item.focus()
      })

      push(() => {
        noti.dismiss()
      })
      expect(items()).toHaveLength(0)
      // Not `<body>`: the island left, the user's place in the page did not.
      expect(document.activeElement).toBe(outside)
    })

    it('stops driving the store once unmounted', () => {
      const { noti, store, clock } = setup()
      const { unmount } = render(<NotiOutletWithStore store={store} />)
      push(() => noti.success({ title: 'Saved', duration: 1_000 }))

      unmount()
      expect(items()).toHaveLength(0)

      // The store outlives the UI: its own fallback still retires the record.
      advance(clock, 1_300)
      expect(store.getCurrent()).toBeNull()
    })
  })
})

interface ControlledAnimation {
  element: HTMLElement
  keyframes: Keyframe[]
  finish(): void
}

/**
 * jsdom has no Web Animations API, so `animate` is stubbed with one that only
 * finishes when a test says so — the only way to observe a transitional state.
 */
function installControlledAnimations(): {
  animations: ControlledAnimation[]
  restore(): void
} {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate')
  const animations: ControlledAnimation[] = []

  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    writable: true,
    value(this: HTMLElement, keyframes: Keyframe[]) {
      const listeners = new Map<string, Set<EventListener>>()

      const animation = {
        element: this,
        keyframes,
        addEventListener(type: string, listener: EventListener) {
          const group = listeners.get(type) ?? new Set<EventListener>()
          group.add(listener)
          listeners.set(type, group)
        },
        cancel() {
          for (const listener of listeners.get('cancel') ?? []) listener(new Event('cancel'))
        },
        finish() {
          for (const listener of listeners.get('finish') ?? []) listener(new Event('finish'))
        },
      }

      animations.push(animation)
      return animation as unknown as Animation
    },
  })

  return {
    animations,
    restore() {
      if (descriptor === undefined) Reflect.deleteProperty(HTMLElement.prototype, 'animate')
      else Object.defineProperty(HTMLElement.prototype, 'animate', descriptor)
    },
  }
}
