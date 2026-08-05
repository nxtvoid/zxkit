import { describe, expect, it, vi } from 'vitest'

import { createFakeTimerHost, makeRecord } from '../test-utils'
import { DEFAULT_POSITION } from './constants'
import { createNotiStore } from './store'

function setup(exitDuration = 300) {
  const clock = createFakeTimerHost()
  const warn = vi.fn()
  const store = createNotiStore({ timerHost: clock.host, exitDuration, warn })

  return { clock, store, warn }
}

describe('createNotiStore', () => {
  it('keeps state identity stable across no-op commands', () => {
    const { store } = setup()
    const before = store.getState()

    store.dispatch({ type: 'dismiss', instanceId: 999, reason: 'api' })
    expect(store.getState()).toBe(before)
  })

  it('notifies subscribers only when state changes', () => {
    const { store } = setup()
    const listener = vi.fn()
    store.subscribe(listener)

    store.dispatch({ type: 'replace', record: makeRecord() })
    expect(listener).toHaveBeenCalledTimes(1)

    store.dispatch({ type: 'settle', instanceId: 999 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes idempotently', () => {
    const { store } = setup()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    unsubscribe()
    unsubscribe()
    store.subscribe(listener)
    store.dispatch({ type: 'replace', record: makeRecord() })

    expect(listener).toHaveBeenCalledTimes(1)
  })

  describe('timers', () => {
    it('auto-closes and then removes', () => {
      const { store, clock } = setup()
      const onAutoClose = vi.fn()
      store.dispatch({ type: 'replace', record: makeRecord({ duration: 1_000, onAutoClose }) })

      clock.advance(999)
      expect(store.getCurrent()?.phase).not.toBe('exiting')

      clock.advance(1)
      expect(store.getCurrent()?.phase).toBe('exiting')
      expect(onAutoClose).toHaveBeenCalledWith({ id: 'noti-default', reason: 'timeout' })

      clock.advance(300)
      expect(store.getCurrent()).toBeNull()
    })

    it('never arms a timer for a sticky notification', () => {
      const { store, clock } = setup()
      store.dispatch({
        type: 'replace',
        record: makeRecord({ duration: Number.POSITIVE_INFINITY }),
      })

      clock.advance(1_000_000)
      expect(store.getCurrent()?.phase).toBe('entering')
    })

    it('restarts the countdown for a replacement with the same duration', () => {
      const { store, clock } = setup()
      store.dispatch({ type: 'replace', record: makeRecord({ duration: 1_000 }) })

      clock.advance(800)
      // Same duration, new instance: comparing milliseconds alone would let the
      // replacement inherit 200ms of life it never had.
      store.dispatch({ type: 'replace', record: makeRecord({ duration: 1_000 }) })

      clock.advance(800)
      expect(store.getCurrent()?.phase).not.toBe('exiting')

      clock.advance(200)
      expect(store.getCurrent()?.phase).toBe('exiting')
    })

    it('lets an old timeout expire without closing the new notification', () => {
      const { store, clock } = setup()
      const stale = vi.fn()
      store.dispatch({ type: 'replace', record: makeRecord({ duration: 500, onAutoClose: stale }) })

      clock.advance(400)
      store.dispatch({
        type: 'replace',
        record: makeRecord({ duration: Number.POSITIVE_INFINITY }),
      })

      clock.advance(10_000)
      expect(store.getCurrent()?.phase).toBe('entering')
      expect(stale).not.toHaveBeenCalled()
    })

    it('lets an old exit expire without removing the new notification', () => {
      const { store, clock } = setup()
      store.dispatch({ type: 'replace', record: makeRecord() })
      store.dispatch({ type: 'dismiss', instanceId: store.getCurrent()?.instanceId, reason: 'api' })

      clock.advance(200)
      const arriving = makeRecord()
      store.dispatch({ type: 'replace', record: arriving })

      clock.advance(1_000)
      expect(store.getCurrent()?.instanceId).toBe(arriving.instanceId)
    })
  })

  describe('holds', () => {
    it('resumes only once every reason is gone', () => {
      const { store, clock } = setup()
      store.dispatch({ type: 'replace', record: makeRecord({ duration: 1_000 }) })

      store.pause('hover')
      store.pause('focus')
      clock.advance(5_000)
      expect(store.getCurrent()?.phase).toBe('entering')
      expect(store.getCurrent()?.paused).toBe(true)

      store.resume('hover')
      clock.advance(5_000)
      expect(store.getCurrent()?.phase).toBe('entering')

      store.resume('focus')
      expect(store.getCurrent()?.paused).toBe(false)
      clock.advance(1_000)
      expect(store.getCurrent()?.phase).toBe('exiting')
    })

    it('carries a live hold onto the replacement', () => {
      const { store, clock } = setup()
      store.dispatch({ type: 'replace', record: makeRecord({ duration: 1_000 }) })
      store.pause('hover')

      // The pointer never left the island, so the new instance is held too.
      store.dispatch({ type: 'replace', record: makeRecord({ duration: 1_000 }) })
      clock.advance(5_000)
      expect(store.getCurrent()?.phase).toBe('entering')

      store.resume('hover')
      clock.advance(1_000)
      expect(store.getCurrent()?.phase).toBe('exiting')
    })

    it('ignores a repeated pause and an unknown resume', () => {
      const { store } = setup()
      store.dispatch({ type: 'replace', record: makeRecord({ duration: 1_000 }) })

      store.pause('hover')
      store.pause('hover')
      store.resume('focus')
      store.resume('hover')

      expect(store.getCurrent()?.paused).toBe(false)
    })
  })

  describe('callbacks', () => {
    it('reports a replacement to the notification it displaced, once', () => {
      const { store } = setup()
      const onDismiss = vi.fn()
      store.dispatch({ type: 'replace', record: makeRecord({ onDismiss }) })
      store.dispatch({ type: 'replace', record: makeRecord() })

      expect(onDismiss).toHaveBeenCalledTimes(1)
      expect(onDismiss).toHaveBeenCalledWith({ id: 'noti-default', reason: 'replaced' })
    })

    it('does not report a replacement twice when the old one had already left', () => {
      const { store } = setup()
      const onDismiss = vi.fn()
      const record = makeRecord({ onDismiss })
      store.dispatch({ type: 'replace', record })
      store.dispatch({ type: 'dismiss', instanceId: record.instanceId, reason: 'swipe' })
      store.dispatch({ type: 'replace', record: makeRecord() })

      expect(onDismiss).toHaveBeenCalledTimes(1)
      expect(onDismiss).toHaveBeenCalledWith({ id: 'noti-default', reason: 'swipe' })
    })

    it('separates auto-close from dismissal', () => {
      const { store, clock } = setup()
      const onDismiss = vi.fn()
      const onAutoClose = vi.fn()
      store.dispatch({
        type: 'replace',
        record: makeRecord({ duration: 100, onDismiss, onAutoClose }),
      })

      clock.advance(100)
      expect(onAutoClose).toHaveBeenCalledTimes(1)
      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('names the reason the user gave', () => {
      const { store } = setup()
      const onDismiss = vi.fn()
      const record = makeRecord({ onDismiss })
      store.dispatch({ type: 'replace', record })
      store.dispatch({ type: 'dismiss', instanceId: record.instanceId, reason: 'close-button' })

      expect(onDismiss).toHaveBeenCalledWith({ id: 'noti-default', reason: 'close-button' })
    })
  })

  describe('outlet registration', () => {
    it('falls back to the library position with nothing mounted', () => {
      const { store } = setup()
      expect(store.getDefaults()).toEqual({ position: DEFAULT_POSITION, options: undefined })
    })

    it('publishes the outlet position and defaults', () => {
      const { store } = setup()
      const release = store.registerOutlet(Symbol('outlet'), {
        position: 'bottom-center',
        options: { duration: 1_000 },
      })

      expect(store.getDefaults().position).toBe('bottom-center')
      expect(store.getDefaults().options).toEqual({ duration: 1_000 })

      release()
      expect(store.getDefaults().position).toBe(DEFAULT_POSITION)
    })

    it('warns when a second outlet is mounted', () => {
      const { store, warn } = setup()
      store.registerOutlet(Symbol('outlet'), { position: 'top-right', options: undefined })
      expect(warn).not.toHaveBeenCalled()

      store.registerOutlet(Symbol('outlet'), { position: 'top-left', options: undefined })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toContain('More than one <NotiOutlet>')
    })

    it('releases idempotently', () => {
      const { store } = setup()
      const release = store.registerOutlet(Symbol('outlet'), {
        position: 'top-left',
        options: undefined,
      })

      release()
      release()
      expect(store.getDefaults().position).toBe(DEFAULT_POSITION)
    })

    it('gives the render to the first outlet and nothing to the second', () => {
      const { store } = setup()
      const first = Symbol('first')
      const second = Symbol('second')

      // Before anyone registers, an outlet is free to render its first pass.
      expect(store.isRenderOwner(first)).toBe(true)

      store.registerOutlet(first, { position: 'top-right', options: undefined })
      store.registerOutlet(second, { position: 'top-left', options: undefined })

      expect(store.isRenderOwner(first)).toBe(true)
      expect(store.isRenderOwner(second)).toBe(false)
      // The defaults follow the owner, not the last one to mount.
      expect(store.getDefaults().position).toBe('top-right')
    })

    it('promotes the surviving outlet when the owner unmounts', () => {
      const { store } = setup()
      const first = Symbol('first')
      const second = Symbol('second')
      const listener = vi.fn()

      const release = store.registerOutlet(first, { position: 'top-right', options: undefined })
      store.registerOutlet(second, { position: 'top-left', options: undefined })
      store.subscribe(listener)

      release()

      expect(store.isRenderOwner(second)).toBe(true)
      expect(store.getDefaults().position).toBe('top-left')
      // Ownership is an answer the other outlet is subscribed to.
      expect(listener).toHaveBeenCalled()
    })
  })

  describe('exit fallback', () => {
    it('reschedules a live exit when the outlet reports a longer one', () => {
      const clock = createFakeTimerHost()
      const store = createNotiStore({ timerHost: clock.host, warn: () => {} })
      const record = makeRecord()

      store.dispatch({ type: 'replace', record })
      // Dismissed before the outlet ever mounted: booked against the default.
      store.dispatch({ type: 'dismiss', instanceId: record.instanceId, reason: 'api' })

      store.setExitDuration(852)

      clock.advance(600)
      expect(store.getCurrent()?.phase).toBe('exiting')

      clock.advance(300)
      expect(store.getCurrent()).toBeNull()
    })

    it('keeps a host-pinned duration whatever the outlet reports', () => {
      const clock = createFakeTimerHost()
      const store = createNotiStore({ timerHost: clock.host, exitDuration: 0, warn: () => {} })
      const record = makeRecord()

      store.dispatch({ type: 'replace', record })
      store.dispatch({ type: 'dismiss', instanceId: record.instanceId, reason: 'api' })
      store.setExitDuration(5_000)

      clock.advance(0)
      expect(store.getCurrent()).toBeNull()
    })
  })

  describe('faulty callbacks', () => {
    it('keeps reconciling after onDismiss throws', () => {
      const { store, clock } = setup(300)
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const listener = vi.fn()
      const record = makeRecord({
        onDismiss: () => {
          throw new Error('bad callback')
        },
      })

      store.dispatch({ type: 'replace', record })
      store.subscribe(listener)
      store.dispatch({ type: 'dismiss', instanceId: record.instanceId, reason: 'api' })

      expect(error).toHaveBeenCalled()
      // The subscriber still heard about it, and the removal was still booked.
      expect(listener).toHaveBeenCalledTimes(1)
      clock.advance(300)
      expect(store.getCurrent()).toBeNull()

      error.mockRestore()
    })

    it('keeps reconciling after onAutoClose throws', () => {
      const { store, clock } = setup(300)
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const record = makeRecord({
        duration: 1_000,
        onAutoClose: () => {
          throw new Error('bad callback')
        },
      })

      store.dispatch({ type: 'replace', record })
      clock.advance(1_000)

      expect(error).toHaveBeenCalled()
      expect(store.getCurrent()?.phase).toBe('exiting')

      clock.advance(300)
      expect(store.getCurrent()).toBeNull()
    })

    it('lets one throwing subscriber not silence the rest', () => {
      const { store } = setup()
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const second = vi.fn()

      store.subscribe(() => {
        throw new Error('bad subscriber')
      })
      store.subscribe(second)

      store.dispatch({ type: 'replace', record: makeRecord() })

      expect(second).toHaveBeenCalledTimes(1)
      expect(error).toHaveBeenCalled()
      error.mockRestore()
    })
  })

  describe('destroy', () => {
    it('drops state, timers and listeners', () => {
      const { store, clock } = setup()
      const listener = vi.fn()
      const onAutoClose = vi.fn()
      store.subscribe(listener)
      store.dispatch({ type: 'replace', record: makeRecord({ duration: 100, onAutoClose }) })
      listener.mockClear()

      store.destroy()
      clock.advance(10_000)

      expect(store.getCurrent()).toBeNull()
      expect(listener).not.toHaveBeenCalled()
      expect(onAutoClose).not.toHaveBeenCalled()
    })

    it('ignores commands afterwards', () => {
      const { store } = setup()
      store.destroy()
      store.dispatch({ type: 'replace', record: makeRecord() })

      expect(store.getCurrent()).toBeNull()
    })
  })
})
