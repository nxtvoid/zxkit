import { describe, expect, it, vi } from 'vitest'

import { createFakeTimerHost } from '../test-utils'
import { MAX_TIMEOUT } from './constants'
import { createNotiTimer, isSticky } from './timer'

describe('isSticky', () => {
  it('treats Infinity, zero and negatives as never-closing', () => {
    expect(isSticky(Number.POSITIVE_INFINITY)).toBe(true)
    expect(isSticky(0)).toBe(true)
    expect(isSticky(-1)).toBe(true)
    expect(isSticky(Number.NaN)).toBe(true)
    expect(isSticky(1)).toBe(false)
  })
})

describe('createNotiTimer', () => {
  it('expires once after its duration', () => {
    const clock = createFakeTimerHost()
    const onExpire = vi.fn()
    const timer = createNotiTimer({ duration: 1_000, host: clock.host, onExpire })

    timer.start()
    clock.advance(999)
    expect(onExpire).not.toHaveBeenCalled()

    clock.advance(1)
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(timer.finished).toBe(true)

    clock.advance(10_000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('never arms for a sticky duration', () => {
    const clock = createFakeTimerHost()
    const onExpire = vi.fn()
    const timer = createNotiTimer({
      duration: Number.POSITIVE_INFINITY,
      host: clock.host,
      onExpire,
    })

    timer.start()
    clock.advance(1_000_000)
    expect(onExpire).not.toHaveBeenCalled()
    expect(clock.pending()).toBe(0)
  })

  it('holds the countdown until every reason is released', () => {
    const clock = createFakeTimerHost()
    const onExpire = vi.fn()
    const timer = createNotiTimer({ duration: 1_000, host: clock.host, onExpire })

    timer.start()
    clock.advance(400)

    expect(timer.pause('hover')).toBe(true)
    expect(timer.pause('focus')).toBe(false)
    expect(timer.pauseReasons()).toEqual(['hover', 'focus'])

    clock.advance(10_000)
    expect(onExpire).not.toHaveBeenCalled()
    expect(timer.remaining()).toBe(600)

    // One reason gone is not enough.
    expect(timer.resume('hover')).toBe(false)
    clock.advance(10_000)
    expect(onExpire).not.toHaveBeenCalled()

    expect(timer.resume('focus')).toBe(true)
    clock.advance(599)
    expect(onExpire).not.toHaveBeenCalled()

    clock.advance(1)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('ignores releasing a reason that was never held', () => {
    const clock = createFakeTimerHost()
    const timer = createNotiTimer({ duration: 1_000, host: clock.host, onExpire: vi.fn() })

    timer.start()
    expect(timer.resume('hover')).toBe(false)
    expect(timer.paused).toBe(false)
  })

  it('re-arms in slices past the 32-bit setTimeout ceiling', () => {
    const clock = createFakeTimerHost()
    const onExpire = vi.fn()
    const duration = MAX_TIMEOUT + 5_000
    const timer = createNotiTimer({ duration, host: clock.host, onExpire })

    timer.start()
    clock.advance(MAX_TIMEOUT)
    expect(onExpire).not.toHaveBeenCalled()

    clock.advance(5_000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('restarts with a new duration on reset', () => {
    const clock = createFakeTimerHost()
    const onExpire = vi.fn()
    const timer = createNotiTimer({ duration: 1_000, host: clock.host, onExpire })

    timer.start()
    clock.advance(900)
    timer.reset(2_000)

    clock.advance(1_900)
    expect(onExpire).not.toHaveBeenCalled()

    clock.advance(100)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('restarts on reset even when the duration is identical', () => {
    const clock = createFakeTimerHost()
    const onExpire = vi.fn()
    const timer = createNotiTimer({ duration: 1_000, host: clock.host, onExpire })

    timer.start()
    clock.advance(900)
    // This is what a new `instanceId` means downstream: the countdown belongs
    // to the notification that armed it, not to the number of milliseconds.
    timer.reset(1_000)

    clock.advance(900)
    expect(onExpire).not.toHaveBeenCalled()

    clock.advance(100)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('keeps its holds across a reset', () => {
    const clock = createFakeTimerHost()
    const onExpire = vi.fn()
    const timer = createNotiTimer({ duration: 1_000, host: clock.host, onExpire })

    timer.start()
    timer.pause('hover')
    timer.reset(1_000)

    clock.advance(10_000)
    expect(onExpire).not.toHaveBeenCalled()

    timer.resume('hover')
    clock.advance(1_000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('leaves nothing scheduled after dispose', () => {
    const clock = createFakeTimerHost()
    const onExpire = vi.fn()
    const timer = createNotiTimer({ duration: 1_000, host: clock.host, onExpire })

    timer.start()
    expect(clock.pending()).toBe(1)

    timer.dispose()
    expect(clock.pending()).toBe(0)

    clock.advance(10_000)
    expect(onExpire).not.toHaveBeenCalled()
  })
})
