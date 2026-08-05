/**
 * Instance ids, minted from the realm rather than from this module.
 *
 * A duplicate bundle or an HMR reload gets a fresh module scope, and two
 * counters starting at zero hand the same id to two unrelated calls. The store
 * already travels through a global symbol for that reason, and the identity it
 * guards has to travel the same way: otherwise a settling promise mistakes a
 * newer notification for its own and replaces it.
 */
const counterKey = Symbol.for('@zxkit/noti/instance-counter/v1')

/** Never returns the same number twice within a realm. */
export function nextInstanceId(): number {
  const previous = Reflect.get(globalThis, counterKey)
  // Anything else parked on the key counts as absent: an id must not repeat.
  const next = (typeof previous === 'number' && Number.isFinite(previous) ? previous : 0) + 1

  Reflect.set(globalThis, counterKey, next)
  return next
}
