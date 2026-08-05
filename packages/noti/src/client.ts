import type {
  NotiAutopilotTiming,
  NotiId,
  NotiOptions,
  NotiPosition,
  NotiRecord,
  NotiState,
  NotiStyles,
} from './types'
import { monotonicNow } from './core/clock'
import {
  DEFAULT_COLLAPSE_DELAY,
  DEFAULT_DURATION,
  DEFAULT_EXPAND_DELAY,
  DEFAULT_FILL,
  DEFAULT_ROUNDNESS,
  NOTI_ID,
  STATE_DURATIONS,
} from './core/constants'
import { atPosition, resolveNotiMessage, toPromise, type NotiPromiseOptions } from './core/promise'
import { defaultNotiStore } from './core/default-store'
import { nextInstanceId } from './core/instance-id'
import type { NotiStore } from './core/store'

/**
 * A usable number, or the fallback.
 *
 * TypeScript says these are numbers; JavaScript can still hand over `NaN`,
 * `Infinity` or something negative. A negative radius produces an invalid SVG
 * and a `NaN` delay reaches `setTimeout` as "run immediately".
 */
function finiteAtLeast(value: number | undefined, minimum: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.max(minimum, value)
}

/**
 * The visible fallback when a call carries no title.
 *
 * An empty island is worse than a generic one: the badge renders blank and the
 * live region announces nothing at all.
 */
function titleFor(state: NotiState): string {
  return state.charAt(0).toUpperCase() + state.slice(1)
}

/** `null`, zero, negatives and non-finite values all mean "never auto-close". */
function normalizeDuration(state: NotiState, explicit: number | null | undefined): number {
  if (explicit === null) return Number.POSITIVE_INFINITY
  if (explicit === undefined) return STATE_DURATIONS[state] ?? DEFAULT_DURATION
  if (!Number.isFinite(explicit) || explicit <= 0) return Number.POSITIVE_INFINITY

  return explicit
}

/** Delays are clamped to the notification's life: opening after it left is worse. */
function resolveAutopilot(
  autopilot: NotiOptions['autopilot'],
  duration: number
): NotiAutopilotTiming {
  if (autopilot === false) {
    return { enabled: false, expand: DEFAULT_EXPAND_DELAY, collapse: undefined }
  }

  const timing = typeof autopilot === 'object' ? autopilot : undefined
  const limit = Number.isFinite(duration) ? duration : Number.POSITIVE_INFINITY
  const expand = Math.min(finiteAtLeast(timing?.expand, 0, DEFAULT_EXPAND_DELAY), limit)
  const collapse = finiteAtLeast(timing?.collapse, 0, DEFAULT_COLLAPSE_DELAY)

  return { enabled: true, expand, collapse: Math.min(collapse, limit) }
}

/** A floor, not a replacement: a call overrides one slot at a time. */
function mergeStyles(
  base: NotiStyles | undefined,
  override: NotiStyles | undefined
): NotiStyles | undefined {
  if (base === undefined) return override
  if (override === undefined) return base

  return { ...base, ...override }
}

function assertOptions(method: string, options: unknown): asserts options is NotiOptions {
  if (typeof options === 'object' && options !== null && !Array.isArray(options)) return

  throw new TypeError(
    `[noti] noti.${method}() takes an options object, for example ` +
      `noti.${method}({ title: 'Saved' }). Received ${typeof options}.`
  )
}

/** Drives the announcement and the refresh, so a repeated call does neither. */
function sameContent(
  previous: NotiRecord | null,
  next: Omit<NotiRecord, 'version'>
): previous is NotiRecord {
  return (
    previous !== null &&
    previous.state === next.state &&
    previous.title === next.title &&
    previous.description === next.description &&
    previous.button === next.button &&
    previous.icon === next.icon &&
    previous.styles === next.styles &&
    previous.fill === next.fill &&
    previous.roundness === next.roundness &&
    // Urgency is content as far as the live region is concerned: the same words
    // announced politely and then assertively are two different announcements.
    previous.important === next.important
  )
}

export interface NotiApi {
  /** Shows a notification. Without `type` it reads as a success. */
  show: (options: NotiOptions) => NotiId
  success: (options: NotiOptions) => NotiId
  error: (options: NotiOptions) => NotiId
  warning: (options: NotiOptions) => NotiId
  info: (options: NotiOptions) => NotiId
  /** A success carrying a button. `button` is what makes it worth its own state. */
  action: (options: NotiOptions) => NotiId
  /** Loading, then the outcome. Returns the original promise, untouched. */
  promise: <T>(
    promise: Promise<T> | (() => Promise<T>),
    options: NotiPromiseOptions<T>
  ) => Promise<T>
  /** Closes the notification. An id that is not the live one closes nothing. */
  dismiss: (id?: NotiId) => void
  /** Closes it, or only if it currently sits at `position`. */
  clear: (position?: NotiPosition) => void
}

export function createNotiApi(store: NotiStore): NotiApi {
  function build(state: NotiState, options: NotiOptions): NotiRecord {
    const previous = store.getCurrent()
    const defaults = store.getDefaults().options
    const merged: NotiOptions = defaults === undefined ? options : { ...defaults, ...options }
    const duration = normalizeDuration(state, merged.duration)
    const timestamp = monotonicNow()

    const draft: Omit<NotiRecord, 'version'> = {
      id: NOTI_ID,
      instanceId: nextInstanceId(),
      state,
      // A live replacement keeps its phase, so the island morphs in place
      // instead of replaying its entrance. One that is leaving comes back.
      phase: previous === null || previous.phase === 'exiting' ? 'entering' : previous.phase,
      title: merged.title ?? titleFor(state),
      description: merged.description,
      // An omitted position keeps the live one: a refresh must not teleport.
      position: merged.position ?? previous?.position,
      duration,
      icon: merged.icon,
      styles: mergeStyles(defaults?.styles, options.styles),
      fill: merged.fill ?? DEFAULT_FILL,
      roundness: finiteAtLeast(merged.roundness, 0, DEFAULT_ROUNDNESS),
      autopilot: resolveAutopilot(merged.autopilot, duration),
      button: merged.button,
      dismissible: merged.dismissible ?? true,
      important: merged.important ?? false,
      expanded: false,
      // A pointer resting on the island still holds the countdown after a
      // replacement, so the store — not the record — owns that truth.
      paused: previous?.paused ?? false,
      onDismiss: merged.onDismiss,
      onAutoClose: merged.onAutoClose,
      createdAt: timestamp,
      updatedAt: timestamp,
      dismissReason: undefined,
    }

    const shown = previous?.version ?? 0
    return { ...draft, version: sameContent(previous, draft) ? shown : shown + 1 }
  }

  function emit(method: string, state: NotiState, options: NotiOptions): NotiRecord {
    assertOptions(method, options)

    const record = build(state, options)
    store.dispatch({ type: 'replace', record })
    return record
  }

  function creator(method: string, state: NotiState): (options: NotiOptions) => NotiId {
    return (options) => emit(method, state, options).id
  }

  function promise<T>(
    input: Promise<T> | (() => Promise<T>),
    options: NotiPromiseOptions<T>
  ): Promise<T> {
    const source = toPromise(input)
    const loading = emit('promise', 'loading', {
      ...atPosition(options.loading, options.position),
      duration: null,
    })

    /**
     * Latest invocation wins: a settlement only lands if it still owns the
     * island. A dismissed record keeps its `instanceId` until the exit
     * animation removes it, so the phase is part of ownership — without it a
     * promise resolving inside that window brings back what the user just
     * closed.
     */
    function owns(): boolean {
      const current = store.getCurrent()
      return (
        current !== null && current.instanceId === loading.instanceId && current.phase !== 'exiting'
      )
    }

    function settle(state: NotiState, message: NotiPromiseOptions<T>['loading'] | undefined): void {
      if (!owns()) return

      // Nothing to show: close the loading notification instead of leaving it.
      if (message === undefined) {
        store.dispatch({ type: 'dismiss', instanceId: loading.instanceId, reason: 'api' })
        return
      }

      // Explicit rather than inherited: between the loading and this, another
      // call may have moved the island somewhere the flow never asked for.
      emit('promise', state, atPosition(message, options.position))
    }

    void source
      .then(
        async (value) => {
          if (options.action !== undefined) {
            settle('action', await resolveNotiMessage(options.action, value))
            return
          }

          settle('success', await resolveNotiMessage(options.success, value))
        },
        async (error: unknown) => {
          settle('error', await resolveNotiMessage(options.error, error))
        }
      )
      .catch((error: unknown) => {
        // The user's own message callback threw. Better surfaced than silent.
        if (owns()) {
          store.dispatch({ type: 'dismiss', instanceId: loading.instanceId, reason: 'api' })
        }
        console.error('[noti] promise message callback failed', error)
      })
      .finally(() => {
        // Typed `() => unknown`, so it may hand back a promise. Catching only
        // the synchronous throw would leave an async one unhandled.
        try {
          const result = options.finally?.()
          if (result === undefined || result === null) return

          void Promise.resolve(result).catch((error: unknown) => {
            console.error('[noti] promise finally callback failed', error)
          })
        } catch (error) {
          console.error('[noti] promise finally callback failed', error)
        }
      })

    return source
  }

  return {
    show: (options) => {
      assertOptions('show', options)
      // No seventh "default" state: an untyped call is a success.
      return emit('show', options.type ?? 'success', options).id
    },
    success: creator('success', 'success'),
    error: creator('error', 'error'),
    warning: creator('warning', 'warning'),
    info: creator('info', 'info'),
    action: creator('action', 'action'),
    promise,
    dismiss: (id) => {
      const current = store.getCurrent()
      if (current === null) return

      // There is one id, but a caller that names another one means a different
      // notification — and closing the live one instead would be a surprise.
      if (id !== undefined && id !== current.id) return

      store.dispatch({ type: 'dismiss', instanceId: current.instanceId, reason: 'api' })
    },
    clear: (position) => {
      const current = store.getCurrent()
      if (current === null) return

      // A position filter only clears the notification actually sitting there.
      if (position !== undefined && (current.position ?? store.getDefaults().position) !== position)
        return

      store.dispatch({ type: 'dismiss', instanceId: current.instanceId, reason: 'api' })
    },
  }
}

export const noti: NotiApi = createNotiApi(defaultNotiStore)
