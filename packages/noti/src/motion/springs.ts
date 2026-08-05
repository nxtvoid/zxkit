import { ENTER_DURATION, HEADER_EXIT_DURATION, SPRING_DURATION } from '../core/constants'

/**
 * Motion tokens.
 *
 * A spring sampled as a `linear()` easing that CSS and the Web Animations API
 * both understand: the physics survive, the dependency does not.
 */
export interface NotiMotionToken {
  duration: number
  easing: string
}

/** 600ms, ~4% overshoot. The island's signature: a morph, not a resize. */
export const SPRING =
  'linear(0, 0.002 0.6%, 0.007 1.2%, 0.015 1.8%, 0.026 2.4%, 0.041 3.1%, 0.06 3.8%, 0.108 5.3%, 0.157 6.6%, 0.214 8%, 0.467 13.7%, 0.577 16.3%, 0.631 17.7%, 0.682 19.1%, 0.73 20.5%, 0.771 21.8%, 0.808 23.1%, 0.844 24.5%, 0.874 25.8%, 0.903 27.2%, 0.928 28.6%, 0.952 30.1%, 0.972 31.6%, 0.988 33.1%, 1.01 35.7%, 1.025 38.5%, 1.034 41.6%, 1.038 45%, 1.035 50.1%, 1.012 64.2%, 1.003 73%, 0.999 83.7%, 1)'

/** Critically damped, for closing: an overshoot would dip below zero and flash back. */
export const SETTLE =
  'linear(0, 0.078 5%, 0.235 10%, 0.401 15%, 0.549 20%, 0.669 25%, 0.762 30%, 0.831 35%, 0.882 40%, 0.918 45%, 0.944 50%, 0.962 55%, 0.974 60%, 0.982 65%, 0.988 70%, 0.992 75%, 0.995 80%, 0.996 85%, 0.998 90%, 0.998 95%, 1)'

export const NOTI_MOTION = {
  enter: { duration: ENTER_DURATION, easing: SPRING },
  exit: { duration: ENTER_DURATION, easing: SPRING },
  headingEnter: { duration: SPRING_DURATION, easing: SPRING },
  /** Shorter than the entrance, so the two layers never fight. */
  headingExit: { duration: HEADER_EXIT_DURATION, easing: 'ease' },
  swipeReturn: { duration: 240, easing: SETTLE },
  swipeOut: { duration: 160, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
} as const satisfies Record<string, NotiMotionToken>

type NotiMotionName = keyof typeof NOTI_MOTION

/**
 * What each spring-driven token is, as a fraction of the one duration behind
 * them. `--noti-spring-duration` is documented as overridable, so the Web
 * Animations side has to scale with it rather than hold the built-in numbers —
 * otherwise a changed token leaves the silhouette and the heading out of step.
 *
 * The swipe tokens are absent on purpose: a gesture's speed comes from the
 * hand, not from the island's morph.
 */
const SPRING_RATIO: Partial<Record<NotiMotionName, number>> = {
  enter: ENTER_DURATION / SPRING_DURATION,
  exit: ENTER_DURATION / SPRING_DURATION,
  headingEnter: 1,
  headingExit: HEADER_EXIT_DURATION / SPRING_DURATION,
}

/**
 * The token to animate with, rescaled to whatever `--noti-spring-duration`
 * resolved to on the element.
 */
export function motionToken(
  name: NotiMotionName,
  reduced: boolean,
  springDuration: number = SPRING_DURATION
): NotiMotionToken {
  // Opacity only, and brief. Zero would make an arrival easy to miss.
  if (reduced) return { duration: 100, easing: 'linear' }

  const token = NOTI_MOTION[name]
  const ratio = SPRING_RATIO[name]
  if (ratio === undefined || springDuration === SPRING_DURATION) return token

  return { duration: Math.round(springDuration * ratio), easing: token.easing }
}
