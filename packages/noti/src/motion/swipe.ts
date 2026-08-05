import type { NotiPosition } from '../types'

type NotiSwipeDirection = 'up' | 'down' | 'left' | 'right'
export type NotiSwipeAxis = 'x' | 'y'

export interface NotiSwipeConfig {
  directions: readonly NotiSwipeDirection[]
  /** Pixels of travel before the gesture commits to an axis. */
  deadZone: number
  /** Pixels of travel that dismiss on release. */
  threshold: number
  /** Pixels per millisecond that dismiss on release regardless of distance. */
  velocity: number
}

export const DEFAULT_SWIPE_CONFIG: Omit<NotiSwipeConfig, 'directions'> = {
  deadZone: 6,
  threshold: 45,
  velocity: 0.35,
}

/** Outwards only: dragging towards the middle would push it into content. */
export function defaultSwipeDirections(position: NotiPosition): NotiSwipeDirection[] {
  const vertical: NotiSwipeDirection = position.startsWith('top') ? 'up' : 'down'

  if (position.endsWith('left')) return ['left', vertical]
  if (position.endsWith('right')) return ['right', vertical]
  return ['left', 'right', vertical]
}

/** Locks an axis past the dead zone, so a vertical scroll cannot drag sideways. */
export function resolveSwipeAxis(dx: number, dy: number, deadZone: number): NotiSwipeAxis | null {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  if (Math.max(absX, absY) < deadZone) return null
  return absX > absY ? 'x' : 'y'
}

export function directionOf(axis: NotiSwipeAxis, delta: number): NotiSwipeDirection {
  if (axis === 'x') return delta > 0 ? 'right' : 'left'
  return delta > 0 ? 'down' : 'up'
}

/** Rubber-banding: follows the finger reluctantly. Nothing at all reads as broken. */
export function dampSwipe(distance: number, limit = 60): number {
  const sign = Math.sign(distance)
  const magnitude = Math.abs(distance)

  return sign * limit * (1 - Math.exp(-magnitude / limit))
}

/** Damps the delta when the direction is not one it can leave by. */
export function resolveSwipeOffset(
  axis: NotiSwipeAxis,
  delta: number,
  directions: readonly NotiSwipeDirection[]
): { offset: number; allowed: boolean } {
  const allowed = directions.includes(directionOf(axis, delta))
  return { offset: allowed ? delta : dampSwipe(delta), allowed }
}

/** Distance or speed — either is enough. A flick should not need to travel far. */
export function shouldDismissOnRelease(
  offset: number,
  velocity: number,
  config: Pick<NotiSwipeConfig, 'threshold' | 'velocity'>
): boolean {
  return Math.abs(offset) >= config.threshold || Math.abs(velocity) >= config.velocity
}

const INTERACTIVE =
  'button, a[href], input, select, textarea, [contenteditable], [data-noti-no-swipe]'

/** A drag from a button steals its click; one from a selection fights it. */
export function canStartSwipe(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest(INTERACTIVE) !== null) return false

  const selection = typeof getSelection === 'function' ? getSelection() : null
  if (selection !== null && !selection.isCollapsed) return false

  return true
}

/** Half a frame. Two events in the same tick say nothing about speed. */
export const MIN_VELOCITY_WINDOW = 8

/** Pixels per millisecond over the tail of the gesture, not its whole length. */
export function swipeVelocity(distance: number, elapsed: number): number {
  return elapsed < MIN_VELOCITY_WINDOW ? 0 : distance / elapsed
}
