import type { NotiRecord } from './types'
import type { NotiTimerHandle, NotiTimerHost } from './core/timer'
import {
  DEFAULT_COLLAPSE_DELAY,
  DEFAULT_DURATION,
  DEFAULT_EXPAND_DELAY,
  DEFAULT_FILL,
  DEFAULT_ROUNDNESS,
  NOTI_ID,
} from './core/constants'

export interface FakeTimerHost {
  host: NotiTimerHost
  /** Runs every callback scheduled within the next `ms`, in order. */
  advance(ms: number): void
  now(): number
  pending(): number
}

/**
 * Deterministic clock and scheduler. Preferred over global fake timers: the
 * store's clock and its `setTimeout` have to move together.
 */
export function createFakeTimerHost(): FakeTimerHost {
  interface Scheduled {
    at: number
    callback: () => void
  }

  const scheduled = new Map<number, Scheduled>()
  let time = 0
  let nextHandle = 1

  const host: NotiTimerHost = {
    now: () => time,
    setTimeout: (callback, ms) => {
      const handle = nextHandle
      nextHandle += 1
      scheduled.set(handle, { at: time + ms, callback })
      return handle as unknown as NotiTimerHandle
    },
    clearTimeout: (handle) => {
      scheduled.delete(handle as unknown as number)
    },
  }

  function nextDue(target: number): number | undefined {
    let due: number | undefined
    let dueAt = Number.POSITIVE_INFINITY

    for (const [handle, entry] of scheduled) {
      if (entry.at <= target && entry.at < dueAt) {
        dueAt = entry.at
        due = handle
      }
    }

    return due
  }

  return {
    host,
    now: () => time,
    pending: () => scheduled.size,
    advance(ms) {
      const target = time + ms

      for (;;) {
        const handle = nextDue(target)
        if (handle === undefined) break

        const entry = scheduled.get(handle)
        if (entry === undefined) break

        scheduled.delete(handle)
        time = entry.at
        entry.callback()
      }

      time = target
    },
  }
}

let instanceCounter = 0

/** A record as the client builds one, with a fresh `instanceId` each time. */
export function makeRecord(overrides: Partial<NotiRecord> = {}): NotiRecord {
  instanceCounter += 1

  return {
    id: NOTI_ID,
    instanceId: instanceCounter,
    state: 'success',
    phase: 'entering',
    title: 'Title',
    description: undefined,
    position: undefined,
    duration: DEFAULT_DURATION,
    icon: undefined,
    styles: undefined,
    fill: DEFAULT_FILL,
    roundness: DEFAULT_ROUNDNESS,
    autopilot: {
      enabled: true,
      expand: DEFAULT_EXPAND_DELAY,
      collapse: DEFAULT_COLLAPSE_DELAY,
    },
    button: undefined,
    dismissible: true,
    important: false,
    expanded: false,
    paused: false,
    onDismiss: undefined,
    onAutoClose: undefined,
    createdAt: 0,
    updatedAt: 0,
    version: 1,
    dismissReason: undefined,
    ...overrides,
  }
}

/** Lets pending microtasks (promise callbacks) run. */
export function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

/**
 * jsdom has none. Queries default to not matching, so a test has to ask for
 * `prefers-reduced-motion` — the opposite of the production fallback.
 */
export function stubMatchMedia(matches: Record<string, boolean> = {}): () => void {
  const original = window.matchMedia

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: matches[query] ?? false,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })

  return () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: original,
    })
  }
}

/**
 * jsdom has neither `PointerEvent` nor pointer capture. Without the
 * constructor, Testing Library drops `clientX`/`clientY` and every gesture
 * looks like a zero-distance drag.
 */
export function stubPointerEvents(): void {
  const captured = new Set<number>()

  Object.assign(HTMLElement.prototype, {
    setPointerCapture(pointerId: number) {
      captured.add(pointerId)
    },
    releasePointerCapture(pointerId: number) {
      captured.delete(pointerId)
    },
    hasPointerCapture(pointerId: number) {
      return captured.has(pointerId)
    },
  })

  if (typeof window.PointerEvent === 'function') return

  class StubPointerEvent extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }

  Object.defineProperty(window, 'PointerEvent', {
    configurable: true,
    writable: true,
    value: StubPointerEvent,
  })
}
