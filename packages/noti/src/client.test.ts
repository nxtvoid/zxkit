import { describe, expect, it, vi } from 'vitest'

import { createNotiApi, type NotiApi } from './client'
import { createNotiStore, type NotiStore } from './core/store'
import { DEFAULT_DURATION, NOTI_ID } from './core/constants'
import { createFakeTimerHost, flushMicrotasks, type FakeTimerHost } from './test-utils'

function setup(): { noti: NotiApi; store: NotiStore; clock: FakeTimerHost } {
  const clock = createFakeTimerHost()
  const store = createNotiStore({ timerHost: clock.host, exitDuration: 0, warn: () => {} })

  return { noti: createNotiApi(store), store, clock }
}

describe('noti', () => {
  describe('object API', () => {
    it('creates one notification per state', () => {
      const { noti, store } = setup()

      for (const [call, state] of [
        [() => noti.show({ title: 'Shown' }), 'success'],
        [() => noti.success({ title: 'Saved' }), 'success'],
        [() => noti.error({ title: 'Failed' }), 'error'],
        [() => noti.warning({ title: 'Careful' }), 'warning'],
        [() => noti.info({ title: 'Heads up' }), 'info'],
        [() => noti.action({ title: 'Ready' }), 'action'],
      ] as const) {
        call()
        expect(store.getCurrent()?.state).toBe(state)
      }
    })

    it('normalizes an untyped show to success rather than a seventh state', () => {
      const { noti, store } = setup()
      noti.show({ title: 'Shown' })

      expect(store.getCurrent()?.state).toBe('success')
    })

    it('honours an explicit type on show', () => {
      const { noti, store } = setup()
      noti.show({ type: 'warning', title: 'Careful' })

      expect(store.getCurrent()?.state).toBe('warning')
    })

    it('returns the same id every time', () => {
      const { noti } = setup()

      expect(noti.success({ title: 'One' })).toBe(NOTI_ID)
      expect(noti.error({ title: 'Two' })).toBe(NOTI_ID)
      expect(noti.info({ title: 'Three' })).toBe(NOTI_ID)
    })

    it('never holds more than one notification', () => {
      const { noti, store } = setup()

      noti.success({ title: 'One' })
      noti.error({ title: 'Two' })
      noti.warning({ title: 'Three' })

      expect(store.getState()).toEqual({ current: store.getCurrent() })
      expect(store.getCurrent()?.title).toBe('Three')
    })

    it('rejects anything that is not an options object', () => {
      const { noti, store } = setup()

      // @ts-expect-error the textual API is gone: every call takes an object
      expect(() => noti.success('Saved')).toThrow(TypeError)
      // @ts-expect-error a second positional argument no longer exists either
      expect(() => noti.error('Failed', { duration: 4_000 })).toThrow(TypeError)
      // @ts-expect-error undefined is not an options object
      expect(() => noti.info(undefined)).toThrow(/options object/)

      expect(store.getCurrent()).toBeNull()
    })

    it('has no configurable identity or routing', () => {
      const { noti } = setup()

      // @ts-expect-error `id` belongs to the library, not to the caller
      noti.success({ title: 'Saved', id: 'mine' })
      // @ts-expect-error there is one presentation, so there is no appearance
      noti.success({ title: 'Saved', appearance: 'toast' })
      // @ts-expect-error there is one outlet, so there is nothing to route to
      noti.success({ title: 'Saved', outletId: 'sidebar' })
    })
  })

  describe('replacement', () => {
    it('drops fields the second call left out', () => {
      const { noti, store } = setup()
      noti.success({ title: 'Saved', description: 'All 12 records synced.' })
      noti.error({ title: 'Failed' })

      const record = store.getCurrent()
      expect(record?.title).toBe('Failed')
      expect(record?.description).toBeUndefined()
    })

    it('keeps the live position when the replacement omits one', () => {
      const { noti, store } = setup()
      noti.success({ title: 'Saved', position: 'bottom-left' })
      noti.error({ title: 'Failed' })

      expect(store.getCurrent()?.position).toBe('bottom-left')
    })

    it('moves the notification when the replacement names a position', () => {
      const { noti, store } = setup()
      noti.success({ title: 'Saved', position: 'bottom-left' })
      noti.error({ title: 'Failed', position: 'top-center' })

      expect(store.getCurrent()?.position).toBe('top-center')
    })

    it('changes the instance on every call', () => {
      const { noti, store } = setup()
      noti.success({ title: 'Saved' })
      const first = store.getCurrent()?.instanceId

      noti.success({ title: 'Saved' })
      expect(store.getCurrent()?.instanceId).not.toBe(first)
    })

    it('bumps the version only when the content really changed', () => {
      const { noti, store } = setup()
      noti.success({ title: 'Saved' })
      const version = store.getCurrent()?.version

      noti.success({ title: 'Saved' })
      expect(store.getCurrent()?.version).toBe(version)

      noti.success({ title: 'Saved again' })
      expect(store.getCurrent()?.version).toBe((version ?? 0) + 1)
    })

    it('treats a change of urgency as a change of content', () => {
      const { noti, store } = setup()
      noti.error({ title: 'Payment declined' })
      const version = store.getCurrent()?.version

      // Same words, different announcement: the live region has to be told.
      noti.error({ title: 'Payment declined', important: true })
      expect(store.getCurrent()?.version).toBe((version ?? 0) + 1)
      expect(store.getCurrent()?.important).toBe(true)
    })

    it('replaces a notification that is still leaving', () => {
      const { noti, store } = setup()
      noti.success({ title: 'Going' })
      noti.dismiss()
      expect(store.getCurrent()?.phase).toBe('exiting')

      noti.error({ title: 'Arriving' })
      expect(store.getCurrent()?.title).toBe('Arriving')
      expect(store.getCurrent()?.phase).toBe('entering')
    })

    it('keeps a live notification in place instead of replaying its entrance', () => {
      const { noti, store } = setup()
      noti.success({ title: 'First' })
      store.dispatch({ type: 'settle', instanceId: store.getCurrent()?.instanceId ?? 0 })

      noti.error({ title: 'Second' })
      expect(store.getCurrent()?.phase).toBe('visible')
    })

    it('restarts the countdown even when the duration is unchanged', () => {
      const { noti, store, clock } = setup()
      noti.success({ title: 'First', duration: 1_000 })

      clock.advance(900)
      noti.success({ title: 'Second', duration: 1_000 })

      clock.advance(900)
      expect(store.getCurrent()?.phase).toBe('entering')
      clock.advance(100)
      expect(store.getCurrent()).toBeNull()
    })
  })

  describe('options', () => {
    it('treats null, zero, negatives and Infinity as sticky', () => {
      const { noti, store } = setup()

      for (const duration of [null, 0, -1, Number.POSITIVE_INFINITY]) {
        noti.success({ title: 'Sticky', duration })
        expect(store.getCurrent()?.duration).toBe(Number.POSITIVE_INFINITY)
      }
    })

    it('makes a loading notification sticky without asking', () => {
      const { noti, store } = setup()
      noti.show({ type: 'loading', title: 'Uploading file…' })

      expect(store.getCurrent()?.duration).toBe(Number.POSITIVE_INFINITY)
    })

    it('falls back to the island lifetime', () => {
      const { noti, store } = setup()
      noti.success({ title: 'Saved' })

      expect(store.getCurrent()?.duration).toBe(DEFAULT_DURATION)
    })

    it('carries a custom icon, and removes it when asked', () => {
      const { noti, store } = setup()
      noti.success({ title: 'Saved', icon: '🎉' })
      expect(store.getCurrent()?.icon).toBe('🎉')

      noti.success({ title: 'Saved', icon: null })
      expect(store.getCurrent()?.icon).toBeNull()

      noti.success({ title: 'Saved' })
      expect(store.getCurrent()?.icon).toBeUndefined()
    })

    it('keeps fill and roundness as island geometry', () => {
      const { noti, store } = setup()
      noti.success({ title: 'Saved', fill: '#003300', roundness: 24 })

      expect(store.getCurrent()?.fill).toBe('#003300')
      expect(store.getCurrent()?.roundness).toBe(24)
    })

    it('names the state when a call carries no title', () => {
      const { noti, store } = setup()

      for (const [call, title] of [
        [() => noti.success({}), 'Success'],
        [() => noti.error({}), 'Error'],
        [() => noti.warning({}), 'Warning'],
        [() => noti.info({}), 'Info'],
        [() => noti.action({}), 'Action'],
        [() => noti.show({ type: 'loading' }), 'Loading'],
      ] as const) {
        call()
        // An empty island announces nothing and renders a blank badge.
        expect(store.getCurrent()?.title).toBe(title)
      }
    })

    it('ignores a roundness JavaScript can still pass', () => {
      const { noti, store } = setup()

      for (const roundness of [Number.NaN, Number.POSITIVE_INFINITY, -8]) {
        noti.success({ title: 'Saved', roundness })
        const resolved = store.getCurrent()?.roundness

        // A negative radius draws an invalid `rect`.
        expect(Number.isFinite(resolved)).toBe(true)
        expect(resolved).toBeGreaterThanOrEqual(0)
      }
    })

    describe('autopilot', () => {
      it('uses the documented defaults', () => {
        const { noti, store } = setup()
        noti.success({ title: 'Saved' })

        expect(store.getCurrent()?.autopilot).toEqual({
          enabled: true,
          expand: 150,
          collapse: 4_000,
        })
      })

      it('opts out without giving up hover and focus', () => {
        const { noti, store } = setup()
        noti.success({ title: 'Saved', autopilot: false })

        expect(store.getCurrent()?.autopilot.enabled).toBe(false)
      })

      it('falls back to the defaults for delays JavaScript can still pass', () => {
        const { noti, store } = setup()

        for (const timing of [
          { expand: Number.NaN, collapse: Number.NaN },
          { expand: Number.POSITIVE_INFINITY, collapse: Number.NEGATIVE_INFINITY },
          { expand: -50, collapse: -1 },
        ]) {
          noti.success({ title: 'Saved', autopilot: timing })
          const autopilot = store.getCurrent()?.autopilot

          // `NaN` would reach `setTimeout` as "run immediately".
          expect(Number.isFinite(autopilot?.expand)).toBe(true)
          expect(Number.isFinite(autopilot?.collapse)).toBe(true)
          expect(autopilot?.expand).toBeGreaterThanOrEqual(0)
          expect(autopilot?.collapse).toBeGreaterThanOrEqual(0)
        }
      })

      it('clamps both delays to the notification lifetime', () => {
        const { noti, store } = setup()
        noti.success({
          title: 'Saved',
          duration: 1_000,
          autopilot: { expand: 5_000, collapse: 9_000 },
        })

        expect(store.getCurrent()?.autopilot).toEqual({
          enabled: true,
          expand: 1_000,
          collapse: 1_000,
        })
      })

      it('does not schedule an infinite collapse for a sticky notification', () => {
        const { noti, store } = setup()
        noti.success({ title: 'Saved', duration: null })

        expect(Number.isFinite(store.getCurrent()?.autopilot.collapse ?? 0)).toBe(true)
      })
    })
  })

  describe('outlet defaults', () => {
    it('lets a call override the outlet', () => {
      const { noti, store } = setup()
      store.registerOutlet(Symbol('outlet'), {
        position: 'bottom-center',
        options: { duration: 1_000, important: true },
      })

      noti.success({ title: 'Saved' })
      expect(store.getCurrent()?.duration).toBe(1_000)
      expect(store.getCurrent()?.important).toBe(true)

      noti.success({ title: 'Saved', duration: 2_000 })
      expect(store.getCurrent()?.duration).toBe(2_000)
    })

    it('merges styles one slot at a time', () => {
      const { noti, store } = setup()
      store.registerOutlet(Symbol('outlet'), {
        position: 'top-right',
        options: { styles: { title: 'outlet-title', description: 'outlet-description' } },
      })

      noti.success({ title: 'Saved', styles: { title: 'call-title' } })

      expect(store.getCurrent()?.styles).toEqual({
        title: 'call-title',
        description: 'outlet-description',
      })
    })
  })

  describe('dismiss and clear', () => {
    it('dismisses the singleton', () => {
      const { noti, store } = setup()
      noti.success({ title: 'Saved' })
      noti.dismiss()

      expect(store.getCurrent()?.phase).toBe('exiting')
      expect(store.getCurrent()?.dismissReason).toBe('api')
    })

    it('does nothing when there is nothing to dismiss', () => {
      const { noti, store } = setup()
      const before = store.getState()

      noti.dismiss()
      noti.clear()
      expect(store.getState()).toBe(before)
    })

    it('ignores an id that is not the live notification', () => {
      const { noti, store } = setup()
      const id = noti.success({ title: 'Saved' })

      noti.dismiss('some-other-id')
      expect(store.getCurrent()?.phase).toBe('entering')

      noti.dismiss(id)
      expect(store.getCurrent()?.phase).toBe('exiting')
    })

    it('clears without a position', () => {
      const { noti, store } = setup()
      noti.success({ title: 'Saved' })
      noti.clear()

      expect(store.getCurrent()?.phase).toBe('exiting')
    })

    it('clears only a matching position', () => {
      const { noti, store } = setup()
      noti.success({ title: 'Saved', position: 'bottom-left' })

      noti.clear('top-right')
      expect(store.getCurrent()?.phase).toBe('entering')

      noti.clear('bottom-left')
      expect(store.getCurrent()?.phase).toBe('exiting')
    })

    it('resolves an inherited position against the outlet', () => {
      const { noti, store } = setup()
      store.registerOutlet(Symbol('outlet'), { position: 'bottom-center', options: undefined })
      noti.success({ title: 'Saved' })

      noti.clear('top-right')
      expect(store.getCurrent()?.phase).toBe('entering')

      noti.clear('bottom-center')
      expect(store.getCurrent()?.phase).toBe('exiting')
    })
  })

  describe('promise', () => {
    it('shows a sticky loading notification straight away', () => {
      const { noti, store } = setup()
      void noti
        .promise(new Promise<void>(() => {}), { loading: { title: 'Saving…' } })
        .catch(() => {})

      expect(store.getCurrent()?.state).toBe('loading')
      expect(store.getCurrent()?.duration).toBe(Number.POSITIVE_INFINITY)
    })

    it('replaces loading with the success message', async () => {
      const { noti, store } = setup()
      await noti.promise(Promise.resolve({ name: 'zxkit' }), {
        loading: { title: 'Saving…' },
        success: (project) => ({ title: 'Saved', description: project.name }),
      })
      await flushMicrotasks()

      expect(store.getCurrent()?.state).toBe('success')
      expect(store.getCurrent()?.description).toBe('zxkit')
    })

    it('prefers an action message over the success one', async () => {
      const { noti, store } = setup()
      const onClick = vi.fn()
      await noti.promise(Promise.resolve('id-1'), {
        loading: { title: 'Saving…' },
        success: { title: 'Saved' },
        action: () => ({ title: 'Project ready', button: { title: 'Open', onClick } }),
      })
      await flushMicrotasks()

      expect(store.getCurrent()?.state).toBe('action')
      expect(store.getCurrent()?.title).toBe('Project ready')
      expect(store.getCurrent()?.button?.title).toBe('Open')
    })

    it('returns the original promise, rejection included', async () => {
      const { noti, store } = setup()
      const failure = new Error('Network unreachable')

      await expect(
        noti.promise(Promise.reject(failure), {
          loading: { title: 'Saving…' },
          error: (error) => ({ title: 'Could not save', description: String(error) }),
        })
      ).rejects.toBe(failure)
      await flushMicrotasks()

      expect(store.getCurrent()?.state).toBe('error')
    })

    it('accepts a factory and turns a synchronous throw into a rejection', async () => {
      const { noti } = setup()
      const failure = new Error('Boom')

      await expect(
        noti.promise(
          () => {
            throw failure
          },
          { loading: { title: 'Saving…' } }
        )
      ).rejects.toBe(failure)
    })

    it('dismisses instead of showing a message that was never given', async () => {
      const { noti, store } = setup()
      await noti.promise(Promise.resolve('done'), { loading: { title: 'Saving…' } })
      await flushMicrotasks()

      expect(store.getCurrent()?.phase).toBe('exiting')
    })

    it('lets the latest invocation win over a late settlement', async () => {
      const { noti, store } = setup()
      const slow = noti.promise(Promise.resolve('late'), {
        loading: { title: 'Saving…' },
        success: { title: 'Saved' },
      })

      noti.error({ title: 'Something else happened' })
      await slow
      await flushMicrotasks()

      expect(store.getCurrent()?.title).toBe('Something else happened')
      expect(store.getCurrent()?.state).toBe('error')
    })

    it('does not resurrect a notification the user dismissed', async () => {
      const { noti, store } = setup()
      const pending = noti.promise(Promise.resolve('done'), {
        loading: { title: 'Saving…' },
        success: { title: 'Saved' },
      })

      noti.dismiss()
      store.dispatch({ type: 'remove', instanceId: store.getCurrent()?.instanceId ?? 0 })
      await pending
      await flushMicrotasks()

      expect(store.getCurrent()).toBeNull()
    })

    it('runs finally exactly once, either way', async () => {
      const { noti } = setup()
      const settled = vi.fn()

      await noti.promise(Promise.resolve('ok'), { loading: { title: '…' }, finally: settled })
      await flushMicrotasks()
      expect(settled).toHaveBeenCalledTimes(1)

      await expect(
        noti.promise(Promise.reject(new Error('no')), {
          loading: { title: '…' },
          finally: settled,
        })
      ).rejects.toThrow('no')
      await flushMicrotasks()
      expect(settled).toHaveBeenCalledTimes(2)
    })

    it('reports a message callback that throws instead of leaving loading up', async () => {
      const { noti, store } = setup()
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})

      await noti.promise(Promise.resolve('ok'), {
        loading: { title: 'Saving…' },
        success: () => {
          throw new Error('bad message')
        },
      })
      await flushMicrotasks()

      expect(store.getCurrent()?.phase).toBe('exiting')
      expect(error).toHaveBeenCalled()
      error.mockRestore()
    })

    it('carries a flow position through the loading and the outcome', async () => {
      const { noti, store } = setup()

      await noti.promise(Promise.resolve('ok'), {
        position: 'bottom-left',
        loading: { title: 'Saving…' },
        success: { title: 'Saved' },
      })
      expect(store.getCurrent()?.position).toBe('bottom-left')

      await flushMicrotasks()
      expect(store.getCurrent()?.title).toBe('Saved')
      expect(store.getCurrent()?.position).toBe('bottom-left')
    })

    it('lets one message override the flow position', async () => {
      const { noti, store } = setup()

      await noti.promise(Promise.resolve('ok'), {
        position: 'bottom-left',
        loading: { title: 'Saving…' },
        success: { title: 'Saved', position: 'top-center' },
      })
      await flushMicrotasks()

      expect(store.getCurrent()?.position).toBe('top-center')
    })

    it('keeps the flow position even when another call moved the island', async () => {
      const { noti, store } = setup()
      let finish = (): void => {}
      const pending = new Promise<void>((resolve) => {
        finish = () => {
          resolve()
        }
      })

      void noti.promise(pending, {
        position: 'bottom-left',
        loading: { title: 'Saving…' },
        success: { title: 'Saved' },
      })
      finish()
      await flushMicrotasks()

      // Inheriting the live position would have adopted wherever it ended up.
      expect(store.getCurrent()?.position).toBe('bottom-left')
    })

    it('reports a finally callback that rejects instead of leaving it unhandled', async () => {
      const { noti } = setup()
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})

      await noti.promise(Promise.resolve('ok'), {
        loading: { title: 'Saving…' },
        success: { title: 'Saved' },
        // Typed `() => unknown`, so an async callback is allowed to reject.
        finally: () => Promise.reject(new Error('cleanup failed')),
      })
      await flushMicrotasks()

      expect(error).toHaveBeenCalled()
      error.mockRestore()
    })

    it('does not bring back a notification dismissed while it was in flight', async () => {
      const { noti, store, clock } = setup()
      let finish = (): void => {}
      const pending = new Promise<void>((resolve) => {
        finish = () => {
          resolve()
        }
      })

      void noti.promise(pending, { loading: { title: 'Saving…' }, success: { title: 'Saved' } })

      // Still in the store, still holding its `instanceId`, on its way out.
      noti.dismiss()
      expect(store.getCurrent()?.phase).toBe('exiting')

      finish()
      await flushMicrotasks()

      expect(store.getCurrent()?.state).toBe('loading')
      expect(store.getCurrent()?.phase).toBe('exiting')

      clock.advance(0)
      expect(store.getCurrent()).toBeNull()
    })

    it('leaves a settlement from a duplicate module copy off a newer notification', async () => {
      const { store } = setup()
      const first = createNotiApi(store)

      // A second module scope, as HMR or a duplicate bundle produces: it shares
      // the store and must not restart the identity that guards it.
      vi.resetModules()
      const { createNotiApi: createFromCopy } = await import('./client')
      const second = createFromCopy(store)

      let finish = (): void => {}
      const slow = new Promise<void>((resolve) => {
        finish = () => {
          resolve()
        }
      })

      void first.promise(slow, {
        loading: { title: 'A loading' },
        success: { title: 'A done' },
      })
      second.error({ title: 'B error' })

      finish()
      await flushMicrotasks()

      expect(store.getCurrent()?.title).toBe('B error')
      expect(store.getCurrent()?.state).toBe('error')
    })
  })
})

describe('public surface', () => {
  it('exports the API, the outlet and the supported types only', async () => {
    const surface = await import('./index')

    expect(Object.keys(surface).toSorted()).toEqual(['NotiOutlet', 'noti'])
  })

  it('no longer exposes the store, the item or a records hook', async () => {
    const surface: Record<string, unknown> = await import('./index')

    for (const removed of [
      'NotiItem',
      'useNotiRecords',
      'createNotiApi',
      'createNotiStore',
      'defaultNotiStore',
      'notiReducer',
      'createNotiId',
      'createNotiTimer',
      'DEFAULT_OUTLET_ID',
    ]) {
      expect(surface[removed]).toBeUndefined()
    }
  })
})
