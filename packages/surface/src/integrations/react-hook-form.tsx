import { FieldValues, DefaultValues, UseFormProps, UseFormReturn, useForm } from 'react-hook-form'
import { useEffect, useRef } from 'react'

import type { PreservedStore } from '../core/responsive'

// Declared here rather than aliased, so declaration emit points at this package.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PreservedFormOptions<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends UseFormProps<T> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PreservedFormReturn<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends UseFormReturn<T> {}

export type UsePreservedForm = <T extends Record<string, unknown>>(
  key: string,
  options: PreservedFormOptions<T>
) => PreservedFormReturn<T>

/**
 * Binds react-hook-form to a responsive wrapper's preserved store, so form state
 * survives the mobile/desktop remount.
 *
 * ```ts
 * const { Wrapper, Content, usePreservedStore } = createResponsiveWrapper({ mobile, desktop })
 * const usePreservedForm = createPreservedForm(usePreservedStore)
 * ```
 */
export function createPreservedForm(usePreservedStore: () => PreservedStore): UsePreservedForm {
  const usePreservedForm = <T extends FieldValues>(key: string, options: UseFormProps<T>) => {
    const store = usePreservedStore()
    const hasStoredValues = store.has(key)

    const form = useForm<T>({
      ...options,
      defaultValues: (hasStoredValues ? store.get(key) : options.defaultValues) as DefaultValues<T>,
    })

    // Restored values would otherwise become the defaults, leaving isDirty false.
    const didRestore = useRef(hasStoredValues)
    useEffect(() => {
      if (didRestore.current) {
        didRestore.current = false
        const currentValues = form.getValues()
        form.reset(options.defaultValues as DefaultValues<T> as T)
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

  return usePreservedForm as UsePreservedForm
}
