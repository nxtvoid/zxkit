import type { NotiPosition, NotiState } from '../types'

/** Identity of the singleton. Every call resolves to it, so calls replace. */
export const NOTI_ID = 'noti-default'

export const DEFAULT_DURATION = 6_000
export const DEFAULT_POSITION: NotiPosition = 'top-right'
/**
 * A token reference rather than a colour: the surface has to follow
 * `data-noti-theme`, and the record is built before any outlet is involved. The
 * literal is the fallback for a mount that ships no stylesheet. A call's own
 * `fill` replaces it wholesale and stops following the theme, which is the
 * point of passing one.
 */
export const DEFAULT_FILL = 'var(--noti-surface, #1a1a1a)'
export const DEFAULT_ROUNDNESS = 16

export const DEFAULT_EXPAND_DELAY = 150
export const DEFAULT_COLLAPSE_DELAY = 4_000

export const COMPACT_HEIGHT = 40
export const DEFAULT_WIDTH = 350

/** Smallest card, as a multiple of the pill. Less reads as a glitch. */
export const MIN_EXPAND_RATIO = 2.25

export const PILL_PADDING = 10

/** Room the close control needs inside the pill, so it never sits on the title. */
export const CLOSE_SLOT = 26

/** Blur as a fraction of the radius: it becomes the neck, so it has to scale with it. */
export const BLUR_RATIO = 0.5

/** Everything geometric runs on this. */
export const SPRING_DURATION = 600

export const ENTER_DURATION = Math.round(SPRING_DURATION * 0.66)
export const HEADER_EXIT_DURATION = Math.round(SPRING_DURATION * 0.7)
export const ENTER_TRAVEL = 6
export const ENTER_SCALE = 0.95
export const HEADER_BLUR = 6

/** How long a timing fallback waits past the animation it is covering. */
export const FALLBACK_MARGIN = 60

/**
 * When the record is removed with no UI driving it.
 *
 * Derived from the exit animation rather than guessed: the store schedules this
 * on every exit, mounted outlet or not, so a shorter delay would tear the
 * element out from under the throw the outlet is still animating.
 */
export const DEFAULT_EXIT_DURATION = ENTER_DURATION + FALLBACK_MARGIN

/** `setTimeout` overflows past a signed 32-bit int, so long timers are sliced. */
export const MAX_TIMEOUT = 2_147_483_647

/** `loading` has no natural end. */
export const STATE_DURATIONS: Partial<Record<NotiState, number>> = {
  loading: Number.POSITIVE_INFINITY,
}
