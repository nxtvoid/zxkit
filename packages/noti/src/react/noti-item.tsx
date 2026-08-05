'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import type {
  DismissReason,
  NotiButton,
  NotiClassNames,
  NotiContent,
  NotiIcon,
  NotiIcons,
  NotiPosition,
  NotiRecord,
  NotiState,
  NotiStyles,
  PauseReason,
} from '../types'
import {
  BLUR_RATIO,
  CLOSE_SLOT,
  ENTER_SCALE,
  ENTER_TRAVEL,
  FALLBACK_MARGIN,
  MIN_EXPAND_RATIO,
} from '../core/constants'
import type { NotiStore } from '../core/store'
import { animateNoti, cancelAllNotiAnimations, cancelNotiAnimation } from '../motion/animate'
import { NOTI_MOTION, motionToken } from '../motion/springs'
import {
  canStartSwipe,
  DEFAULT_SWIPE_CONFIG,
  resolveSwipeAxis,
  resolveSwipeOffset,
  shouldDismissOnRelease,
  swipeVelocity,
  MIN_VELOCITY_WINDOW,
  type NotiSwipeAxis,
  type NotiSwipeConfig,
} from '../motion/swipe'
import { NotiHeadingTransition } from './noti-heading-transition'
import { NotiIslandCanvas } from './noti-island-canvas'
import {
  readNotiSpringDuration,
  useNotiContentHeight,
  useNotiTokens,
  useNotiPillWidth,
} from './use-noti-measure'

interface NotiItemProps {
  record: NotiRecord
  store: NotiStore
  /** Already resolved: the record's own position, or the outlet's. */
  position: NotiPosition
  reducedMotion: boolean
  /** The outlet's per-state glyphs. A call's own `icon` still wins. */
  icons: NotiIcons | undefined
  swipe: NotiSwipeConfig | null
  closeButton: boolean
  closeButtonLabel: string
  closeButtonIcon: ReactNode
  classNames: NotiClassNames | undefined
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  axis: NotiSwipeAxis | null
  /** Tail of the gesture, so release speed reflects the flick and not the pause before it. */
  recentOffset: number
  recentAt: number
}

/**
 * What the island is showing. A copy of the record, not the record: when a
 * replacement arrives while it is open, the old view stays until the collapse
 * finishes, so the swap never happens mid-morph.
 */
interface NotiView {
  version: number
  instanceId: number
  state: NotiState
  title: NotiContent
  description: NotiContent | undefined
  icon: NotiIcon | null | undefined
  button: NotiButton | undefined
  styles: NotiStyles | undefined
  fill: string
  roundness: number
  /** Part of the view, so the live region never turns assertive ahead of its text. */
  important: boolean
}

function toView(record: NotiRecord): NotiView {
  return {
    version: record.version,
    instanceId: record.instanceId,
    state: record.state,
    title: record.title,
    description: record.description,
    icon: record.icon,
    button: record.button,
    styles: record.styles,
    fill: record.fill,
    roundness: record.roundness,
    important: record.important,
  }
}

function alignOf(position: NotiPosition): 'left' | 'center' | 'right' {
  if (position.endsWith('right')) return 'right'
  if (position.endsWith('center')) return 'center'
  return 'left'
}

/** Which way the island grows. */
function edgeOf(position: NotiPosition): 'top' | 'bottom' {
  return position.startsWith('bottom') ? 'top' : 'bottom'
}

/**
 * Whether this pointer can be hovered *and* un-hovered.
 *
 * A tap fires `pointerenter` too, but touch has no reliable `pointerleave`:
 * taking the countdown's hold there can leave a notification on screen for
 * good. Focus stays a separate route in, so the keyboard loses nothing.
 */
function isHoverPointer(event: PointerEvent<Element>): boolean {
  if (event.pointerType === 'touch') return false
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true

  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

/** `null`, `false` and `undefined` are all "nothing to show". */
function isRenderable(content: NotiContent): boolean {
  return content !== undefined && content !== null && content !== false && content !== ''
}

/** JavaScript can hand over anything; a button needs a handler to be one. */
function isNotiButton(button: NotiButton | undefined): button is NotiButton {
  return typeof button === 'object' && button !== null && typeof button.onClick === 'function'
}

function joinClassNames(...values: (string | undefined)[]): string | undefined {
  const joined = values.filter((value) => value !== undefined && value !== '').join(' ')
  return joined === '' ? undefined : joined
}

/**
 * The one notification. Measured values go out as custom properties for the
 * stylesheet to spring, so nothing animates per frame in JavaScript.
 *
 * The root is an `li`, never a button: making the whole surface a control with
 * its action nested inside is what no screen reader can untangle.
 */
export function NotiItem({
  record,
  store,
  position,
  reducedMotion,
  icons,
  swipe,
  closeButton,
  closeButtonLabel,
  closeButtonIcon,
  classNames,
}: NotiItemProps) {
  const { instanceId } = record
  const element = useRef<HTMLLIElement | null>(null)
  const header = useRef<HTMLDivElement | null>(null)
  const heading = useRef<HTMLDivElement | null>(null)
  const body = useRef<HTMLDivElement | null>(null)
  const actions = useRef<HTMLDivElement | null>(null)
  const drag = useRef<DragState | null>(null)
  /**
   * Set when the notification leaves by gesture, so the exit follows the throw.
   * `from` is the offset the finger released at: the exit starts there instead
   * of snapping back to rest for a frame first.
   */
  const thrown = useRef<{ axis: NotiSwipeAxis; sign: number; from: number } | null>(null)
  /** Where focus came from, so dismissing does not drop the user on `<body>`. */
  const focusReturn = useRef<HTMLElement | null>(null)
  const interacting = useRef(false)
  /** Pause reasons this item took out, so an unmount can hand them back. */
  const held = useRef<Set<PauseReason>>(new Set())
  /**
   * A touch that has not moved yet. Its own state rather than the drag's: the
   * gesture is off when `swipe` is `false` or the notification is not
   * dismissible, and a tap has to keep working in both.
   */
  const tap = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  /** Set while the island was opened by a tap, so the right thing closes it. */
  const tapped = useRef(false)

  const [axis, setAxis] = useState<NotiSwipeAxis | null>(null)
  const [view, setView] = useState<NotiView>(() => toView(record))
  const [pending, setPending] = useState<NotiView | null>(null)
  const [ready, setReady] = useState(false)
  /** The expansion the user is looking at, read before this record landed. */
  const shownExpanded = useRef(record.expanded)

  const dragging = axis !== null
  const expanded = record.expanded
  const align = alignOf(position)
  const edge = edgeOf(position)

  // `ReactNode` allows `null` and `false`, which is what `cond && <p/>` yields.
  // Treating those as content builds a body nobody can see and lets the island
  // open onto nothing.
  const hasDescription = isRenderable(view.description)
  const hasButton = isNotiButton(view.button)
  const showClose = closeButton && record.dismissible
  const hasDetails = hasDescription || hasButton
  // Opening now would reveal the content that is on its way out.
  const swapPending = pending !== null
  // Loading never opens: nothing to reveal, and no known end. A close button
  // counts, so focusing it opens the island the user is about to close.
  // The close control is chrome, not content: growing an empty card just to
  // show it is what left a blank island hanging off the pill.
  const expandable = hasDetails && view.state !== 'loading'
  const canExpand = expandable && !swapPending

  /* ------------------------------ Measurements ---------------------------- */

  // Everything below is expressed against the box the stylesheet resolved, so
  // an overridden `--noti-width` moves the silhouette with the element.
  const { width: islandWidth, compactHeight, springDuration } = useNotiTokens(element)

  // Both fallbacks cover an animation whose length the token decides, so they
  // are derived from it rather than from the built-in duration.
  const refreshFallback = springDuration + FALLBACK_MARGIN
  const exitFallback = motionToken('exit', reducedMotion, springDuration).duration + FALLBACK_MARGIN

  const measureKey = `${view.version}:${String(expanded)}:${compactHeight}:${String(showClose)}`
  const measuredPill = useNotiPillWidth(
    header,
    heading,
    compactHeight,
    showClose ? CLOSE_SLOT : 0,
    measureKey
  )
  // A zero reading would put a right-aligned pill off the end of the island.
  const pillWidth = Math.min(islandWidth, Math.max(compactHeight, measuredPill))
  // The heading wants more room than the island has. Only ever read, never fed
  // back into the measurement, so it cannot oscillate.
  const truncated = measuredPill > islandWidth
  const bodyHeight = useNotiContentHeight(body, hasDescription, measureKey)
  const actionsHeight = useNotiContentHeight(actions, hasButton, measureKey)

  const blur = view.roundness * BLUR_RATIO
  const minExpanded = compactHeight * MIN_EXPAND_RATIO
  const rawExpanded = hasDetails
    ? Math.max(minExpanded, compactHeight + bodyHeight + actionsHeight)
    : minExpanded

  // Frozen while closed, so the collapse animates back from the size it had.
  const lastExpanded = useRef(rawExpanded)
  if (expanded) lastExpanded.current = rawExpanded
  const expandedHeight = expanded ? rawExpanded : lastExpanded.current

  const pillX =
    align === 'right'
      ? islandWidth - pillWidth
      : align === 'center'
        ? (islandWidth - pillWidth) / 2
        : 0

  /* -------------------------------- Lifecycle ----------------------------- */

  const dismiss = useCallback(
    (reason: DismissReason = 'api') => {
      store.dispatch({ type: 'dismiss', instanceId, reason })
    },
    [store, instanceId]
  )

  // The store's own removal timer is a headless fallback. It has to outlast the
  // exit this item runs, which the token — not the constant — decides.
  useEffect(() => {
    store.setExitDuration(exitFallback)
  }, [store, exitFallback])

  // One still frame first, so the island does not morph out of nothing.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setReady(true)
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [])

  /**
   * The version already decided about. Not `view.version`: a pause or an
   * expansion also changes the record, and re-deciding on those would let an
   * unrelated hover cancel a collapse that is still running.
   */
  const decided = useRef(record.version)
  /** Readable from an effect without becoming one of its dependencies. */
  const pendingView = useRef<NotiView | null>(null)

  function commitView(next: NotiView): void {
    pendingView.current = null
    setPending(null)
    setView(next)
  }

  function queueView(next: NotiView): void {
    pendingView.current = next
    setPending(next)
  }

  // Refresh. An open island collapses before it changes what it says, so the
  // silhouette stays continuous instead of cutting from one card to another.
  useEffect(() => {
    if (record.version === decided.current) return
    decided.current = record.version

    const next = toView(record)

    // Already collapsing: this one takes the pending slot. Updates never queue.
    if (pendingView.current !== null) {
      queueView(next)
      return
    }

    if (!shownExpanded.current || reducedMotion) {
      commitView(next)
      return
    }

    queueView(next)
  }, [record, reducedMotion])

  // After the refresh effect on purpose, so it still sees the previous expansion.
  useEffect(() => {
    shownExpanded.current = record.expanded
  })

  useEffect(() => {
    if (pending === null) return

    const node = element.current
    const commit = () => {
      commitView(pending)
    }

    // The timeout covers environments that never fire `transitionend`.
    const timeout = setTimeout(commit, refreshFallback)
    const onTransitionEnd = (event: TransitionEvent) => {
      // `transitionend` bubbles, and the SVG rects animate a `height` of their
      // own. Without this the silhouette would commit the swap mid-morph.
      if (event.target !== node) return
      if (event.propertyName !== 'height' && event.propertyName !== 'block-size') return

      clearTimeout(timeout)
      commit()
    }

    node?.addEventListener('transitionend', onTransitionEnd)
    return () => {
      clearTimeout(timeout)
      node?.removeEventListener('transitionend', onTransitionEnd)
    }
  }, [pending, refreshFallback])

  // Autopilot. UI state, independent from the auto-close timer: that one is
  // paused while the user interacts, this one is not.
  useEffect(() => {
    // Still showing the previous content.
    if (record.instanceId !== view.instanceId) return
    // On the way out: the phase is a dependency so the dismiss tears these
    // timers down instead of letting them reopen a card mid-exit.
    if (record.phase === 'exiting') return
    // `expandable`, not `hasDetails`: the same gate hover and focus run through.
    // A `loading` island has a description the card is never sized to show, so
    // opening it here painted content over a silhouette still drawn compact.
    //
    // Hover and focus may still open an island whose only content is the close
    // button. Autopilot may not: nobody asked, and there is nothing to read.
    if (!expandable || !record.autopilot.enabled) return

    const open = setTimeout(() => {
      store.dispatch({ type: 'expand', instanceId: view.instanceId, expanded: true })
    }, record.autopilot.expand)

    const collapse = record.autopilot.collapse
    const close =
      collapse === undefined
        ? undefined
        : setTimeout(() => {
            if (interacting.current) return
            store.dispatch({ type: 'expand', instanceId: view.instanceId, expanded: false })
          }, collapse)

    return () => {
      clearTimeout(open)
      if (close !== undefined) clearTimeout(close)
    }
  }, [record.instanceId, record.phase, record.autopilot, view.instanceId, expandable, store])

  // What ends a tap, since no pointer is going to leave. A press anywhere else
  // closes the island and hands the countdown back — otherwise a finger that
  // opened one and moved on would hold it on screen for good.
  useEffect(() => {
    if (!expanded) {
      // Collapsed by another route, a replacement included. The hold is the
      // tap's alone: a hover one belongs to a pointer that is still there.
      if (tapped.current) {
        tapped.current = false
        if (held.current.delete('hover')) store.resume('hover')
      }
      return
    }

    if (!tapped.current) return

    const close = (event: globalThis.PointerEvent) => {
      const node = element.current
      if (node !== null && event.target instanceof Node && node.contains(event.target)) return

      tapped.current = false
      interacting.current = false
      store.dispatch({ type: 'expand', instanceId, expanded: false })
      if (held.current.delete('hover')) store.resume('hover')
    }

    // Capture: a handler on the way down cannot be stopped by the page's own.
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [expanded, instanceId, store])

  // Entry: scales up out of the edge it is anchored to.
  useEffect(() => {
    if (record.phase !== 'entering') return

    // A replacement mid-throw did not arrive by gesture, so it must not leave as one.
    thrown.current = null

    const node = element.current
    const settle = () => {
      store.dispatch({ type: 'settle', instanceId })
    }

    if (node === null) {
      settle()
      return
    }

    const travel = position.startsWith('top') ? -ENTER_TRAVEL : ENTER_TRAVEL
    animateNoti(
      node,
      'transform',
      reducedMotion
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: `translateY(${travel}px) scale(${ENTER_SCALE})` },
            { opacity: 1, transform: 'translateY(0px) scale(1)' },
          ],
      motionToken('enter', reducedMotion, readNotiSpringDuration(node)),
      settle
    )
    // Once per instance: otherwise every refresh would replay the entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.phase, instanceId, store])

  // Exit. Removal follows the animation finishing, not a timer.
  useEffect(() => {
    if (record.phase !== 'exiting') return

    const node = element.current
    const remove = () => {
      store.dispatch({ type: 'remove', instanceId })
    }

    if (node === null) {
      remove()
      return
    }

    // Hand focus back before the island goes: it is about to be removed from
    // under the user, and `<body>` is not a place to be left standing.
    if (node.contains(document.activeElement)) {
      const target = focusReturn.current
      if (target !== null && target.isConnected) target.focus()
      else (document.activeElement as HTMLElement | null)?.blur()
    }

    const throwTo = thrown.current
    const travel = position.startsWith('top') ? -ENTER_TRAVEL : ENTER_TRAVEL
    const away =
      throwTo === null
        ? `translateY(${travel}px) scale(${ENTER_SCALE})`
        : throwTo.axis === 'x'
          ? `translate3d(${throwTo.sign * 100}%, 0, 0)`
          : `translate3d(0, ${throwTo.sign * 100}%, 0)`

    // A thrown island leaves from the finger's last position. Starting at rest
    // would snap it back for a frame and break the continuity of the gesture.
    const at =
      throwTo === null
        ? 'translateY(0px) scale(1)'
        : throwTo.axis === 'x'
          ? `translate3d(${throwTo.from}px, 0, 0)`
          : `translate3d(0, ${throwTo.from}px, 0)`

    animateNoti(
      node,
      'transform',
      reducedMotion
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { opacity: 1, transform: at },
            { opacity: 0, transform: away },
          ],
      motionToken(
        throwTo === null ? 'exit' : 'swipeOut',
        reducedMotion,
        readNotiSpringDuration(node)
      ),
      remove
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.phase, instanceId, store])

  // The store outlives the item. A pointer resting on the island when it is
  // removed never gets a `pointerleave`, and a hold with nothing left to
  // release it pauses every notification that comes after.
  useEffect(() => {
    const node = element.current
    const reasons = held.current

    return () => {
      if (node !== null) cancelAllNotiAnimations(node)

      for (const reason of reasons) store.resume(reason)
      reasons.clear()
    }
  }, [store])

  /* --------------------------------- Gesture ------------------------------ */

  /**
   * The finger's offset goes straight to the node.
   *
   * A pointer can outrun the display, and a React commit per event would put a
   * render between the finger and the island. Nothing else writes `transform`
   * on this element, so there is nothing to race.
   */
  function paintOffset(node: HTMLLIElement, offset: number, along: NotiSwipeAxis | null): void {
    node.style.transform =
      offset === 0 || along === null
        ? ''
        : along === 'x'
          ? `translate3d(${offset}px, 0, 0)`
          : `translate3d(0, ${offset}px, 0)`
  }

  function endDrag(node: HTMLLIElement, state: DragState): void {
    if (node.hasPointerCapture(state.pointerId)) node.releasePointerCapture(state.pointerId)
    drag.current = null
    setAxis(null)
  }

  /**
   * Whether a point landed on the island rather than beside it.
   *
   * The item spans the whole outlet — 350px, or the viewport on a phone — while
   * the compact pill is a fraction of that. The rest is transparent, and a tap
   * there means the page, not the island. Only what the canvas actually paints
   * counts: the pill, plus the card body once it is open.
   *
   * Measured off the rects themselves, so the flip a top-anchored island is
   * drawn with is already in the numbers.
   */
  function onSilhouette(node: HTMLLIElement, x: number, y: number): boolean {
    const painted = node.querySelectorAll('[data-noti-island-pill], [data-noti-island-body]')
    let measurable = false

    for (const part of painted) {
      const rect = part.getBoundingClientRect()
      // Zero while the body is collapsed, and everywhere in an environment with
      // no layout: there the question cannot be answered, so it is not asked.
      if (rect.width === 0 || rect.height === 0) continue

      measurable = true
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true
    }

    return !measurable
  }

  /**
   * Touch's answer to hover.
   *
   * A pointer that cannot hover has no way in otherwise: `pointerenter` is
   * refused for it, because on touch `pointerleave` arrives with the release
   * and the island would shut inside the same gesture. A tap is the one form
   * that carries its own reverse — another tap.
   */
  function toggleByTap(): void {
    const next = !expanded

    tapped.current = next
    interacting.current = next
    setExpanded(next)
    // Held like a hover, for the same reason: what is being read must not time
    // out mid-sentence. The tap that closes it hands the countdown back, and so
    // does one landing anywhere else on the page.
    if (next) hold('hover')
    else release('hover')
  }

  function handlePointerDown(event: PointerEvent<HTMLLIElement>): void {
    // Before the gesture's own guards: a tap is not a swipe, and it still has
    // to work on an island that cannot be swiped away.
    tap.current = isHoverPointer(event)
      ? null
      : { pointerId: event.pointerId, x: event.clientX, y: event.clientY }

    if (swipe === null || !record.dismissible) return
    if (drag.current !== null) return
    if (!canStartSwipe(event.target)) return

    // A grab interrupts whatever the island was doing. The animation writes the
    // same property, and it outranks inline style: left running, the finger
    // would drag a node that is not following it.
    cancelNotiAnimation(event.currentTarget, 'transform')
    // Cancelling skips the entrance's own callback, so the phase is settled
    // here instead — the reducer ignores it if it already moved on.
    store.dispatch({ type: 'settle', instanceId })

    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      axis: null,
      recentOffset: 0,
      recentAt: event.timeStamp,
    }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLLIElement>): void {
    const state = drag.current
    if (swipe === null || state === null || event.pointerId !== state.pointerId) return

    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY

    // Lock an axis, or a vertical scroll would drag the island sideways.
    if (state.axis === null) {
      const locked = resolveSwipeAxis(dx, dy, swipe.deadZone)
      if (locked === null) return

      state.axis = locked
      setAxis(locked)
    }

    const delta = state.axis === 'x' ? dx : dy

    // Keep one sample a frame old, so release speed reflects the flick.
    if (event.timeStamp - state.recentAt >= MIN_VELOCITY_WINDOW) {
      state.recentOffset = delta
      state.recentAt = event.timeStamp
    }

    paintOffset(
      event.currentTarget,
      resolveSwipeOffset(state.axis, delta, swipe.directions).offset,
      state.axis
    )
  }

  function handlePointerUp(event: PointerEvent<HTMLLIElement>): void {
    const start = tap.current
    tap.current = null

    if (start !== null && start.pointerId === event.pointerId && canExpand) {
      // A finger never holds still. Anything under the dead zone was meant as a
      // tap, and anything over it already locked an axis and became a swipe.
      const slop = swipe?.deadZone ?? DEFAULT_SWIPE_CONFIG.deadZone
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)

      // The button and the close control own their taps: toggling here as well
      // would collapse the card the same press just acted in.
      if (
        moved <= slop &&
        canStartSwipe(event.target) &&
        onSilhouette(event.currentTarget, event.clientX, event.clientY)
      ) {
        toggleByTap()
      }
    }

    const state = drag.current
    if (swipe === null || state === null || event.pointerId !== state.pointerId) return

    const node = event.currentTarget
    const locked = state.axis
    endDrag(node, state)

    if (locked === null) {
      paintOffset(node, 0, null)
      return
    }

    const delta = locked === 'x' ? event.clientX - state.startX : event.clientY - state.startY
    const { offset: travelled, allowed } = resolveSwipeOffset(locked, delta, swipe.directions)
    const velocity = swipeVelocity(delta - state.recentOffset, event.timeStamp - state.recentAt)

    if (allowed && shouldDismissOnRelease(travelled, velocity, swipe)) {
      thrown.current = { axis: locked, sign: Math.sign(delta) || 1, from: travelled }
      // The inline offset goes now: the exit keyframes carry it instead, so
      // two transforms never fight over the same node.
      paintOffset(node, 0, null)
      dismiss('swipe')
      return
    }

    // The rest position is the animation's job from here; leaving the offset
    // inline would make it the floor the animation returns to.
    paintOffset(node, 0, null)

    // Below the threshold: return to rest, so it reads as rejected, not broken.
    if (!reducedMotion && travelled !== 0) {
      animateNoti(
        node,
        'transform',
        [
          {
            transform:
              locked === 'x'
                ? `translate3d(${travelled}px,0,0)`
                : `translate3d(0,${travelled}px,0)`,
          },
          { transform: 'translate3d(0, 0, 0)' },
        ],
        NOTI_MOTION.swipeReturn
      )
    }
  }

  function handlePointerCancel(event: PointerEvent<HTMLLIElement>): void {
    if (tap.current?.pointerId === event.pointerId) tap.current = null

    const state = drag.current
    if (state === null || event.pointerId !== state.pointerId) return

    endDrag(event.currentTarget, state)
    paintOffset(event.currentTarget, 0, null)
  }

  function setExpanded(next: boolean): void {
    store.dispatch({ type: 'expand', instanceId, expanded: next })
  }

  /** Pausing through here is what makes the hold releasable on unmount. */
  function hold(reason: PauseReason): void {
    held.current.add(reason)
    store.pause(reason)
  }

  function release(reason: PauseReason): void {
    if (!held.current.delete(reason)) return
    store.resume(reason)
  }

  /* ---------------------------------- Render ------------------------------ */

  const contentOffset = edge === 'bottom' ? compactHeight : 0

  const style: CSSProperties = {
    // Structural, so an `unstyled` outlet still gets a working skeleton: the
    // layers are placed against this box, and the outlet is click-through.
    position: 'relative',
    pointerEvents: 'auto',
    // No `transform` here on purpose: the gesture writes it straight to the
    // node, and a key React owns would be wiped on the next unrelated render.
    // A drag must track the finger exactly, so no transition while one is live.
    transition: dragging ? 'none' : undefined,
    // Let the page scroll under a notification that cannot be thrown that way.
    touchAction:
      swipe === null
        ? 'auto'
        : swipe.directions.includes('up') || swipe.directions.includes('down')
          ? 'none'
          : 'pan-y',
    ['--noti-island-height' as string]: `${expanded ? expandedHeight : compactHeight}px`,
    ['--noti-pill-width' as string]: `${pillWidth}px`,
    ['--noti-pill-x' as string]: `${pillX}px`,
    // Against the pill's trailing edge while compact, against the card's
    // corner once open. A fixed inset would strand it at the far edge of the
    // full-width box, well outside a right-aligned capsule.
    ['--noti-close-inset' as string]: expanded
      ? '8px'
      : `${Math.max(8, islandWidth - pillX - pillWidth + 8)}px`,
    ['--noti-close-top' as string]: `${(expanded ? contentOffset : 0) + 8}px`,
    // The pill's horizontal travel rides in the transform rather than in `left`:
    // same movement, without a layout pass on every frame of the morph.
    ['--noti-heading-transform' as string]: expanded
      ? `translate3d(${pillX}px, ${edge === 'bottom' ? 3 : -3}px, 0) scale(0.9)`
      : `translate3d(${pillX}px, 0px, 0) scale(1)`,
    ['--noti-content-opacity' as string]: expanded ? '1' : '0',
    ['--noti-body-offset' as string]: `${contentOffset}px`,
    ['--noti-actions-offset' as string]: `${contentOffset + bodyHeight}px`,
  }

  const buttonClassName = joinClassNames(classNames?.button, view.styles?.button)

  return (
    <li
      ref={element}
      data-noti-item=''
      data-noti-state={view.state}
      data-noti-phase={record.phase}
      data-noti-position={position}
      data-noti-edge={edge}
      data-noti-ready={ready ? '' : undefined}
      data-noti-expanded={expanded ? '' : undefined}
      data-noti-truncated={truncated ? '' : undefined}
      data-noti-paused={record.paused ? '' : undefined}
      data-noti-swiping={dragging ? '' : undefined}
      className={classNames?.item}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerEnter={(event: PointerEvent<HTMLLIElement>) => {
        if (!isHoverPointer(event)) return

        interacting.current = true
        if (canExpand) setExpanded(true)
        hold('hover')
      }}
      onPointerLeave={(event: PointerEvent<HTMLLIElement>) => {
        // Released unconditionally: a pointer that took the hold out may
        // still leave as a type this guard would now reject.
        if (!isHoverPointer(event)) release('hover')
        else {
          interacting.current = false
          if (canExpand) setExpanded(false)
          release('hover')
        }
      }}
      // React's onFocus/onBlur are focusin/focusout, so they fire for anything
      // focused inside — which is the point: keep it open while it is in use.
      onFocus={(event: FocusEvent<HTMLLIElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          focusReturn.current =
            event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null
        }
        interacting.current = true
        if (canExpand) setExpanded(true)
        hold('focus')
      }}
      onBlur={(event: FocusEvent<HTMLLIElement>) => {
        if (event.currentTarget.contains(event.relatedTarget)) return
        interacting.current = false
        if (canExpand) setExpanded(false)
        release('focus')
      }}
    >
      <NotiIslandCanvas
        width={islandWidth}
        compactHeight={compactHeight}
        // Sized for the open state whenever one is reachable. Read from
        // `hasDetails` instead, an island opened by its close button alone would
        // draw a body taller than the box holding it.
        height={expandable ? Math.max(expandedHeight, minExpanded) : compactHeight}
        bodyHeight={expanded ? Math.max(0, expandedHeight - compactHeight) : 0}
        edge={edge}
        fill={view.fill}
        roundness={view.roundness}
        blur={blur}
        expanded={expanded}
      />

      {/*
        One live region spanning the island, and a positioning wrapper besides:
        the heading and the body sit inside it so they are announced together,
        while the buttons stay outside.
      */}
      <div
        role={view.important ? 'alert' : 'status'}
        aria-live={view.important ? 'assertive' : 'polite'}
        aria-atomic='true'
        data-noti-content=''
        className={classNames?.content}
      >
        <div ref={header} data-noti-header='' data-noti-edge={edge}>
          <NotiHeadingTransition
            ref={heading}
            state={view.state}
            title={view.title}
            icon={view.icon}
            reducedMotion={reducedMotion}
            icons={icons}
            classNames={classNames}
            styles={view.styles}
          />
        </div>

        {hasDescription && (
          <div ref={body} data-noti-body='' data-noti-visible={expanded ? '' : undefined}>
            <div
              data-noti-description=''
              className={joinClassNames(classNames?.description, view.styles?.description)}
            >
              {view.description}
            </div>
          </div>
        )}
      </div>

      {hasButton && view.button !== undefined && (
        <div
          ref={actions}
          data-noti-actions=''
          data-noti-visible={expanded ? '' : undefined}
          className={classNames?.actions}
        >
          <NotiActionButton button={view.button} className={buttonClassName} />
        </div>
      )}

      {showClose && (
        <button
          type='button'
          data-noti-close=''
          data-noti-visible={expanded ? '' : undefined}
          className={classNames?.close}
          // The glyph is decorative; the name comes from the label.
          aria-label={closeButtonLabel}
          onClick={() => {
            dismiss('close-button')
          }}
        >
          <span aria-hidden='true'>{closeButtonIcon}</span>
        </button>
      )}
    </li>
  )
}

interface NotiActionButtonProps {
  button: NotiButton
  className: string | undefined
}

/**
 * The island's single button. It never closes the notification: a button that
 * dismisses what it acts on takes away the confirmation just earned.
 *
 * It stays in the tab order while the island is compact — focusing it is what
 * opens the island — because a control only a hover can reach is a control the
 * keyboard cannot find.
 */
function NotiActionButton({ button, className }: NotiActionButtonProps) {
  return (
    <button
      type='button'
      data-noti-button=''
      className={className}
      aria-label={button.accessibleLabel}
      onClick={(event) => {
        // A failure keeps the notification up rather than hiding what broke —
        // whether it throws straight away or rejects later, and whether the
        // handler returns a real `Promise` or any other thenable.
        try {
          const result = button.onClick(event)
          if (result === undefined || result === null) return

          void Promise.resolve(result).catch((error: unknown) => {
            console.error('[noti] button handler failed', error)
          })
        } catch (error) {
          console.error('[noti] button handler failed', error)
        }
      }}
    >
      {button.title}
    </button>
  )
}
