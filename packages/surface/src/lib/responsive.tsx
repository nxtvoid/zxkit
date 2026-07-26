import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'

export interface WrapperProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  defaultOpen?: boolean
  modal?: boolean
}

// Only DOM-standard props are named here. Primitive-specific escape hatches
// (focus/outside-interaction callbacks, whose names differ per library) pass
// through the index signature untyped.
export interface ContentProps {
  children?: React.ReactNode
  className?: string
  onAnimationEnd?: (...args: unknown[]) => void
  [key: string]: unknown
}

type Options = {
  mobile: {
    Wrapper: React.ComponentType<WrapperProps>
    Content: React.ComponentType<ContentProps>
  }
  desktop: {
    Wrapper: React.ComponentType<WrapperProps>
    Content: React.ComponentType<ContentProps>
  }
  breakpoint?: number
}

/**
 * Backing store for values that must survive a mobile/desktop swap. Exposed so
 * integrations for form libraries can be built outside this package — see
 * `@zxkit/surface/react-hook-form` for the reference implementation.
 */
export type PreservedStore = Map<string, unknown>

export interface ResponsiveWrapperReturn {
  Wrapper: React.ComponentType<WrapperProps>
  Content: React.ComponentType<ContentProps>
  usePreservedState: <T>(
    key: string,
    initialValue: T
  ) => [T, React.Dispatch<React.SetStateAction<T>>]
  usePreservedStore: () => PreservedStore
}

export function createResponsiveWrapper({
  mobile,
  desktop,
  breakpoint = 640,
}: Options): ResponsiveWrapperReturn {
  // Create a context to share the isMobile state between Wrapper and Content
  const ResponsiveContext = createContext<boolean | undefined>(undefined)

  const mediaQuery = `(max-width: ${breakpoint}px)`

  let mql: MediaQueryList | null = null
  function getMql() {
    if (!mql) mql = window.matchMedia(mediaQuery)
    return mql
  }

  function subscribe(callback: () => void) {
    const m = getMql()
    m.addEventListener('change', callback)
    return () => m.removeEventListener('change', callback)
  }

  function getSnapshot() {
    return getMql().matches
  }

  function useIsMobile() {
    return useSyncExternalStore(
      subscribe,
      getSnapshot,
      // server snapshot is always false (desktop) to match initial client render and avoid hydration mismatch
      () => false
    )
  }

  const StateStoreContext = createContext<PreservedStore>(new Map())

  const usePreservedStore = () => useContext(StateStoreContext)

  function Wrapper(props: WrapperProps) {
    const isMobile = useIsMobile()
    const stateStore = useRef(new Map<string, unknown>()).current
    const WrapperComponent = isMobile ? mobile.Wrapper : desktop.Wrapper

    // Clear the preserved state store when the dialog/drawer closes
    useEffect(() => {
      if (props.open === false) {
        stateStore.clear()
      }
    }, [props.open, stateStore])

    return (
      <StateStoreContext.Provider value={stateStore}>
        <ResponsiveContext.Provider value={isMobile}>
          <WrapperComponent {...props} />
        </ResponsiveContext.Provider>
      </StateStoreContext.Provider>
    )
  }

  function Content(props: ContentProps) {
    const contextIsMobile = useContext(ResponsiveContext)

    if (contextIsMobile === undefined) {
      throw new Error('Content must be used within a Wrapper component')
    }

    const ContentComponent = contextIsMobile ? mobile.Content : desktop.Content

    return <ContentComponent {...props} />
  }

  // Hook to preserve state across unmounts. State is stored in the StateStoreContext and keyed by the provided key.
  const usePreservedState: <T>(
    key: string,
    initialValue: T
  ) => [T, React.Dispatch<React.SetStateAction<T>>] = <T,>(key: string, initialValue: T) => {
    const store = useContext(StateStoreContext)

    const [state, setState] = useState<T>(() => {
      // if the store already has a value for this key, use it.
      // Otherwise, use the provided initial value
      if (store.has(key)) return store.get(key) as T
      return initialValue
    })

    useEffect(() => {
      store.set(key, state)
    }, [store, key, state])

    return [state, setState]
  }

  return {
    Wrapper,
    Content,
    usePreservedState,
    usePreservedStore,
  }
}
