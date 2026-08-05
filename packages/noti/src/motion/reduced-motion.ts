'use client'

import { useNotiMediaQuery } from '../react/use-noti-store'

/** Defaults to `true` without `matchMedia`: better still than moving unasked. */
export function usePrefersReducedMotion(): boolean {
  return useNotiMediaQuery('(prefers-reduced-motion: reduce)', true)
}
