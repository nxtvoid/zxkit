import type { ComponentType, MouseEvent, ReactNode } from 'react'

/** One notification, one id. Not in {@link NotiOptions}: callers cannot mint one. */
export type NotiId = string

/** What the notification means. */
export type NotiState = 'success' | 'loading' | 'error' | 'warning' | 'info' | 'action'

/**
 * Where the notification is in its life.
 *
 * `null` on the store covers absence, so there is no `queued` or `removed`.
 * Expansion and pause are orthogonal and live on {@link NotiRecord}.
 */
type NotiPhase = 'entering' | 'visible' | 'exiting'

/** Why a notification left the screen. */
export type DismissReason = 'api' | 'close-button' | 'swipe' | 'timeout' | 'replaced'

/** Reasons accumulate: the timer resumes once every one is gone. */
export type PauseReason = 'hover' | 'focus' | 'document-hidden' | 'programmatic'

export type NotiPosition =
  'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

/** Anything renderable as a title, description or button label. */
export type NotiContent = ReactNode

/** `false` never opens on its own; hover and focus still do. Delays in ms. */
export type NotiAutopilot = boolean | { expand?: number; collapse?: number }

/** A component, not an element. Covers `forwardRef`/`memo` — lucide ships those. */
export type NotiIconComponent = ComponentType

/**
 * A glyph, either way round.
 *
 * ```tsx
 * icon: <CircleXIcon className='rotate-45' />
 * icon: CircleXIcon
 * ```
 */
export type NotiIcon = ReactNode | NotiIconComponent

/**
 * Per-state glyphs. A state left out keeps the built-in one, `null` drops the
 * badge, and a call's own `icon` wins over both.
 *
 * On the outlet rather than in {@link NotiOptions} because it is resolved at
 * render, so changing it restyles the notification already on screen.
 */
export type NotiIcons = Partial<Record<NotiState, NotiIcon>>

/** Per-slot class overrides carried by a single call. */
export interface NotiStyles {
  title?: string
  description?: string
  /** The circular icon holder next to the title. */
  badge?: string
  button?: string
}

export interface NotiButton {
  title: NotiContent
  /** The notification stays open. A rejected promise is reported, not swallowed. */
  onClick: (event: MouseEvent<HTMLButtonElement> | undefined) => unknown
  /** Accessible name, required when `title` is not plain text. */
  accessibleLabel?: string
}

export interface NotiDismissContext {
  id: NotiId
  reason: DismissReason
}

/** Everything a call can say. No `id`: identity belongs to the library. */
export interface NotiOptions {
  /** Omitted, the state names itself: `noti.error({})` reads "Error". */
  title?: NotiContent
  description?: NotiContent
  type?: NotiState
  /** Overrides the outlet's position for this notification. */
  position?: NotiPosition
  /** Milliseconds. `null`, `0`, negatives and `Infinity` all mean sticky. */
  duration?: number | null
  /** Replaces the state glyph. `null` removes it entirely. */
  icon?: NotiIcon | null
  styles?: NotiStyles
  /** Island surface colour. */
  fill?: string
  /** Island corner radius in pixels. Negative and non-finite values are ignored. */
  roundness?: number
  autopilot?: NotiAutopilot
  button?: NotiButton

  /** Announce with `role="alert"` / `aria-live="assertive"` instead of polite. */
  important?: boolean
  /** Whether the user may close it (close button, swipe). Defaults to `true`. */
  dismissible?: boolean
  onDismiss?: (context: NotiDismissContext) => void
  onAutoClose?: (context: NotiDismissContext) => void
}

/** Resolved autopilot timing. Delays are clamped to the notification's life. */
export interface NotiAutopilotTiming {
  /** `false` when the call opted out. Hover and focus still open the island. */
  readonly enabled: boolean
  readonly expand: number
  /** `undefined` never collapses on its own. */
  readonly collapse: number | undefined
}

/**
 * The one live notification. Immutable — every call builds a whole new record
 * with a fresh `instanceId`, which is what restarts timers and autopilot.
 */
export interface NotiRecord {
  /** Constant: identity of the singleton, not of this call. */
  readonly id: NotiId
  /** New on every call. Stale effects compare against it. */
  readonly instanceId: number
  readonly state: NotiState
  readonly phase: NotiPhase
  readonly title: NotiContent
  readonly description: NotiContent | undefined
  /** `undefined` follows the outlet. */
  readonly position: NotiPosition | undefined
  /** Normalized: `Infinity` means sticky. */
  readonly duration: number
  readonly icon: NotiIcon | null | undefined
  readonly styles: NotiStyles | undefined
  readonly fill: string
  readonly roundness: number
  readonly autopilot: NotiAutopilotTiming
  readonly button: NotiButton | undefined
  readonly dismissible: boolean
  readonly important: boolean
  readonly expanded: boolean
  readonly paused: boolean
  readonly onDismiss: ((context: NotiDismissContext) => void) | undefined
  readonly onAutoClose: ((context: NotiDismissContext) => void) | undefined
  readonly createdAt: number
  readonly updatedAt: number
  /**
   * Bumped only when visible content changed. Drives the announcement and the
   * collapse-before-swap, so a repeated call neither re-announces nor re-morphs.
   */
  readonly version: number
  /** Set once the record is dismissed, before it is removed. */
  readonly dismissReason: DismissReason | undefined
}

export type NotiTheme = 'light' | 'dark' | 'system'

/** Named parts of the notification, for per-slot class overrides. */
export type NotiSlot =
  | 'outlet'
  | 'item'
  | 'content'
  | 'heading'
  | 'icon'
  | 'title'
  | 'description'
  | 'actions'
  | 'button'
  | 'close'

export type NotiClassNames = Partial<Record<NotiSlot, string>>

/**
 * Internal lifecycle commands. All but `replace` carry the `instanceId` they
 * were issued for, so one that lands late is dropped rather than misapplied.
 */
export type NotiCommand =
  | { readonly type: 'replace'; readonly record: NotiRecord }
  | { readonly type: 'settle'; readonly instanceId: number }
  | { readonly type: 'expand'; readonly instanceId: number; readonly expanded: boolean }
  | { readonly type: 'set-paused'; readonly instanceId: number; readonly paused: boolean }
  | {
      readonly type: 'dismiss'
      readonly instanceId: number | undefined
      readonly reason: DismissReason
    }
  | { readonly type: 'remove'; readonly instanceId: number }
