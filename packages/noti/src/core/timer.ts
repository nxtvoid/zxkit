import type { PauseReason } from '../types'
import { monotonicNow } from './clock'
import { MAX_TIMEOUT } from './constants'

export type NotiTimerHandle = ReturnType<typeof setTimeout>

/** Injection seam so timers can be driven deterministically in tests. */
export interface NotiTimerHost {
  now(): number
  setTimeout(callback: () => void, ms: number): NotiTimerHandle
  clearTimeout(handle: NotiTimerHandle): void
}

export const defaultTimerHost: NotiTimerHost = {
  now: monotonicNow,
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => {
    clearTimeout(handle)
  },
}

interface CreateNotiTimerOptions {
  duration: number
  onExpire: () => void
  host?: NotiTimerHost
}

export interface NotiTimer {
  readonly duration: number
  readonly paused: boolean
  readonly finished: boolean
  pauseReasons(): readonly PauseReason[]
  remaining(): number
  start(): void
  /** Adds a hold. Returns `true` only on the unpaused -> paused transition. */
  pause(reason: PauseReason): boolean
  /** Releases a hold. Returns `true` only once the last hold is gone. */
  resume(reason: PauseReason): boolean
  /** Restarts with a new duration, clearing any expiry. Holds are kept. */
  reset(duration: number): void
  dispose(): void
}

/** A duration that must never auto-close. */
export function isSticky(duration: number): boolean {
  return !Number.isFinite(duration) || duration <= 0
}

export function createNotiTimer(options: CreateNotiTimerOptions): NotiTimer {
  const host = options.host ?? defaultTimerHost
  const reasons = new Set<PauseReason>()

  let duration = options.duration
  let remaining = duration
  let armedAt: number | null = null
  let handle: NotiTimerHandle | null = null
  let finished = false
  let disposed = false

  function clear(): void {
    if (handle !== null) {
      host.clearTimeout(handle)
      handle = null
    }
  }

  function arm(): void {
    if (disposed || finished || handle !== null) return
    if (reasons.size > 0 || isSticky(duration)) return

    const startedAt = host.now()
    armedAt = startedAt

    handle = host.setTimeout(
      () => {
        handle = null
        armedAt = null
        remaining = Math.max(0, remaining - (host.now() - startedAt))

        // A duration past MAX_TIMEOUT is armed in slices; keep going until spent.
        if (remaining > 0) {
          arm()
          return
        }

        finished = true
        options.onExpire()
      },
      Math.min(remaining, MAX_TIMEOUT)
    )
  }

  function freeze(): void {
    if (armedAt !== null) {
      remaining = Math.max(0, remaining - (host.now() - armedAt))
      armedAt = null
    }

    clear()
  }

  return {
    get duration() {
      return duration
    },
    get paused() {
      return reasons.size > 0
    },
    get finished() {
      return finished
    },
    pauseReasons: () => [...reasons],
    remaining: () =>
      armedAt === null ? remaining : Math.max(0, remaining - (host.now() - armedAt)),
    start() {
      arm()
    },
    pause(reason) {
      if (disposed || finished) return false

      const wasPaused = reasons.size > 0
      reasons.add(reason)
      if (wasPaused) return false

      freeze()
      return true
    },
    resume(reason) {
      if (disposed) return false
      if (!reasons.delete(reason)) return false
      if (reasons.size > 0) return false

      arm()
      return true
    },
    reset(next) {
      clear()
      armedAt = null
      finished = false
      duration = next
      remaining = next
      arm()
    },
    dispose() {
      disposed = true
      armedAt = null
      reasons.clear()
      clear()
    },
  }
}
