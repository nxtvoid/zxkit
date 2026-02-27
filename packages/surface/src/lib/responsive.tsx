import { FieldValues, DefaultValues, UseFormProps, UseFormReturn, useForm } from 'react-hook-form'
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'

export interface WrapperProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  defaultOpen?: boolean
  modal?: boolean
}

export interface ContentProps {
  children?: React.ReactNode
  className?: string
  onAnimationEnd?: (...args: unknown[]) => void
  onOpenAutoFocus?: (event: Event) => void
  onCloseAutoFocus?: (event: Event) => void
  onEscapeKeyDown?: (event: KeyboardEvent) => void
  onPointerDownOutside?: (event: Event) => void
  onInteractOutside?: (event: Event) => void
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

// Portable wrapper interfaces — defined in THIS package so TypeScript can
// reference them as '@zxkit/surface'.PreservedFormOptions etc. in declaration
// emit, instead of needing to resolve react-hook-form through bun's internal paths.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PreservedFormOptions<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends UseFormProps<T> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PreservedFormReturn<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends UseFormReturn<T> {}

export interface ResponsiveWrapperReturn {
  Wrapper: React.ComponentType<WrapperProps>
  Content: React.ComponentType<ContentProps>
  usePreservedState: <T>(
    key: string,
    initialValue: T
  ) => [T, React.Dispatch<React.SetStateAction<T>>]
  usePreservedForm: <T extends Record<string, unknown>>(
    key: string,
    options: PreservedFormOptions<T>
  ) => PreservedFormReturn<T>
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

  const StateStoreContext = createContext<Map<string, unknown>>(new Map())

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

  // Hook to create a react-hook-form form with preserved state. Form state is stored in the StateStoreContext and keyed by the provided key.
  const usePreservedForm: <T extends Record<string, unknown>>(
    key: string,
    options: PreservedFormOptions<T>
  ) => PreservedFormReturn<T> = <T extends FieldValues>(key: string, options: UseFormProps<T>) => {
    const store = useContext(StateStoreContext)
    const hasStoredValues = store.has(key)

    const form = useForm<T>({
      ...options,
      // Use stored values as initial defaultValues so data is visible immediately (no flash)
      defaultValues: (hasStoredValues ? store.get(key) : options.defaultValues) as DefaultValues<T>,
    })

    // When restoring from store, the stored values ARE the defaultValues,
    // so isDirty is false. Fix this by re-establishing the original defaults
    // as the baseline, then restoring the stored values with keepDefaultValues.
    const didRestore = useRef(hasStoredValues)
    useEffect(() => {
      if (didRestore.current) {
        didRestore.current = false
        const currentValues = form.getValues()
        // Set internal defaults back to the originals
        form.reset(options.defaultValues as DefaultValues<T> as T)
        // Restore stored values, keeping original defaults as the isDirty baseline
        form.reset(currentValues as T, { keepDefaultValues: true })
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
      const subscription = form.watch((values) => {
        store.set(key, values)
      })
      return () => subscription.unsubscribe()
    }, [form, store, key])

    return form
  }

  return {
    Wrapper,
    Content,
    usePreservedState,
    usePreservedForm,
  }
}
