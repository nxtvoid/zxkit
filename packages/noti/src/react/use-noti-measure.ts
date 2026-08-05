'use client'

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { COMPACT_HEIGHT, DEFAULT_WIDTH, PILL_PADDING, SPRING_DURATION } from '../core/constants'

/** `useLayoutEffect` warns on the server, where measuring means nothing anyway. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * One measurement of an element, kept up to date. Resizes are batched into a
 * frame so a chain of observer callbacks cannot become a chain of renders.
 *
 * Without `ResizeObserver` the first reading still lands.
 */
function useMeasurement(
  ref: RefObject<HTMLElement | null>,
  read: (element: HTMLElement) => number,
  enabled: boolean,
  key: string
): number {
  const [value, setValue] = useState(0)
  const latest = useRef(read)

  useEffect(() => {
    latest.current = read
  })

  useIsomorphicLayoutEffect(() => {
    if (!enabled) {
      setValue(0)
      return
    }

    const element = ref.current
    if (element === null) return

    const measure = () => {
      const next = latest.current(element)
      setValue((current) => (current === next ? current : next))
    }

    measure()
    if (typeof ResizeObserver !== 'function') return

    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    })
    observer.observe(element)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [ref, enabled, key])

  return value
}

/** The box every other measurement is expressed against. */
interface NotiResolvedTokens {
  /** How wide the island actually draws, token and viewport clamp included. */
  width: number
  /** The pill's height, from `--noti-compact-height`. */
  compactHeight: number
  /**
   * From `--noti-spring-duration`, in milliseconds. The CSS transitions already
   * run on it; reading it here is what keeps the Web Animations side and the
   * timing fallbacks on the same clock.
   */
  springDuration: number
}

const FALLBACK_TOKENS: NotiResolvedTokens = {
  width: DEFAULT_WIDTH,
  compactHeight: COMPACT_HEIGHT,
  springDuration: SPRING_DURATION,
}

function readLength(style: CSSStyleDeclaration, property: string, fallback: number): number {
  const value = Number.parseFloat(style.getPropertyValue(property))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/** CSS times are `600ms` or `0.6s`; `parseFloat` alone cannot tell them apart. */
function readDuration(style: CSSStyleDeclaration, property: string, fallback: number): number {
  const raw = style.getPropertyValue(property).trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value) || value <= 0) return fallback

  return raw.endsWith('ms') ? value : value * 1_000
}

/**
 * The spring duration on an element, read at the moment it is needed.
 *
 * The hook below publishes the same number through state, but state arrives a
 * render late: the entrance effect belongs to the first commit, when the token
 * has not been read yet. An animation about to start reads the DOM instead.
 */
export function readNotiSpringDuration(element: Element): number {
  if (typeof getComputedStyle !== 'function') return SPRING_DURATION
  return readDuration(getComputedStyle(element), '--noti-spring-duration', SPRING_DURATION)
}

/**
 * The geometry the stylesheet resolved, rather than the one this module would
 * assume.
 *
 * `--noti-width` and `--noti-compact-height` are documented as overridable, and
 * the outlet clamps its width to the viewport besides. Measuring the element is
 * what keeps the silhouette, the pill and the mask on one box — at 380px, at
 * 350px, and on a 320px screen where neither applies.
 *
 * The constants stay as the fallback: before layout, on the server and in a
 * hidden ancestor there is nothing to read.
 */
export function useNotiTokens(ref: RefObject<HTMLElement | null>): NotiResolvedTokens {
  const [geometry, setGeometry] = useState(FALLBACK_TOKENS)

  useIsomorphicLayoutEffect(() => {
    const element = ref.current
    if (element === null) return

    const measure = () => {
      const style = typeof getComputedStyle === 'function' ? getComputedStyle(element) : null
      const next: NotiResolvedTokens = {
        // `offsetWidth`, not a bounding rect: the entrance animation scales the
        // island, and a rect read mid-flight would freeze the silhouette on a
        // width the element only had while it was arriving.
        width: element.offsetWidth || FALLBACK_TOKENS.width,
        compactHeight:
          style === null
            ? FALLBACK_TOKENS.compactHeight
            : readLength(style, '--noti-compact-height', FALLBACK_TOKENS.compactHeight),
        springDuration:
          style === null
            ? FALLBACK_TOKENS.springDuration
            : readDuration(style, '--noti-spring-duration', FALLBACK_TOKENS.springDuration),
      }

      setGeometry((current) =>
        current.width === next.width &&
        current.compactHeight === next.compactHeight &&
        current.springDuration === next.springDuration
          ? current
          : next
      )
    }

    measure()
    if (typeof ResizeObserver !== 'function') return

    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    })
    observer.observe(element)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [ref])

  return geometry
}

/**
 * How wide the pill must be to hold its heading — it is not a fixed shape.
 *
 * `scrollWidth`, not `offsetWidth`: the header clips its overflow while the
 * pill catches up, so the latter would report the shape it is leaving.
 */
export function useNotiPillWidth(
  header: RefObject<HTMLElement | null>,
  heading: RefObject<HTMLElement | null>,
  compactHeight: number,
  /** Extra room the pill has to carry, such as a close control. */
  reserved: number,
  key: string
): number {
  const padding = useRef<number | null>(null)

  return useMeasurement(
    heading,
    (element) => {
      const box = header.current
      if (padding.current === null && box !== null && typeof getComputedStyle === 'function') {
        const style = getComputedStyle(box)
        padding.current =
          (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0)
      }

      const width = element.scrollWidth + (padding.current ?? 0) + PILL_PADDING + reserved
      // Never narrower than tall: below that the pill stops being a capsule.
      return Math.max(compactHeight, width)
    },
    true,
    key
  )
}

/** How tall the body is, so the island knows what it is opening into. */
export function useNotiContentHeight(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  key: string
): number {
  return useMeasurement(ref, (element) => element.scrollHeight, enabled, key)
}
