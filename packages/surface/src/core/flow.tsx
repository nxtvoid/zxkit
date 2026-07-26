'use client'

import React, { Suspense, useState } from 'react'

import { listNames } from '../utils/names'
import type {
  AnyComponent,
  ArgsFor,
  FlowContentProps,
  FlowDefinition,
  ModalWrapperProps,
  StepRegistry,
} from './types'

// `Steps` and `Initial` are separate type parameters so the initial step keeps its
// literal type; a property constrained to `string` would widen it away.
type FlowInput<Steps extends StepRegistry, Initial extends keyof Steps & string> = {
  /**
   * Root of the dialog primitive. Rendered once for the whole flow, and falls back
   * to `defaultWrapper` when omitted.
   */
  Wrapper?: React.ComponentType<ModalWrapperProps>
  /**
   * The panel every step renders inside, e.g. `DialogContent`. Mounted once and kept
   * across step changes, which is what stops the open animation from replaying.
   * Steps must not render a Content of their own.
   */
  Content: React.ComponentType<FlowContentProps>
  /** The screens of this flow, keyed by the name you pass to `go()`. */
  steps: Steps
  /**
   * Which step the flow opens on, and the step `reset()` returns to. It also decides
   * the flow's own props: `initial: 'plan'` makes `pushModal('Checkout', { plan })`
   * required.
   */
  initial: Initial
}

type InitialProps<Steps extends StepRegistry, Initial extends keyof Steps> = React.ComponentProps<
  Steps[Initial]
>

/**
 * Registers a multi-step modal. The Wrapper and Content are rendered once and stay
 * mounted across steps, so moving between steps never replays the open animation the
 * way replacing one modal with another does.
 *
 * ```ts
 * flow({ Content: DynamicContent, initial: 'cart', steps: { cart, payment } })
 * flow<boolean>()({ ... })  // async result typed too
 * ```
 */
export function flow<Result>(): <Steps extends StepRegistry, Initial extends keyof Steps & string>(
  definition: FlowInput<Steps, Initial>
) => FlowDefinition<Steps, InitialProps<Steps, Initial>, Result>
export function flow<Steps extends StepRegistry, Initial extends keyof Steps & string>(
  definition: FlowInput<Steps, Initial>
): FlowDefinition<Steps, InitialProps<Steps, Initial>, unknown>
export function flow(definition?: FlowInput<StepRegistry, string>) {
  const brand = (input: FlowInput<StepRegistry, string>) => ({ ...input, __flow: true as const })

  if (definition === undefined) {
    return (deferred: FlowInput<StepRegistry, string>) => brand(deferred)
  }

  return brand(definition)
}

type StepArgs<C> = ArgsFor<C extends AnyComponent ? React.ComponentProps<C> : never>

export interface FlowControls<Steps extends StepRegistry = StepRegistry> {
  /** Name of the step currently rendered. */
  step: keyof Steps & string
  /** True when at least one step is below this one on the flow's stack. */
  canGoBack: boolean
  /** Moves forward, keeping the current step on the stack so `back()` can return to it. */
  go: <TName extends keyof Steps & string>(
    ...invocation: [name: TName, ...StepArgs<Steps[TName]>]
  ) => void
  /**
   * Moves without leaving a step behind, so `back()` skips the one being replaced.
   * Distinct from `useModalControls().replace`, which swaps the whole modal.
   */
  replaceStep: <TName extends keyof Steps & string>(
    ...invocation: [name: TName, ...StepArgs<Steps[TName]>]
  ) => void
  /** Returns to the previous step. No-op on the first step. */
  back: () => void
  /** Returns to the step the flow started on, clearing the stack. */
  reset: () => void
}

const FlowControlsContext = React.createContext<FlowControls | null>(null)

/**
 * Use inside a flow step. Pass the steps object as a type argument to get the step
 * names and their props checked: `useFlowControls<typeof checkoutSteps>()`.
 */
export function useFlowControls<Steps extends StepRegistry = StepRegistry>() {
  const context = React.useContext(FlowControlsContext)

  if (!context) {
    throw new Error('useFlowControls must be used within a step of a modal created by flow()')
  }

  return context as FlowControls<Steps>
}

type FlowStackEntry = { name: string; props: Record<string, unknown> }

export function FlowHost({
  definition,
  initialProps,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  definition: FlowDefinition<any, any, any>
  initialProps: Record<string, unknown>
}) {
  const firstStep = React.useMemo<FlowStackEntry[]>(
    () => [{ name: definition.initial, props: initialProps }],
    [definition.initial, initialProps]
  )
  const [stack, setStack] = useState<FlowStackEntry[]>(firstStep)

  const current = stack[stack.length - 1] ?? firstStep[0]!
  const StepComponent = definition.steps[current.name]

  const controls = React.useMemo<FlowControls>(
    () => ({
      step: current.name,
      canGoBack: stack.length > 1,
      go: (name, props) => setStack((s) => [...s, { name, props: props ?? {} }]),
      replaceStep: (name, props) =>
        setStack((s) => [...s.slice(0, -1), { name, props: props ?? {} }]),
      back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
      reset: () => setStack(firstStep),
    }),
    [current.name, stack.length, firstStep]
  )

  if (!StepComponent) {
    throw new Error(
      `Flow step "${current.name}" is not registered. Known steps, closest first: ` +
        `${listNames(current.name, Object.keys(definition.steps))}.`
    )
  }

  const Content = definition.Content

  return (
    <FlowControlsContext.Provider value={controls}>
      <Content>
        <Suspense>
          <StepComponent {...current.props} />
        </Suspense>
      </Content>
    </FlowControlsContext.Provider>
  )
}
