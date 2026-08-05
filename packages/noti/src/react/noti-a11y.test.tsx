// @vitest-environment jsdom

import axe from 'axe-core'
import { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { createNotiApi, type NotiApi } from '../client'
import { createNotiStore, type NotiStore } from '../core/store'
import { createFakeTimerHost } from '../test-utils'
import { NotiOutletWithStore } from './noti-outlet'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

afterEach(cleanup)

function setup(): { noti: NotiApi; store: NotiStore } {
  const clock = createFakeTimerHost()
  const store = createNotiStore({ timerHost: clock.host, exitDuration: 0, warn: () => {} })

  return { noti: createNotiApi(store), store }
}

/** Store mutations come from outside React and need an `act()` boundary. */
function push<T>(run: () => T): T {
  let result: T | undefined
  act(() => {
    result = run()
  })

  return result as T
}

/**
 * Lets the island finish arriving.
 *
 * `NotiItem` flips itself to ready on the next frame, so an `await` in the
 * middle of a test hands that update back to React with no `act()` around it —
 * which is a warning, and a state the assertions below never see.
 */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve)
    })
  })
}

/** axe reports plenty of advisory noise; only real barriers should fail a build. */
async function seriousViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    resultTypes: ['violations'],
    // jsdom has no layout engine and no canvas, so contrast cannot be measured
    // here at all. It belongs in the visual tests, on a real browser.
    rules: { 'color-contrast': { enabled: false } },
  })

  return results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  )
}

describe('accessibility', () => {
  it('has no serious axe violations with a button and a close button', async () => {
    const { noti, store } = setup()
    const { container } = render(<NotiOutletWithStore store={store} closeButton />)

    push(() =>
      noti.action({
        title: 'File uploaded',
        description: 'Share it with your team?',
        autopilot: false,
        button: { title: 'Share now', onClick: () => {} },
      })
    )

    await settle()

    // Open: the collapsed island keeps its controls out of the accessibility
    // tree entirely, so auditing it closed would audit nothing.
    act(() => {
      fireEvent.pointerEnter(document.querySelector('[data-noti-item]') as HTMLElement)
    })
    expect(await seriousViolations(container)).toEqual([])
  })

  it('has no serious axe violations for an assertive error', async () => {
    const { noti, store } = setup()
    const { container } = render(<NotiOutletWithStore store={store} closeButton />)

    push(() =>
      noti.error({
        title: 'Could not save',
        description: 'The server rejected it.',
        important: true,
      })
    )
    await settle()

    expect(await seriousViolations(container)).toEqual([])
  })

  it('never nests one control inside another', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} closeButton />)

    push(() =>
      noti.action({
        title: 'Uploaded',
        description: 'Ready to share.',
        button: { title: 'Share', onClick: () => {} },
      })
    )

    const controls = document.querySelectorAll('button, a[href], input, select, textarea')
    expect(controls.length).toBeGreaterThan(0)

    for (const control of controls) {
      expect(control.parentElement?.closest('button, a[href]')).toBeNull()
    }
  })

  it('keeps the action button a sibling of the live region', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} />)

    push(() =>
      noti.action({
        title: 'Uploaded',
        description: 'Ready to share.',
        button: { title: 'Share', onClick: () => {} },
      })
    )

    const region = document.querySelector('[data-noti-content]')
    const button = screen.getByRole('button', { name: 'Share' })

    // Nesting the action inside a control-shaped island is the thing to avoid.
    // The root is structural, and the button sits next to the live region.
    expect(region?.contains(button)).toBe(false)
    expect(button.parentElement?.parentElement).toBe(region?.parentElement)
    expect(document.querySelector('[data-noti-item]')?.tagName).toBe('LI')
  })

  it('exposes exactly one live region', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} closeButton />)
    push(() => noti.success({ title: 'Saved', description: 'Everything is synced.' }))

    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1)
  })

  it('announces politely by default, even for errors', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} />)
    push(() => noti.error({ title: 'Could not save' }))

    const region = document.querySelector('[data-noti-content]')
    expect(region?.getAttribute('role')).toBe('status')
    expect(region?.getAttribute('aria-live')).toBe('polite')
    expect(region?.getAttribute('aria-atomic')).toBe('true')
  })

  it('only becomes assertive when asked', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} />)
    push(() => noti.error({ title: 'Payment declined', important: true }))

    const region = document.querySelector('[data-noti-content]')
    expect(region?.getAttribute('role')).toBe('alert')
    expect(region?.getAttribute('aria-live')).toBe('assertive')
  })

  it('adopts a new urgency even when the words did not change', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} />)

    push(() => noti.error({ title: 'Payment declined' }))
    expect(document.querySelector('[data-noti-content]')?.getAttribute('role')).toBe('status')

    // Identical content: without urgency in the identity the island would keep
    // rendering the previous view, and the region would stay polite.
    push(() => noti.error({ title: 'Payment declined', important: true }))
    const region = document.querySelector('[data-noti-content]')
    expect(region?.getAttribute('role')).toBe('alert')
    expect(region?.getAttribute('aria-live')).toBe('assertive')
  })

  it('keeps the announcement region across a replacement so the change is read once', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} />)

    push(() => noti.show({ type: 'loading', title: 'Uploading…' }))
    const before = document.querySelector('[data-noti-content]')
    const version = store.getCurrent()?.version

    push(() => noti.success({ title: 'Uploaded' }))
    const after = document.querySelector('[data-noti-content]')

    // Same live region, new content: a replacement is announced, a re-render is not.
    expect(after).toBe(before)
    expect(after?.textContent).toContain('Uploaded')
    expect(store.getCurrent()?.version).toBe((version ?? 0) + 1)
  })

  it('does not re-announce when a call repeats itself', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} />)

    push(() => noti.success({ title: 'Saved' }))
    const version = store.getCurrent()?.version

    push(() => noti.success({ title: 'Saved' }))
    expect(store.getCurrent()?.version).toBe(version)
  })

  it('announces the whole notification at once, open or not', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} />)
    push(() =>
      noti.success({ title: 'Saved', description: 'All 12 records synced.', autopilot: false })
    )

    // The description is only visually hidden while the island is compact. It
    // stays in the accessibility tree, so the atomic announcement is complete
    // the moment the content changes — and opening the island later does not
    // change what the live region says, so nothing is read twice.
    const region = document.querySelector('[data-noti-content]')
    expect(region?.textContent).toContain('Saved')
    expect(region?.textContent).toContain('All 12 records synced.')

    const before = region?.textContent
    push(() => {
      store.dispatch({
        type: 'expand',
        instanceId: store.getCurrent()?.instanceId ?? 0,
        expanded: true,
      })
    })
    expect(document.querySelector('[data-noti-content]')?.textContent).toBe(before)
  })

  it('gives the close button a configurable accessible name', () => {
    const { noti, store } = setup()
    const { rerender } = render(<NotiOutletWithStore store={store} closeButton />)
    push(() => noti.success({ title: 'Saved' }))

    expect(screen.getByRole('button', { name: 'Close notification' })).toBeTruthy()

    rerender(<NotiOutletWithStore store={store} closeButton closeButtonLabel='Cerrar aviso' />)
    expect(screen.getByRole('button', { name: 'Cerrar aviso' })).toBeTruthy()
  })

  it('reaches every control with the keyboard', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} closeButton />)

    push(() =>
      noti.action({
        title: 'Saved',
        description: 'Everything is synced.',
        button: { title: 'View', onClick: () => {} },
      })
    )

    // Reachable while the island is still compact. Hiding them until it opens
    // would leave the keyboard depending on an expansion only a pointer can
    // trigger, so the controls carry the disclosure rather than the island.
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
    expect(buttons).toHaveLength(2)
    for (const button of buttons) {
      expect(getComputedStyle(button).visibility).not.toBe('hidden')
    }

    for (const button of buttons) {
      // No negative tabindex, no aria-hidden wrapper: both are tabbable.
      expect(button.getAttribute('tabindex')).toBeNull()
      expect(button.closest('[aria-hidden="true"]')).toBeNull()

      // Focusing pauses the countdown, which is a store update.
      act(() => {
        button.focus()
      })
      expect(document.activeElement).toBe(button)
    }
  })

  it('does not move focus when a notification arrives', () => {
    const { noti, store } = setup()
    render(
      <>
        <button type='button'>Outside</button>
        <NotiOutletWithStore store={store} closeButton />
      </>
    )

    const outside = screen.getByRole('button', { name: 'Outside' })
    outside.focus()

    push(() => noti.action({ title: 'Saved', button: { title: 'View', onClick: () => {} } }))
    push(() => noti.error({ title: 'Replaced' }))

    expect(document.activeElement).toBe(outside)
  })

  it('marks decorative icons as hidden', () => {
    const { noti, store } = setup()
    render(<NotiOutletWithStore store={store} />)
    push(() => noti.success({ title: 'Saved' }))

    expect(document.querySelector('[data-noti-icon]')?.getAttribute('aria-hidden')).toBe('true')
    expect(document.querySelector('[data-noti-island-canvas]')?.getAttribute('aria-hidden')).toBe(
      'true'
    )
  })

  it('renders on the server without touching the DOM', () => {
    const { noti, store } = setup()
    noti.success({ title: 'Saved before hydration' })

    // No window, no document, no matchMedia: the server renders an empty outlet
    // so the client has nothing to mismatch against.
    expect(renderToStaticMarkup(<NotiOutletWithStore store={store} />)).toBe('')
  })
})
