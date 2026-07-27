import type React from 'react'

export type ModalName = string | number | symbol

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent = React.ComponentType<any>

/**
 * Shape a wrapper component must accept to host a modal. Deliberately minimal so any
 * headless primitive (or a hand-written shim over one) can satisfy it.
 */
export type ModalWrapperProps = {
  /** Driven by the stack. The wrapper should render nothing when false. */
  open?: boolean
  /** Called by the primitive on dismiss. The stack closes the instance on `false`. */
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  /** Only forwarded to the primitive; the stack always controls `open`. */
  defaultOpen?: boolean
}

/** Shape the shell of a flow must accept. */
export type FlowContentProps = {
  children?: React.ReactNode
}

export type ModalDefinition<Props, Result = unknown> =
  | (React.ComponentType<Props> & { __modalResult?: Result })
  | ({
      Wrapper: React.ComponentType<ModalWrapperProps>
      Component: React.ComponentType<Props>
    } & { __modalResult?: Result })

export type StepRegistry = Record<string, AnyComponent>

/**
 * A multi-step modal. The Wrapper and Content are rendered once and never unmount,
 * so swapping steps does not replay the primitive's open animation.
 */
export type FlowDefinition<Steps extends StepRegistry, Props, Result = unknown> = {
  __flow: true
  Wrapper?: React.ComponentType<ModalWrapperProps>
  Content: React.ComponentType<FlowContentProps>
  steps: Steps
  initial: keyof Steps & string
  __modalProps?: Props
  __modalResult?: Result
}

// The flow branch must stay first: a flow also matches the `{ Component }` shape.
export type ExtractModalProps<T> = T extends { __flow: true; __modalProps?: infer P }
  ? P
  : T extends React.ComponentType<infer P>
    ? P
    : T extends { Component: React.ComponentType<infer P> }
      ? P
      : never

export type ExtractModalResult<T> = T extends { __modalResult?: infer R } ? R : unknown

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & Record<never, never>

export type ArgsFor<P> = keyof Prettify<P> extends never
  ? []
  : Record<never, never> extends Prettify<P>
    ? [props?: Prettify<P>]
    : [props: Prettify<P>]

type FlowSteps<T> = T extends { __flow: true; steps: infer S }
  ? S extends StepRegistry
    ? S
    : never
  : never

/**
 * Entering a flow at a step other than its registered `initial`. The step name is
 * positional so it cannot collide with a prop name, and the props that follow are
 * the ones that step declares.
 */
type StepEntryArgs<Steps extends StepRegistry> = {
  [K in keyof Steps & string]: [step: K, ...ArgsFor<React.ComponentProps<Steps[K]>>]
}[keyof Steps & string]

// The guard keeps the union off every non-flow entry, which measured cheaper than
// letting `StepEntryArgs` resolve to `never` and collapse.
export type ModalArgs<T> = [FlowSteps<T>] extends [never]
  ? ArgsFor<ExtractModalProps<T>>
  : ArgsFor<ExtractModalProps<T>> | StepEntryArgs<FlowSteps<T>>

/* eslint-disable @typescript-eslint/no-explicit-any */
export type ModalRegistry = Record<
  string,
  ModalDefinition<any, any> | FlowDefinition<any, any, any>
>
/* eslint-enable @typescript-eslint/no-explicit-any */

export type ModalInvocation<TModals extends ModalRegistry, TName extends keyof TModals> = [
  name: TName,
  ...args: ModalArgs<TModals[TName]>,
]

export type ModalHandle<TModals extends ModalRegistry> = {
  /** Identifies this instance, so two modals pushed under the same name stay distinct. */
  key: string
  /** Closes this instance. Resolves a pending `pushModalAsync` with `undefined`. */
  close: () => void
  /** Swaps this instance for another modal. Mounts a fresh panel — see `flow()` for steps. */
  replace: <TName extends keyof TModals>(
    ...invocation: ModalInvocation<TModals, TName>
  ) => ModalHandle<TModals>
}
