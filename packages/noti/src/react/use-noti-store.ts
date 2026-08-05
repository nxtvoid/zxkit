'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { NotiRecord } from '../types'
import type { NotiStore } from '../core/store'

/**
 * Subscribes to the one live notification. `getState` returns the same object
 * until something changes, which is what makes it safe here.
 */
export function useNotiRecord(store: NotiStore): NotiRecord | null {
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getSnapshot = useCallback(() => store.getState().current, [store])

  // The server has no notification: rendering one would not match the client.
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}

/**
 * Whether this outlet is the one that draws the island.
 *
 * There is a single notification, so a second outlet would render a copy of it
 * and race the first for hover, focus and the same countdown.
 */
export function useNotiRenderOwner(store: NotiStore, token: symbol): boolean {
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getSnapshot = useCallback(() => store.isRenderOwner(token), [store, token])

  // The server renders nothing either way: there is no notification yet.
  return useSyncExternalStore(subscribe, getSnapshot, () => true)
}

/** Returns `fallback` where `matchMedia` is missing, rather than throwing. */
export function useNotiMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {}
      }

      const list = window.matchMedia(query)
      list.addEventListener('change', listener)
      return () => {
        list.removeEventListener('change', listener)
      }
    },
    [query]
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return fallback
    return window.matchMedia(query).matches
  }, [query, fallback])

  return useSyncExternalStore(subscribe, getSnapshot, () => fallback)
}
