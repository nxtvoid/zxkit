/** `Date.now()` jumps when the system clock is adjusted; a paused timer cannot. */
export function monotonicNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }

  return Date.now()
}
