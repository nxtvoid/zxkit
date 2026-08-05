'use client'

import {
  useEffect,
  useInsertionEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { NotiClassNames, NotiIcons, NotiOptions, NotiPosition, NotiTheme } from '../types'
import { DEFAULT_POSITION, DEFAULT_WIDTH } from '../core/constants'
import { defaultNotiStore } from '../core/default-store'
import type { NotiStore } from '../core/store'
import { injectNotiStyles } from '../styles/inject'
import { usePrefersReducedMotion } from '../motion/reduced-motion'
import { DEFAULT_SWIPE_CONFIG, defaultSwipeDirections, type NotiSwipeConfig } from '../motion/swipe'
import { NotiItem } from './noti-item'
import { useNotiMediaQuery, useNotiRecord, useNotiRenderOwner } from './use-noti-store'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** Distance from the viewport edges, per side or all at once. */
export type NotiOffset =
  | number
  | string
  | {
      top?: number | string
      right?: number | string
      bottom?: number | string
      left?: number | string
    }

export interface NotiOutletProps {
  position?: NotiPosition
  offset?: NotiOffset
  /** Defaults every call inherits. A call always wins, one key at a time. */
  options?: Partial<NotiOptions>
  theme?: NotiTheme

  /** Per-state glyphs. `null` drops a badge; a call's own `icon` wins over both. */
  icons?: NotiIcons

  /** On by default. Off when you would rather import the CSS yourself. */
  injectStyles?: boolean
  /** `nonce` for the injected tag, for a strict Content Security Policy. */
  nonce?: string

  closeButton?: boolean
  /** Accessible name for the close control. */
  closeButtonLabel?: string
  /** Decorative glyph inside the close control. Defaults to `×`. */
  closeButtonIcon?: ReactNode
  dir?: 'ltr' | 'rtl' | 'auto'
  /** Set to disable the gesture. Closing is always possible by button and API. */
  swipe?: boolean
  /** Pixels of travel that dismiss on release. */
  swipeThreshold?: number
  /**
   * Keeps the behaviour and the semantics, drops the appearance: `classNames`
   * and the `data-noti-*` attributes become the whole visual contract.
   */
  unstyled?: boolean
  className?: string
  classNames?: NotiClassNames
  style?: CSSProperties
}

/** JavaScript can pass `NaN` or a negative here; CSS would drop the whole rule. */
function toLength(value: number | string, fallback: number): string {
  if (typeof value !== 'number') return value
  return Number.isFinite(value) ? `${Math.max(0, value)}px` : `${fallback}px`
}

/** Anchors the island. Layout only. */
function outletStyle(position: NotiPosition, offset: NotiOffset): CSSProperties {
  const sides =
    typeof offset === 'object'
      ? offset
      : { top: offset, right: offset, bottom: offset, left: offset }
  const inset = {
    top: toLength(sides.top ?? 24, 24),
    right: toLength(sides.right ?? 24, 24),
    bottom: toLength(sides.bottom ?? 24, 24),
    left: toLength(sides.left ?? 24, 24),
  }

  const style: CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    // The default lives in the `var()` rather than in an inline property: an
    // inline write would outrank the `--noti-width` the docs invite you to set,
    // while this still works with the stylesheet left out entirely.
    width: `min(var(--noti-width, ${DEFAULT_WIDTH}px), calc(100vw - ${inset.left} - ${inset.right}))`,
    // Click-through: an empty outlet must not sit on top of the page.
    pointerEvents: 'none',
  }

  if (position.startsWith('top')) {
    style.top = `calc(${inset.top} + env(safe-area-inset-top, 0px))`
  } else {
    style.bottom = `calc(${inset.bottom} + env(safe-area-inset-bottom, 0px))`
  }

  if (position.endsWith('left')) {
    style.left = `calc(${inset.left} + env(safe-area-inset-left, 0px))`
  } else if (position.endsWith('right')) {
    style.right = `calc(${inset.right} + env(safe-area-inset-right, 0px))`
  } else {
    style.left = '50%'
    style.transform = 'translateX(-50%)'
  }

  return style
}

interface NotiOutletInternalProps extends NotiOutletProps {
  /**
   * Render against a store other than the module singleton. Internal: two
   * independent instances would be two mental models again, but tests need it.
   */
  store: NotiStore
}

/** Renders zero or one notification: one `li`, or nothing. */
export function NotiOutletWithStore({
  store,
  position = DEFAULT_POSITION,
  offset = 24,
  options,
  theme = 'system',
  icons,
  injectStyles = true,
  nonce,
  closeButton = false,
  closeButtonLabel = 'Close notification',
  closeButtonIcon = '×',
  dir,
  swipe = true,
  swipeThreshold = DEFAULT_SWIPE_CONFIG.threshold,
  unstyled = false,
  className,
  classNames,
  style,
}: NotiOutletInternalProps) {
  // Before layout effects, so nothing is measured against styles that are not in yet.
  useInsertionEffect(() => {
    if (!injectStyles) return
    injectNotiStyles(nonce)
  }, [injectStyles, nonce])

  /** This mount's seat at the store. Stable, including under StrictMode. */
  const [token] = useState(() => Symbol('noti-outlet'))

  const record = useNotiRecord(store)
  const isRenderOwner = useNotiRenderOwner(store, token)
  const prefersDark = useNotiMediaQuery(DARK_QUERY)
  const reducedMotion = usePrefersReducedMotion()

  // The imperative API resolves options before React sees them, so the
  // outlet's defaults have to reach the store.
  useEffect(
    () => store.registerOutlet(token, { position, options }),
    [store, token, position, options]
  )

  // A countdown should not burn down in a hidden tab.
  //
  // Only the outlet that renders takes this hold. The reason is shared, so a
  // second outlet unmounting would otherwise release it on behalf of one that
  // is still mounted with the tab still hidden.
  useEffect(() => {
    if (!isRenderOwner) return

    const sync = () => {
      if (document.hidden) store.pause('document-hidden')
      else store.resume('document-hidden')
    }

    // Read once on mount too: the tab may already have been in the background
    // when this outlet arrived, and no event is coming to say so.
    sync()
    document.addEventListener('visibilitychange', sync)

    return () => {
      document.removeEventListener('visibilitychange', sync)
      // The store outlives the outlet. Leaving a hold behind would pause every
      // future notification forever, with nothing left to release it.
      store.resume('document-hidden')
    }
  }, [store, isRenderOwner])

  const at = record?.position ?? position

  const swipeConfig: NotiSwipeConfig | null = useMemo(
    () =>
      swipe
        ? {
            ...DEFAULT_SWIPE_CONFIG,
            // A `NaN` threshold compares false against every distance, so the
            // gesture would never dismiss and never say why.
            threshold: Number.isFinite(swipeThreshold)
              ? Math.max(1, swipeThreshold)
              : DEFAULT_SWIPE_CONFIG.threshold,
            directions: defaultSwipeDirections(at),
          }
        : null,
    [swipe, swipeThreshold, at]
  )

  // A second outlet keeps its defaults registered and its holds working; what
  // it does not do is draw a second copy of the one island.
  if (record === null || !isRenderOwner) return null

  const resolvedTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme

  return (
    <ol
      data-noti-outlet=''
      data-noti-position={at}
      data-noti-theme={resolvedTheme}
      data-noti-unstyled={unstyled ? '' : undefined}
      dir={dir}
      className={className ?? classNames?.outlet}
      style={{ ...outletStyle(at, offset), ...style }}
    >
      <NotiItem
        key={record.id}
        record={record}
        store={store}
        position={at}
        reducedMotion={reducedMotion}
        icons={icons}
        swipe={swipeConfig}
        closeButton={closeButton}
        closeButtonLabel={closeButtonLabel}
        closeButtonIcon={closeButtonIcon}
        classNames={classNames}
      />
    </ol>
  )
}

/** Mount one, once. A second one warns and renders nothing. */
export function NotiOutlet(props: NotiOutletProps) {
  return <NotiOutletWithStore {...props} store={defaultNotiStore} />
}
