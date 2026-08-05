import type { NotiCommand, NotiOptions, NotiPosition, NotiRecord, PauseReason } from '../types'
import { DEFAULT_EXIT_DURATION, DEFAULT_POSITION } from './constants'
import { initialNotiStoreState, notiReducer, type NotiStoreState } from './reducer'
import {
  createNotiTimer,
  defaultTimerHost,
  isSticky,
  type NotiTimer,
  type NotiTimerHandle,
  type NotiTimerHost,
} from './timer'

interface NotiStoreOptions {
  /** Fallback delay before a dismissed record is removed when no UI drives it. */
  exitDuration?: number
  timerHost?: NotiTimerHost
  /** Overridable so tests can assert on the warning. */
  warn?: (message: string) => void
}

/** What the mounted outlet contributes to every call made while it is up. */
interface NotiOutletDefaults {
  position: NotiPosition
  options: Partial<NotiOptions> | undefined
}

export interface NotiStore {
  /** Stable-identity state. Safe for `useSyncExternalStore`. */
  getState(): NotiStoreState
  getCurrent(): NotiRecord | null
  /** The render owner's position and default options, or the library's. */
  getDefaults(): NotiOutletDefaults
  subscribe(listener: () => void): () => void
  dispatch(command: NotiCommand): void
  /** Adds a hold on the countdown. Holds survive a replacement. */
  pause(reason?: PauseReason): void
  /** Releases a hold. The timer only runs again once every hold is gone. */
  resume(reason?: PauseReason): void
  /**
   * Claims a seat for a mounted outlet. The `token` identifies the outlet for
   * the lifetime of that mount; the returned function gives the seat back.
   */
  registerOutlet(token: symbol, defaults: NotiOutletDefaults): () => void
  /**
   * How long to wait before removing a dismissed record when nothing else has.
   * The mounted item reports the exit it actually runs, so an overridden
   * `--noti-spring-duration` cannot leave this timer firing mid-animation.
   */
  setExitDuration(milliseconds: number): void
  /**
   * Whether `token` is the outlet allowed to draw the island. There is one
   * notification, so a second outlet must render nothing rather than a copy
   * that competes for the same hover, focus and countdown.
   */
  isRenderOwner(token: symbol): boolean
  destroy(): void
}

interface TimerEntry {
  timer: NotiTimer
  instanceId: number
  duration: number
}

export function createNotiStore(options: NotiStoreOptions = {}): NotiStore {
  const host = options.timerHost ?? defaultTimerHost
  /** Fixed when the host set one: a test's zero must stay zero. */
  const pinnedExitDuration = options.exitDuration
  let exitDuration = pinnedExitDuration ?? DEFAULT_EXIT_DURATION
  const warn = options.warn ?? ((message: string) => console.warn(message))

  const listeners = new Set<() => void>()
  /** On the store, not the timer: a hover survives a replacement and the new timer inherits it. */
  const holds = new Set<PauseReason>()

  let state = initialNotiStoreState
  let timer: TimerEntry | null = null
  let exit: { handle: NotiTimerHandle; instanceId: number; startedAt: number } | null = null
  /** Instances whose dismiss callback already ran. At most one call, ever. */
  const notified = new Set<number>()
  /** Mounted outlets in mount order. The first one owns the render. */
  const registrations = new Map<symbol, NotiOutletDefaults>()
  let destroyed = false

  function libraryDefaults(): NotiOutletDefaults {
    return { position: DEFAULT_POSITION, options: undefined }
  }

  function renderOwner(): symbol | null {
    for (const token of registrations.keys()) return token
    return null
  }

  function report(context: string, error: unknown): void {
    console.error(`[noti] ${context}`, error)
  }

  function notify(): void {
    // One throwing subscriber must not strand the others: React is usually
    // among them, and losing it means the island stops matching the store.
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch (error) {
        report('a store subscriber threw', error)
      }
    }
  }

  function disposeTimer(): void {
    timer?.timer.dispose()
    timer = null
  }

  function clearExit(): void {
    if (exit === null) return

    host.clearTimeout(exit.handle)
    exit = null
  }

  function fireDismiss(record: NotiRecord, reason: NotiRecord['dismissReason']): void {
    if (reason === undefined) return
    if (notified.has(record.instanceId)) return

    notified.add(record.instanceId)
    const context = { id: record.id, reason }

    // The record is already retired by the time this runs. A callback that
    // throws must not take the timers, the exit or the subscribers with it.
    try {
      if (reason === 'timeout') record.onAutoClose?.(context)
      else record.onDismiss?.(context)
    } catch (error) {
      report(reason === 'timeout' ? 'onAutoClose threw' : 'onDismiss threw', error)
    }
  }

  function handleExpire(instanceId: number): void {
    // The reducer drops it if a newer call already landed.
    dispatch({ type: 'dismiss', instanceId, reason: 'timeout' })
  }

  function ensureTimer(record: NotiRecord): void {
    if (isSticky(record.duration)) {
      disposeTimer()
      return
    }

    // Identical durations still restart: only a new instance means a new countdown.
    if (
      timer !== null &&
      timer.instanceId === record.instanceId &&
      timer.duration === record.duration
    ) {
      return
    }

    disposeTimer()

    const created = createNotiTimer({
      duration: record.duration,
      host,
      onExpire: () => {
        handleExpire(record.instanceId)
      },
    })

    for (const reason of holds) created.pause(reason)
    created.start()
    timer = { timer: created, instanceId: record.instanceId, duration: record.duration }
  }

  function scheduleRemoval(instanceId: number, delay: number): void {
    clearExit()
    exit = {
      instanceId,
      startedAt: host.now(),
      handle: host.setTimeout(
        () => {
          exit = null
          dispatch({ type: 'remove', instanceId })
        },
        Math.max(0, delay)
      ),
    }
  }

  /** Reconciles the timer and the exit timeout with whatever the reducer produced. */
  function syncEffects(): void {
    const record = state.current

    if (record === null) {
      disposeTimer()
      clearExit()
      return
    }

    switch (record.phase) {
      case 'entering':
      case 'visible':
        clearExit()
        ensureTimer(record)
        break
      case 'exiting':
        disposeTimer()
        if (exit === null || exit.instanceId !== record.instanceId) {
          scheduleRemoval(record.instanceId, exitDuration)
        }
        break
    }
  }

  function dispatch(command: NotiCommand): void {
    if (destroyed) return

    const previous = state
    state = notiReducer(previous, command)
    if (state === previous) return

    const before = previous.current
    const after = state.current

    // Retires the displaced instance exactly once, before the new one takes over.
    if (before !== null && (after === null || after.instanceId !== before.instanceId)) {
      fireDismiss(before, command.type === 'replace' ? 'replaced' : before.dismissReason)
    }

    if (after !== null && after.phase === 'exiting' && before?.phase !== 'exiting') {
      fireDismiss(after, after.dismissReason)
    }

    // Only the live instance can still need suppressing, so this cannot grow.
    for (const instanceId of notified) {
      if (instanceId !== after?.instanceId) notified.delete(instanceId)
    }

    syncEffects()
    notify()
  }

  function syncPaused(): void {
    const record = state.current
    if (record === null) return

    dispatch({ type: 'set-paused', instanceId: record.instanceId, paused: holds.size > 0 })
  }

  return {
    getState: () => state,
    getCurrent: () => state.current,
    getDefaults: () => {
      const owner = renderOwner()
      // The owner's defaults, not the last registrant's: the outlet nobody can
      // see must not decide where the island sits.
      return owner === null ? libraryDefaults() : (registrations.get(owner) ?? libraryDefaults())
    },
    subscribe(listener) {
      listeners.add(listener)

      // Idempotent: a second call must not drop a later re-subscription.
      let active = true
      return () => {
        if (!active) return
        active = false
        listeners.delete(listener)
      }
    },
    dispatch,
    pause(reason = 'programmatic') {
      if (destroyed || holds.has(reason)) return

      holds.add(reason)
      timer?.timer.pause(reason)
      syncPaused()
    },
    resume(reason = 'programmatic') {
      if (destroyed || !holds.delete(reason)) return

      timer?.timer.resume(reason)
      syncPaused()
    },
    registerOutlet(token, next) {
      if (registrations.size > 0 && !registrations.has(token)) {
        warn(
          '[noti] More than one <NotiOutlet> is mounted. ' +
            'There is a single notification, so only the first outlet renders it.'
        )
      }

      registrations.set(token, next)
      // A mount can change who owns the render, which is an answer another
      // outlet is already subscribed to.
      notify()

      let released = false
      return () => {
        if (released) return
        released = true

        registrations.delete(token)
        notify()
      }
    },
    setExitDuration(milliseconds) {
      if (pinnedExitDuration !== undefined) return
      if (!Number.isFinite(milliseconds) || milliseconds < 0) return
      if (milliseconds === exitDuration) return

      exitDuration = milliseconds

      // A record already leaving was booked against the old number. The
      // outlet reports the real duration only after mounting, so without
      // this the node is pulled out from under an animation still running.
      if (exit === null) return
      scheduleRemoval(exit.instanceId, exit.startedAt + milliseconds - host.now())
    },
    isRenderOwner(token) {
      const owner = renderOwner()
      // Nobody is disqualified before the first registration lands: an outlet
      // renders on its first pass instead of blinking in a commit later.
      return owner === null || owner === token
    },
    destroy() {
      destroyed = true

      disposeTimer()
      clearExit()
      holds.clear()
      notified.clear()
      listeners.clear()
      registrations.clear()
      state = initialNotiStoreState
    },
  }
}
