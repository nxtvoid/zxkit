'use client'

import { isValidElement, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type {
  NotiClassNames,
  NotiContent,
  NotiIcon,
  NotiIconComponent,
  NotiIcons,
  NotiState,
  NotiStyles,
} from '../types'
import { HEADER_BLUR } from '../core/constants'
import { animateNoti, cancelNotiAnimation } from '../motion/animate'
import { NOTI_MOTION } from '../motion/springs'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * A heading and the presentation it was wearing.
 *
 * The outgoing layer keeps its own `icons` and `styles`: rendering it with the
 * incoming ones would repaint the content that is leaving in the colours of the
 * content arriving, halfway through the blur.
 */
interface NotiHeadingSnapshot {
  state: NotiState
  title: NotiContent
  /** `undefined` uses the state glyph, `null` removes the badge entirely. */
  icon: NotiIcon | null | undefined
  /** The outlet's per-state glyphs. A call's own `icon` still wins. */
  icons: NotiIcons | undefined
  styles: NotiStyles | undefined
}

interface NotiHeadingTransitionProps extends NotiHeadingSnapshot {
  /** Ref to the live layer, which is what the pill is measured from. */
  ref: React.Ref<HTMLDivElement>
  reducedMotion: boolean
  classNames: NotiClassNames | undefined
}

function sameHeading(a: NotiHeadingSnapshot, b: NotiHeadingSnapshot): boolean {
  return a.state === b.state && a.title === b.title && a.icon === b.icon
}

/**
 * Keeps the previous icon and title around long enough to blur them away.
 *
 * A blur, not a plain fade: the outgoing heading defocuses as it leaves, which
 * is what makes `loading → success` read as one object changing its mind. The
 * outgoing layer is `aria-hidden`, so only the new value is announced.
 */
export function NotiHeadingTransition({
  ref,
  state,
  title,
  icon,
  reducedMotion,
  icons,
  classNames,
  styles,
}: NotiHeadingTransitionProps) {
  const currentSnapshot: NotiHeadingSnapshot = { state, title, icon, icons, styles }
  const committed = useRef<NotiHeadingSnapshot>(currentSnapshot)
  const [previous, setPrevious] = useState<NotiHeadingSnapshot | null>(null)
  const currentLayer = useRef<HTMLDivElement | null>(null)
  const leavingLayer = useRef<HTMLDivElement | null>(null)

  useIsomorphicLayoutEffect(() => {
    const before = committed.current
    // Always, not only on a heading change: a restyle that keeps the words
    // has to be remembered too, or the next crossfade retains stale colours.
    committed.current = currentSnapshot
    if (sameHeading(before, currentSnapshot)) return

    // Under reduced motion nothing is retained: it would be decoration.
    setPrevious(reducedMotion ? null : before)
  }, [state, title, icon, icons, styles, reducedMotion])

  useIsomorphicLayoutEffect(() => {
    const incoming = currentLayer.current
    const outgoing = leavingLayer.current
    if (previous === null || incoming === null || outgoing === null) return

    animateNoti(
      incoming,
      'content',
      [
        { opacity: 0, filter: `blur(${HEADER_BLUR}px)` },
        { opacity: 1, filter: 'blur(0px)' },
      ],
      NOTI_MOTION.headingEnter
    )
    animateNoti(
      outgoing,
      'content',
      [
        { opacity: 1, filter: 'blur(0px)' },
        { opacity: 0, filter: `blur(${HEADER_BLUR}px)` },
      ],
      NOTI_MOTION.headingExit,
      () => {
        setPrevious((candidate) => (candidate === previous ? null : candidate))
      }
    )

    return () => {
      cancelNotiAnimation(incoming, 'content')
      cancelNotiAnimation(outgoing, 'content')
    }
  }, [previous])

  return (
    <div data-noti-heading-stack=''>
      <div
        ref={mergeRefs(ref, currentLayer)}
        data-noti-heading-layer='current'
        className={classNames?.heading}
      >
        <HeadingContent snapshot={currentSnapshot} classNames={classNames} />
      </div>
      {previous !== null && (
        <div
          ref={leavingLayer}
          data-noti-heading-layer='previous'
          aria-hidden='true'
          className={classNames?.heading}
        >
          <HeadingContent snapshot={previous} classNames={classNames} />
        </div>
      )}
    </div>
  )
}

function mergeRefs(
  external: React.Ref<HTMLDivElement>,
  internal: React.RefObject<HTMLDivElement | null>
): (node: HTMLDivElement | null) => void {
  return (node) => {
    internal.current = node
    if (typeof external === 'function') external(node)
    else if (external !== null) external.current = node
  }
}

interface HeadingContentProps {
  snapshot: NotiHeadingSnapshot
  classNames: NotiClassNames | undefined
}

/** `forwardRef` and `memo` components are objects, not functions. */
const EXOTIC_COMPONENTS = new Set<symbol>([
  Symbol.for('react.forward_ref'),
  Symbol.for('react.memo'),
  Symbol.for('react.lazy'),
])

/**
 * A component to instantiate, rather than a node to render.
 *
 * Not just `typeof === 'function'`: most icon libraries, lucide included,
 * export `forwardRef` objects, which fail that test and then fail as a child.
 */
function isIconComponent(icon: NotiIcon): icon is NotiIconComponent {
  if (isValidElement(icon)) return false
  if (typeof icon === 'function') return true

  return (
    typeof icon === 'object' &&
    icon !== null &&
    '$$typeof' in icon &&
    typeof icon.$$typeof === 'symbol' &&
    EXOTIC_COMPONENTS.has(icon.$$typeof)
  )
}

/** Renders either form. Anything else — a string, a number — passes through. */
function renderIcon(icon: NotiIcon): ReactNode {
  if (!isIconComponent(icon)) return icon as ReactNode

  const Icon = icon
  return <Icon />
}

/**
 * Three layers, narrowest first: the call's `icon`, the outlet's `icons`, the
 * built-in set. `undefined` falls through; `null` is a decision to drop the badge.
 */
function resolveIcon(snapshot: NotiHeadingSnapshot): ReactNode | null {
  if (snapshot.icon !== undefined) {
    return snapshot.icon === null ? null : renderIcon(snapshot.icon)
  }

  const fromOutlet = snapshot.icons?.[snapshot.state]
  if (fromOutlet !== undefined) {
    return fromOutlet === null ? null : renderIcon(fromOutlet)
  }

  return <NotiStateIcon state={snapshot.state} />
}

function joinClassNames(...values: (string | undefined)[]): string | undefined {
  const joined = values.filter((value) => value !== undefined && value !== '').join(' ')
  return joined === '' ? undefined : joined
}

function HeadingContent({ snapshot, classNames }: HeadingContentProps) {
  const icon = resolveIcon(snapshot)
  const styles = snapshot.styles

  return (
    <>
      {icon !== null && (
        <span
          data-noti-icon=''
          data-noti-icon-state={snapshot.state}
          // Decorative: the title text already carries the state.
          aria-hidden='true'
          className={joinClassNames(classNames?.icon, styles?.badge)}
        >
          {icon}
        </span>
      )}
      <span data-noti-title='' className={joinClassNames(classNames?.title, styles?.title)}>
        {snapshot.title}
      </span>
    </>
  )
}

function NotiStateIcon({ state }: { state: NotiState }): ReactNode {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <svg data-noti-state-icon='' viewBox='0 0 24 24' aria-hidden='true'>
      {state === 'success' && <path {...common} d='M20 6 9 17l-5-5' />}
      {state === 'error' && (
        <>
          <path {...common} d='M18 6 6 18' />
          <path {...common} d='m6 6 12 12' />
        </>
      )}
      {state === 'warning' && (
        <>
          <circle {...common} cx='12' cy='12' r='9' />
          <path {...common} d='M12 8v5' />
          <path {...common} d='M12 17h.01' />
        </>
      )}
      {state === 'info' && (
        <>
          <circle {...common} cx='12' cy='12' r='9' />
          <path {...common} d='M12 11v5' />
          <path {...common} d='M12 8h.01' />
        </>
      )}
      {state === 'action' && (
        <>
          <path {...common} d='M5 12h14' />
          <path {...common} d='m13 6 6 6-6 6' />
        </>
      )}
      {state === 'loading' && (
        <path {...common} data-noti-state-icon-spin='' d='M21 12a9 9 0 1 1-6.2-8.56' />
      )}
    </svg>
  )
}
