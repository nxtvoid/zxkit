import type { NotiMotionToken } from './springs'

/**
 * One running animation per element, per channel, so the island's own movement
 * and its heading crossfade never cancel each other.
 */
type NotiMotionChannel = 'transform' | 'content'

const running = new WeakMap<Element, Map<NotiMotionChannel, Animation>>()

function supportsWebAnimations(element: Element): boolean {
  return typeof (element as HTMLElement).animate === 'function'
}

/** Stops an element's animation on one channel, leaving the others alone. */
export function cancelNotiAnimation(element: Element, channel: NotiMotionChannel): void {
  const channels = running.get(element)
  const animation = channels?.get(channel)
  if (animation === undefined) return

  animation.cancel()
  channels?.delete(channel)
}

export function cancelAllNotiAnimations(element: Element): void {
  const channels = running.get(element)
  if (channels === undefined) return

  for (const animation of channels.values()) animation.cancel()
  running.delete(element)
}

/**
 * Runs a keyframe animation, replacing whatever was on the same channel, so an
 * interrupted morph retargets instead of queueing.
 *
 * Without the Web Animations API — the server, jsdom — `onFinish` runs at once,
 * so the lifecycle still completes.
 */
export function animateNoti(
  element: Element,
  channel: NotiMotionChannel,
  keyframes: Keyframe[],
  token: NotiMotionToken,
  onFinish?: () => void
): void {
  cancelNotiAnimation(element, channel)

  if (!supportsWebAnimations(element)) {
    onFinish?.()
    return
  }

  const animation = (element as HTMLElement).animate(keyframes, {
    duration: token.duration,
    easing: token.easing,
    fill: 'none',
  })

  let channels = running.get(element)
  if (channels === undefined) {
    channels = new Map()
    running.set(element, channels)
  }
  channels.set(channel, animation)

  animation.addEventListener('finish', () => {
    channels?.delete(channel)
    onFinish?.()
  })

  // Interrupted on purpose: the replacement owns the outcome, so no callback.
  animation.addEventListener('cancel', () => {
    channels?.delete(channel)
  })
}
