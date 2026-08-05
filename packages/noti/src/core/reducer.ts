import type { NotiCommand, NotiRecord } from '../types'

/** One notification or none. A second call replaces the first. */
export interface NotiStoreState {
  readonly current: NotiRecord | null
}

export const initialNotiStoreState: NotiStoreState = { current: null }

/**
 * Whether a command still applies. A timer that fires after a newer call
 * landed, or an exit that finishes against a replaced record, is dropped here.
 */
function targets(
  current: NotiRecord | null,
  instanceId: number | undefined
): current is NotiRecord {
  if (current === null) return false
  return instanceId === undefined || current.instanceId === instanceId
}

function reduceCommand(state: NotiStoreState, command: NotiCommand): NotiStoreState {
  switch (command.type) {
    // Unconditional, even over one still leaving: the newest call always wins.
    case 'replace':
      return state.current === command.record ? state : { current: command.record }

    case 'settle': {
      const current = state.current
      if (!targets(current, command.instanceId) || current.phase !== 'entering') return state

      return { current: { ...current, phase: 'visible' } }
    }

    case 'expand': {
      const current = state.current
      if (!targets(current, command.instanceId)) return state
      // A timer scheduled before the dismiss can still fire after it. Opening
      // the card now would change the island's geometry while it is leaving.
      if (current.phase === 'exiting') return state
      if (current.expanded === command.expanded) return state

      return { current: { ...current, expanded: command.expanded } }
    }

    case 'set-paused': {
      const current = state.current
      if (!targets(current, command.instanceId)) return state
      // Nothing is counting down any more: the exit is not pausable.
      if (current.phase === 'exiting') return state
      if (current.paused === command.paused) return state

      return { current: { ...current, paused: command.paused } }
    }

    case 'dismiss': {
      const current = state.current
      if (!targets(current, command.instanceId)) return state
      // Idempotent: a swipe and a close button racing must not restart the exit.
      if (current.phase === 'exiting') return state

      return { current: { ...current, phase: 'exiting', dismissReason: command.reason } }
    }

    case 'remove': {
      const current = state.current
      if (!targets(current, command.instanceId)) return state

      return { current: null }
    }
  }
}

/** Returns the *same* state object on a no-op, so React never re-renders for nothing. */
export function notiReducer(state: NotiStoreState, command: NotiCommand): NotiStoreState {
  return reduceCommand(state, command)
}
