// @vitest-environment jsdom

import { Activity, StrictMode, useEffect, useLayoutEffect } from 'react'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNotiApi, noti as globalNoti } from '../client'
import { defaultNotiStore } from '../core/default-store'
import { createNotiStore, type NotiStore } from '../core/store'
import { createFakeTimerHost, flushMicrotasks } from '../test-utils'
import { useNoti, useNotiWithStore } from './use-noti'

const stores: NotiStore[] = []

afterEach(() => {
  cleanup()
  for (const store of stores) store.destroy()
  stores.length = 0
  const current = defaultNotiStore.getCurrent()
  if (current !== null) {
    globalNoti.dismiss()
    defaultNotiStore.dispatch({ type: 'remove', instanceId: current.instanceId })
  }
})

function setup() {
  const clock = createFakeTimerHost()
  const store = createNotiStore({ timerHost: clock.host, exitDuration: 0 })
  stores.push(store)
  return { store, clock, global: createNotiApi(store) }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('useNoti', () => {
  it('uses the global store and dismisses a sticky confirmation on unmount', () => {
    const { result, unmount } = renderHook(() => useNoti())
    const onDismiss = vi.fn()
    const id = result.current.warning({
      title: 'Continue?',
      duration: null,
      keepExpanded: true,
      onDismiss,
    })
    expect(defaultNotiStore.getCurrent()).toMatchObject({ id, phase: 'entering' })

    unmount()

    expect(defaultNotiStore.getCurrent()).toMatchObject({ id, phase: 'exiting' })
    expect(onDismiss).toHaveBeenCalledExactlyOnceWith({ id, reason: 'api' })
  })

  it('keeps the API stable across renders without subscribing the component', () => {
    const { store } = setup()
    const subscribe = vi.spyOn(store, 'subscribe')
    const { result, rerender, unmount } = renderHook(() => useNotiWithStore(store))
    const api = result.current
    const id = api.info({ title: 'Still here' })

    rerender()

    expect(result.current).toBe(api)
    expect(result.current.warning).toBe(api.warning)
    expect(store.getCurrent()).toMatchObject({ id, phase: 'entering' })
    expect(subscribe).not.toHaveBeenCalled()
    unmount()
    expect(store.getCurrent()?.phase).toBe('exiting')
  })

  it('does not dismiss a global notification when it created nothing', () => {
    const { store, global } = setup()
    const { unmount } = renderHook(() => useNotiWithStore(store))
    const id = global.success({ title: 'Saved' })
    unmount()
    expect(store.getCurrent()).toMatchObject({ id, phase: 'entering' })
  })

  it('leaves replacements from the global API alone', () => {
    const { store, global } = setup()
    const { result, unmount } = renderHook(() => useNotiWithStore(store))
    result.current.warning({ title: 'Confirm?' })
    const id = global.success({ title: 'Saved' })
    unmount()
    expect(store.getCurrent()).toMatchObject({ id, phase: 'entering' })
  })

  it('isolates two hook owners, including dismiss, clear and update', () => {
    const { store } = setup()
    const first = renderHook(() => useNotiWithStore(store))
    const second = renderHook(() => useNotiWithStore(store))
    first.result.current.warning({ title: 'First' })
    const id = second.result.current.warning({ title: 'Second' })

    first.result.current.dismiss()
    first.result.current.dismiss(id)
    first.result.current.clear()
    expect(first.result.current.update(id, { title: 'Wrong owner' })).toBe(false)
    first.unmount()
    expect(store.getCurrent()).toMatchObject({ id, title: 'Second', phase: 'entering' })

    second.unmount()
    expect(store.getCurrent()).toMatchObject({ id, phase: 'exiting' })
  })

  it('allows scoped dismissal and respects id and position filters', () => {
    const { store } = setup()
    const { result } = renderHook(() => useNotiWithStore(store))
    const id = result.current.info({ title: 'Local', position: 'top-left' })
    result.current.dismiss('stale')
    result.current.clear('bottom-right')
    expect(store.getCurrent()).toMatchObject({ id, phase: 'entering' })
    result.current.clear('top-left')
    expect(store.getCurrent()?.phase).toBe('exiting')

    result.current.info({ title: 'Another' })
    result.current.dismiss()
    expect(store.getCurrent()?.phase).toBe('exiting')
  })

  it('keeps ownership through scoped and global updates', () => {
    const { store, global } = setup()
    const { result, unmount } = renderHook(() => useNotiWithStore(store))
    const id = result.current.loading({ title: 'Working' })
    expect(result.current.update(id, { title: 'Almost there' })).toBe(true)
    expect(global.update(id, { type: 'success', title: 'Done' })).toBe(true)
    unmount()
    expect(store.getCurrent()).toMatchObject({ id, title: 'Done', phase: 'exiting' })
  })

  it('does not claim a higher-priority global notification', () => {
    const { store, global } = setup()
    const id = global.warning({ title: 'Important', priority: 10 })
    const { result, unmount } = renderHook(() => useNotiWithStore(store))
    result.current.info({ title: 'Suppressed' })
    unmount()
    expect(store.getCurrent()).toMatchObject({ id, phase: 'entering' })
  })

  it('retains ownership of its live notification after a suppressed call', () => {
    const { store } = setup()
    const { result, unmount } = renderHook(() => useNotiWithStore(store))
    const id = result.current.warning({ title: 'Important', priority: 10 })
    result.current.info({ title: 'Suppressed' })
    unmount()
    expect(store.getCurrent()).toMatchObject({ id, phase: 'exiting' })
  })

  it.each(['success', 'error', 'action'] as const)(
    'keeps ownership when a promise becomes %s',
    async (state) => {
      const { store } = setup()
      const { result, unmount } = renderHook(() => useNotiWithStore(store))
      const task = deferred<string>()
      const returned = result.current.promise(task.promise, {
        loading: { title: 'Working' },
        [state]: { title: 'Outcome', duration: null },
      })
      expect(returned).toBe(task.promise)
      const loadingId = store.getCurrent()?.id
      if (state === 'error') task.reject(new Error('Failed'))
      else task.resolve('Done')
      await flushMicrotasks()
      expect(store.getCurrent()).toMatchObject({ state, title: 'Outcome' })
      expect(store.getCurrent()?.id).not.toBe(loadingId)
      unmount()
      expect(store.getCurrent()?.phase).toBe('exiting')
    }
  )

  it.each(['resolve', 'reject'] as const)(
    'does not resurrect loading on late %s, and still runs finally',
    async (outcome) => {
      const { store, clock, global } = setup()
      const { result, unmount } = renderHook(() => useNotiWithStore(store))
      const task = deferred<string>()
      const onFinally = vi.fn()
      result.current.promise(task.promise, {
        loading: { title: 'Working' },
        success: { title: 'Done' },
        error: { title: 'Failed' },
        finally: onFinally,
      })
      unmount()
      clock.advance(0)
      expect(store.getCurrent()).toBeNull()
      const id = global.info({ title: 'New page' })
      if (outcome === 'resolve') task.resolve('Done')
      else task.reject(new Error('Failed'))
      await flushMicrotasks()
      expect(store.getCurrent()).toMatchObject({ id, title: 'New page', phase: 'entering' })
      expect(onFinally).toHaveBeenCalledTimes(1)
    }
  )

  it('drops a promise message that finishes resolving after unmount', async () => {
    const { store, clock } = setup()
    const { result, unmount } = renderHook(() => useNotiWithStore(store))
    const message = deferred<{ title: string }>()
    const success = vi.fn(() => message.promise)
    result.current.promise(Promise.resolve('Done'), {
      loading: { title: 'Working' },
      success,
    })
    await flushMicrotasks()
    expect(success).toHaveBeenCalledTimes(1)
    unmount()
    clock.advance(0)
    message.resolve({ title: 'Late outcome' })
    await flushMicrotasks()
    expect(store.getCurrent()).toBeNull()
  })

  it('leaves another owner intact when a replaced promise settles', async () => {
    const { store, global } = setup()
    const { result, unmount } = renderHook(() => useNotiWithStore(store))
    const task = deferred<string>()
    result.current.promise(task.promise, {
      loading: { title: 'Working' },
      success: { title: 'Done' },
    })
    const id = global.success({ title: 'Other operation' })
    task.resolve('Done')
    await flushMicrotasks()
    unmount()
    expect(store.getCurrent()).toMatchObject({ id, phase: 'entering' })
  })

  it('makes retained API calls inert after unmount without cancelling promises', async () => {
    const { store, global } = setup()
    const { result, unmount } = renderHook(() => useNotiWithStore(store))
    const api = result.current
    unmount()
    const id = global.info({ title: 'Current page' })
    for (const method of [
      'show',
      'loading',
      'success',
      'error',
      'warning',
      'info',
      'action',
    ] as const) {
      expect(typeof api[method]({ title: 'Late' })).toBe('string')
    }
    expect(api.update(id, { title: 'Late' })).toBe(false)
    api.dismiss()
    api.clear()
    const task = Promise.resolve('Result')
    const returned = api.promise(() => task, {
      loading: { title: 'Late loading' },
      success: { title: 'Late success' },
    })
    expect(returned).toBe(task)
    await expect(returned).resolves.toBe('Result')
    await flushMicrotasks()
    expect(store.getCurrent()).toMatchObject({ id, title: 'Current page', phase: 'entering' })
  })

  it('does not reopen from its own onDismiss during unmount', () => {
    const { store } = setup()
    const { result, unmount } = renderHook(() => useNotiWithStore(store))
    const id = result.current.warning({
      title: 'Confirm?',
      onDismiss: () => result.current.info({ title: 'Late callback' }),
    })
    unmount()
    expect(store.getCurrent()).toMatchObject({ id, phase: 'exiting' })
  })

  it('tracks a reentrant replacement created by onDismiss', () => {
    const { store, global } = setup()
    const { result, unmount } = renderHook(() => useNotiWithStore(store))
    global.info({
      title: 'First',
      onDismiss: () => result.current.info({ title: 'Reentrant' }),
    })
    result.current.info({ title: 'Intermediate' })
    expect(store.getCurrent()?.title).toBe('Reentrant')
    unmount()
    expect(store.getCurrent()).toMatchObject({ title: 'Reentrant', phase: 'exiting' })
  })

  it('retires a hidden Activity and lets its preserved hook create again when visible', () => {
    const { store, global } = setup()
    function Page() {
      const api = useNotiWithStore(store)
      return <button onClick={() => api.warning({ title: 'Local', duration: null })}>Show</button>
    }
    const { rerender, unmount } = render(
      <Activity mode='visible'>
        <Page />
      </Activity>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(store.getCurrent()?.title).toBe('Local')

    rerender(
      <Activity mode='hidden'>
        <Page />
      </Activity>
    )
    expect(store.getCurrent()?.phase).toBe('exiting')
    const id = global.info({ title: 'Another page' })

    rerender(
      <Activity mode='visible'>
        <Page />
      </Activity>
    )
    expect(store.getCurrent()).toMatchObject({ id, phase: 'entering' })
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(store.getCurrent()).toMatchObject({ title: 'Local', phase: 'entering' })
    unmount()
    expect(store.getCurrent()?.phase).toBe('exiting')
  })

  it.each([useEffect, useLayoutEffect])('survives StrictMode replay with %s', (useMountEffect) => {
    const { store } = setup()
    const { result, unmount } = renderHook(
      () => {
        const api = useNotiWithStore(store)
        useMountEffect(() => {
          api.warning({ title: 'Mounted', duration: null })
        }, [api])
        return api
      },
      { wrapper: StrictMode }
    )
    expect(store.getCurrent()).toMatchObject({ title: 'Mounted', phase: 'entering' })
    act(() => {
      result.current.success({ title: 'Still active' })
    })
    expect(store.getCurrent()?.title).toBe('Still active')
    unmount()
    expect(store.getCurrent()?.phase).toBe('exiting')
  })
})
