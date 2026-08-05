import { describe, expect, it } from 'vitest'

import { makeRecord } from '../test-utils'
import { initialNotiStoreState, notiReducer, type NotiStoreState } from './reducer'

function replace(state: NotiStoreState, record = makeRecord()): NotiStoreState {
  return notiReducer(state, { type: 'replace', record })
}

describe('notiReducer', () => {
  it('starts empty', () => {
    expect(initialNotiStoreState.current).toBeNull()
  })

  it('returns the same state object for a no-op', () => {
    const state = replace(initialNotiStoreState, makeRecord({ instanceId: 1 }))

    expect(notiReducer(state, { type: 'settle', instanceId: 99 })).toBe(state)
    expect(notiReducer(state, { type: 'remove', instanceId: 99 })).toBe(state)
    expect(notiReducer(state, { type: 'expand', instanceId: 99, expanded: true })).toBe(state)
    expect(notiReducer(state, { type: 'dismiss', instanceId: 99, reason: 'api' })).toBe(state)
  })

  describe('replace', () => {
    it('fills an empty store', () => {
      const record = makeRecord()
      expect(replace(initialNotiStoreState, record).current).toBe(record)
    })

    it('overwrites a visible notification instead of keeping both', () => {
      let state = replace(initialNotiStoreState, makeRecord({ title: 'First' }))
      state = notiReducer(state, { type: 'settle', instanceId: state.current?.instanceId ?? 0 })
      const second = makeRecord({ title: 'Second', phase: 'visible' })
      state = replace(state, second)

      expect(state.current).toBe(second)
      expect(state.current?.title).toBe('Second')
    })

    it('takes over a notification that is already leaving', () => {
      let state = replace(initialNotiStoreState, makeRecord({ title: 'Going' }))
      state = notiReducer(state, {
        type: 'dismiss',
        instanceId: state.current?.instanceId ?? 0,
        reason: 'swipe',
      })
      expect(state.current?.phase).toBe('exiting')

      const arriving = makeRecord({ title: 'Arriving', phase: 'entering' })
      state = replace(state, arriving)

      expect(state.current).toBe(arriving)
      expect(state.current?.dismissReason).toBeUndefined()
    })
  })

  describe('staleness', () => {
    it('ignores a settle aimed at a replaced instance', () => {
      const first = makeRecord()
      const second = makeRecord({ phase: 'entering' })
      const state = replace(replace(initialNotiStoreState, first), second)

      expect(notiReducer(state, { type: 'settle', instanceId: first.instanceId })).toBe(state)
      expect(
        notiReducer(state, { type: 'settle', instanceId: second.instanceId }).current?.phase
      ).toBe('visible')
    })

    it('never lets an old timeout dismiss the new notification', () => {
      const first = makeRecord()
      const second = makeRecord()
      const state = replace(replace(initialNotiStoreState, first), second)

      expect(
        notiReducer(state, { type: 'dismiss', instanceId: first.instanceId, reason: 'timeout' })
      ).toBe(state)
    })

    it('never lets an old exit remove the new notification', () => {
      const first = makeRecord()
      const second = makeRecord()
      const state = replace(replace(initialNotiStoreState, first), second)

      expect(notiReducer(state, { type: 'remove', instanceId: first.instanceId })).toBe(state)
      expect(
        notiReducer(state, { type: 'remove', instanceId: second.instanceId }).current
      ).toBeNull()
    })

    it('ignores a stale expansion', () => {
      const first = makeRecord()
      const second = makeRecord()
      const state = replace(replace(initialNotiStoreState, first), second)

      expect(
        notiReducer(state, { type: 'expand', instanceId: first.instanceId, expanded: true })
      ).toBe(state)
    })
  })

  describe('dismiss', () => {
    it('marks the exit and records the reason', () => {
      const record = makeRecord()
      const state = notiReducer(replace(initialNotiStoreState, record), {
        type: 'dismiss',
        instanceId: record.instanceId,
        reason: 'swipe',
      })

      expect(state.current?.phase).toBe('exiting')
      expect(state.current?.dismissReason).toBe('swipe')
    })

    it('is idempotent', () => {
      const record = makeRecord()
      const state = notiReducer(replace(initialNotiStoreState, record), {
        type: 'dismiss',
        instanceId: record.instanceId,
        reason: 'api',
      })

      expect(
        notiReducer(state, {
          type: 'dismiss',
          instanceId: record.instanceId,
          reason: 'close-button',
        })
      ).toBe(state)
    })

    it('accepts an untargeted dismiss as "whatever is live"', () => {
      const record = makeRecord()
      const state = notiReducer(replace(initialNotiStoreState, record), {
        type: 'dismiss',
        instanceId: undefined,
        reason: 'api',
      })

      expect(state.current?.phase).toBe('exiting')
    })
  })

  it('toggles expansion and pause without touching the phase', () => {
    const record = makeRecord({ phase: 'visible' })
    let state = replace(initialNotiStoreState, record)

    state = notiReducer(state, { type: 'expand', instanceId: record.instanceId, expanded: true })
    state = notiReducer(state, { type: 'set-paused', instanceId: record.instanceId, paused: true })

    expect(state.current?.expanded).toBe(true)
    expect(state.current?.paused).toBe(true)
    expect(state.current?.phase).toBe('visible')

    expect(
      notiReducer(state, { type: 'expand', instanceId: record.instanceId, expanded: true })
    ).toBe(state)
  })

  it('holds at most one notification, whatever the sequence', () => {
    let state = initialNotiStoreState
    for (const title of ['a', 'b', 'c', 'd']) {
      state = replace(state, makeRecord({ title }))
      expect(state.current).not.toBeNull()
    }

    expect(state.current?.title).toBe('d')
  })

  it('refuses to expand or pause a record that is leaving', () => {
    const record = makeRecord({ description: 'body' })
    const leaving = notiReducer(
      { current: record },
      { type: 'dismiss', instanceId: record.instanceId, reason: 'api' }
    )

    // A timer scheduled before the dismiss can still fire after it.
    const expanded = notiReducer(leaving, {
      type: 'expand',
      instanceId: record.instanceId,
      expanded: true,
    })
    expect(expanded).toBe(leaving)
    expect(expanded.current?.expanded).toBe(false)

    const paused = notiReducer(leaving, {
      type: 'set-paused',
      instanceId: record.instanceId,
      paused: true,
    })
    expect(paused).toBe(leaving)
  })
})
