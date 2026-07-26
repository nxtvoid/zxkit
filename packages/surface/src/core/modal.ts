import type React from 'react'

import type { AnyComponent, ModalDefinition, ModalWrapperProps } from './types'

type ModalInput =
  | AnyComponent
  | { Wrapper: React.ComponentType<ModalWrapperProps>; Component: AnyComponent }

type PropsOf<D> = D extends { Component: infer C extends AnyComponent }
  ? React.ComponentProps<C>
  : D extends AnyComponent
    ? React.ComponentProps<D>
    : never

/**
 * Registers a modal and infers its props from the component.
 *
 * ```ts
 * modal(EditOrder)
 * modal({ Wrapper: DynamicWrapper, Component: EditOrder })
 * modal<boolean>()(ConfirmDelete)  // async result typed too
 * ```
 */
export function modal<Result>(): <D extends ModalInput>(
  definition: D
) => ModalDefinition<PropsOf<D>, Result>
export function modal<D extends ModalInput>(definition: D): ModalDefinition<PropsOf<D>, unknown>
export function modal(definition?: ModalInput) {
  if (definition === undefined) {
    return (deferred: ModalInput) => deferred
  }

  return definition
}
