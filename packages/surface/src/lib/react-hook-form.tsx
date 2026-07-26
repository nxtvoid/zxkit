import { FieldValues, DefaultValues, UseFormProps, UseFormReturn, useForm } from 'react-hook-form'
import { useEffect, useRef } from 'react'

import type { PreservedStore } from './responsive'

// Portable wrapper interfaces — defined in THIS package so TypeScript can
// reference them as '@zxkit/surface/react-hook-form'.PreservedFormOptions etc. in
// declaration emit, instead of needing to resolve react-hook-form through bun's
// internal paths.
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

  return usePreservedForm as UsePreservedForm
}
