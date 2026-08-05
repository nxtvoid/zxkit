import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SWIPE_CONFIG,
  MIN_VELOCITY_WINDOW,
  dampSwipe,
  defaultSwipeDirections,
  directionOf,
  resolveSwipeAxis,
  resolveSwipeOffset,
  shouldDismissOnRelease,
  swipeVelocity,
} from './swipe'

describe('defaultSwipeDirections', () => {
  it('always points away from the screen, never into it', () => {
    expect(defaultSwipeDirections('bottom-right')).toEqual(['right', 'down'])
    expect(defaultSwipeDirections('top-left')).toEqual(['left', 'up'])
    expect(defaultSwipeDirections('top-center')).toEqual(['left', 'right', 'up'])
    expect(defaultSwipeDirections('bottom-center')).toEqual(['left', 'right', 'down'])
  })
})

describe('resolveSwipeAxis', () => {
  it('stays undecided inside the dead zone', () => {
    expect(resolveSwipeAxis(3, 2, 6)).toBeNull()
    expect(resolveSwipeAxis(-5, 5, 6)).toBeNull()
  })

  it('locks to the dominant axis once the dead zone is cleared', () => {
    expect(resolveSwipeAxis(20, 4, 6)).toBe('x')
    expect(resolveSwipeAxis(4, -20, 6)).toBe('y')
  })

  it('prefers vertical on a tie, so page scrolling wins ambiguous drags', () => {
    expect(resolveSwipeAxis(10, 10, 6)).toBe('y')
  })
})

describe('directionOf', () => {
  it('maps a signed delta to a compass direction', () => {
    expect(directionOf('x', 10)).toBe('right')
    expect(directionOf('x', -10)).toBe('left')
    expect(directionOf('y', 10)).toBe('down')
    expect(directionOf('y', -10)).toBe('up')
  })
})

describe('dampSwipe', () => {
  it('keeps its sign', () => {
    expect(dampSwipe(50)).toBeGreaterThan(0)
    expect(dampSwipe(-50)).toBeLessThan(0)
  })

  it('gives way less and less, and never past the limit', () => {
    expect(Math.abs(dampSwipe(20, 60))).toBeLessThan(20)
    expect(Math.abs(dampSwipe(1_000, 60))).toBeLessThanOrEqual(60)
    expect(Math.abs(dampSwipe(400, 60))).toBeGreaterThan(Math.abs(dampSwipe(100, 60)))
  })

  it('does not move what has not moved', () => {
    expect(dampSwipe(0)).toBe(0)
  })
})

describe('resolveSwipeOffset', () => {
  const directions = ['right', 'down'] as const

  it('follows the finger in an allowed direction', () => {
    expect(resolveSwipeOffset('x', 40, directions)).toEqual({ offset: 40, allowed: true })
  })

  it('rubber-bands the other way instead of refusing to move', () => {
    const { offset, allowed } = resolveSwipeOffset('x', -40, directions)

    expect(allowed).toBe(false)
    expect(offset).toBeLessThan(0)
    expect(Math.abs(offset)).toBeLessThan(40)
  })
})

describe('shouldDismissOnRelease', () => {
  it('dismisses once dragged past the threshold', () => {
    expect(shouldDismissOnRelease(50, 0, DEFAULT_SWIPE_CONFIG)).toBe(true)
    expect(shouldDismissOnRelease(44, 0, DEFAULT_SWIPE_CONFIG)).toBe(false)
  })

  it('dismisses a fast flick that barely travelled', () => {
    expect(shouldDismissOnRelease(12, 0.9, DEFAULT_SWIPE_CONFIG)).toBe(true)
  })

  it('works in both directions', () => {
    expect(shouldDismissOnRelease(-50, 0, DEFAULT_SWIPE_CONFIG)).toBe(true)
    expect(shouldDismissOnRelease(-12, -0.9, DEFAULT_SWIPE_CONFIG)).toBe(true)
  })
})

describe('swipeVelocity', () => {
  it('is distance over time', () => {
    expect(swipeVelocity(100, 200)).toBe(0.5)
  })

  it('returns zero rather than Infinity for an instantaneous gesture', () => {
    expect(swipeVelocity(100, 0)).toBe(0)
    expect(swipeVelocity(100, -1)).toBe(0)
  })

  it('refuses to read a speed from a sub-frame window', () => {
    // Two events in the same tick say nothing about how fast the finger moved;
    // dividing by that gap would turn any nudge into a flick.
    expect(swipeVelocity(20, 1)).toBe(0)
    expect(swipeVelocity(20, MIN_VELOCITY_WINDOW - 1)).toBe(0)
    expect(swipeVelocity(20, MIN_VELOCITY_WINDOW)).toBeGreaterThan(0)
  })
})
