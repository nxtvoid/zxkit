'use client'

import React, { Suspense, useEffect, useState } from 'react'
import mitt, { Handler } from 'mitt'

type ModalName = string | number | symbol

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

/**
 * Shape the shell of a flow must accept. It is rendered once and stays mounted
 * while steps change, so it should be the primitive's content component.
 */
export type FlowContentProps = {
  children?: React.ReactNode
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StepRegistry = Record<string, React.ComponentType<any>>

/**
 * A multi-step modal. Unlike replacing one modal with another, the Wrapper and
 * Content are rendered once and never unmount, so swapping steps does not replay
 * the primitive's open animation.
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

export type ModalDefinition<Props, Result = unknown> =
  | (React.ComponentType<Props> & { __modalResult?: Result })
  | ({
      Wrapper: React.ComponentType<ModalWrapperProps>
      Component: React.ComponentType<Props>
    } & { __modalResult?: Result })

// The flow branch comes first: a flow is an object and would otherwise fall through
// to the `{ Component }` branch and resolve to `never`.
type ExtractModalProps<T> = T extends { __flow: true; __modalProps?: infer P }
  ? P
  : T extends React.ComponentType<infer P>
    ? P
    : T extends { Component: React.ComponentType<infer P> }
      ? P
      : never

type ExtractModalResult<T> = T extends { __modalResult?: infer R } ? R : unknown
type Prettify<T> = {
  [K in keyof T]: T[K]
} & Record<never, never>
// Three cases, in order: no props at all; only optional ones, so the argument
// itself is optional; at least one required prop.
type ArgsFor<P> = keyof Prettify<P> extends never
  ? []
  : Record<never, never> extends Prettify<P>
    ? [props?: Prettify<P>]
    : [props: Prettify<P>]
type ModalArgs<T> = ArgsFor<ExtractModalProps<T>>
// `React.ComponentType` is invariant in its props, so the modal registry constraint
// needs a permissive placeholder type to preserve inference for each concrete modal entry.
/* eslint-disable @typescript-eslint/no-explicit-any */
type ModalRegistry = Record<string, ModalDefinition<any, any> | FlowDefinition<any, any, any>>
/* eslint-enable @typescript-eslint/no-explicit-any */
type ModalInvocation<TModals extends ModalRegistry, TName extends keyof TModals> = [
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>

type ModalInput =
  | AnyComponent
  | { Wrapper: React.ComponentType<ModalWrapperProps>; Component: AnyComponent }

// Inferring `Props` straight from `ModalDefinition` fails because `React.ComponentType`
// is a union, and TypeScript infers poorly against union targets. Capturing the whole
// input first and reading the props off the concrete component afterwards is reliable.
type PropsOf<D> = D extends { Component: infer C extends AnyComponent }
  ? React.ComponentProps<C>
  : D extends AnyComponent
    ? React.ComponentProps<D>
    : never

/**
 * Registers a modal and infers its props from the component.
 *
 * ```ts
 * modal(EditOrder)                              // props inferred
 * modal({ Wrapper: DynamicWrapper, Component: EditOrder })
 * modal<boolean>()(ConfirmDelete)               // async result typed too
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

// `Steps` and `Initial` are inferred as separate type parameters rather than read
// back off a single input type. A property constrained to `string` widens the
// literal away, which would lose the initial step's props.
type FlowInput<Steps extends StepRegistry, Initial extends keyof Steps & string> = {
  /**
   * Root of the dialog primitive, e.g. `Dialog.Root` or a responsive wrapper.
   * Rendered once for the whole flow. Falls back to `defaultWrapper` when omitted,
   * the same way a `modal()` entry does.
   */
  Wrapper?: React.ComponentType<ModalWrapperProps>
  /**
   * The panel every step renders inside, e.g. `DialogContent`. Mounted once and
   * kept across step changes — this is what stops the open animation from
   * replaying. Steps must not render a Content of their own.
   *
   * Required: there is no `defaultContent`, because the panel is what each flow
   * shapes for itself.
   */
  Content: React.ComponentType<FlowContentProps>
  /**
   * The screens of this flow, keyed by the name you pass to `go()`. Each one
   * renders only the body; props are inferred from the component.
   */
  steps: Steps
  /**
   * Which step the flow opens on, and the step `reset()` returns to.
   *
   * It also decides the flow's own props: pushing it takes the props of this
   * step, so `initial: 'plan'` makes `pushModal('Checkout', { plan })` required.
   * Explicit because key order is not part of an object type in TypeScript, so
   * a "first step" could not be typed.
   */
  initial: Initial
}

// Pushing the flow passes props to whichever step it starts on.
type InitialProps<Steps extends StepRegistry, Initial extends keyof Steps> = React.ComponentProps<
  Steps[Initial]
>

/**
 * Registers a multi-step modal. The Wrapper and Content are rendered once and stay
 * mounted across steps, so moving between steps never replays the open animation
 * the way replacing one modal with another does.
 *
 * ```ts
 * const Checkout = flow({
 *   Wrapper: DynamicWrapper,
 *   Content: DynamicContent,
 *   initial: 'cart',
 *   steps: { cart: CartStep, payment: PaymentStep },
 * })
 *
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
   *
   * Named apart from `useModalControls().replace`, which swaps the whole modal for
   * a different one. A step can reach both, and they act on different things.
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

/**
 * Renders the shell once and swaps only the step below it. `Content` keeps the same
 * component type across steps, so React reconciles it in place instead of tearing
 * the panel down and mounting a fresh one.
 */
function FlowHost({
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
      `Flow step "${current.name}" is not registered. Known steps: ${Object.keys(definition.steps).join(', ')}.`
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

interface ModalControlsContextValue<TResult = unknown> {
  key: string
  name: ModalName
  close: () => void
  resolve: (value?: TResult) => void
  reject: (reason?: unknown) => void
  replace: <TName extends ModalName>(name: TName, props?: Record<string, unknown>) => void
}

const ModalControlsContext = React.createContext<ModalControlsContextValue | null>(null)

export function useModalControls<TResult = unknown>() {
  const context = React.useContext(ModalControlsContext)

  if (!context) {
    throw new Error('useModalControls must be used within a modal created by createPushModal')
  }

  return context as ModalControlsContextValue<TResult>
}

interface CreatePushModalOptions<TModals extends ModalRegistry> {
  /**
   * Every modal this stack can push, keyed by the name you pass to `pushModal()`.
   * Build entries with `modal()` for a single screen, `flow()` for a multi-step one.
   */
  modals: TModals
  /**
   * Wrapper used for modals that do not declare their own `Wrapper`.
   * Pass the root of whatever dialog primitive the app uses.
   */
  defaultWrapper?: React.ComponentType<ModalWrapperProps>
}

export function createPushModal<TModals extends ModalRegistry>({
  modals,
  defaultWrapper,
}: CreatePushModalOptions<TModals>) {
  type Modals = TModals
  type ModalKeys = keyof Modals
  interface AsyncResolution {
    resolve: (value: unknown) => void
    reject: (reason?: unknown) => void
  }

  type EventHandlers = {
    change: { name: ModalKeys; open: boolean; props: Record<string, unknown> }
    push: {
      key?: string
      name: ModalKeys
      props: Record<string, unknown>
    }
    replace: {
      key?: string
      name: ModalKeys
      props: Record<string, unknown>
    }
    pop: { key?: string; name?: ModalKeys }
    popAll: undefined
  }

  interface StateItem {
    key: string
    name: ModalKeys
    props: Record<string, unknown>
    open: boolean
    closedAt?: number
    /**
     * Bumped every time this slot is replaced. A replaced modal keeps its `key` so
     * the wrapper stays mounted, which means React also reconciles whatever is
     * inside it — including a flow's step state. Keying the body on this discards
     * that state, so a replaced flow restarts instead of resuming another flow's steps.
     */
    instance: number
  }

  const filterGarbage = (item: StateItem): boolean => {
    if (item.open || !item.closedAt) {
      return true
    }
    return Date.now() - item.closedAt < 300
  }

  const emitter = mitt<EventHandlers>()
  const asyncResolutions = new Map<string, AsyncResolution>()
  let modalKeyCounter = 0

  const createModalKey = () => `modal-${++modalKeyCounter}`

  const createStateItem = (
    name: ModalKeys,
    props: Record<string, unknown>,
    key = createModalKey()
  ): StateItem => ({
    key,
    name,
    props,
    open: true,
    instance: 0,
  })

  const resolveAsyncModal = (key: string, value: unknown) => {
    const resolution = asyncResolutions.get(key)
    if (!resolution) return

    asyncResolutions.delete(key)
    resolution.resolve(value)
  }

  const rejectAsyncModal = (key: string, reason?: unknown) => {
    const resolution = asyncResolutions.get(key)
    if (!resolution) return

    asyncResolutions.delete(key)
    resolution.reject(reason)
  }

  const popModalByKey = (key: string) =>
    emitter.emit('pop', {
      key,
    })

  const closeModalByKey = (key: string) => {
    resolveAsyncModal(key, undefined)
    popModalByKey(key)
  }

  const resolveModalByKey = (key: string, value: unknown) => {
    resolveAsyncModal(key, value)
    popModalByKey(key)
  }

  const rejectModalByKey = (key: string, reason?: unknown) => {
    rejectAsyncModal(key, reason)
    popModalByKey(key)
  }

  const replaceModalByKey = (key: string, name: ModalKeys, props: Record<string, unknown>) =>
    emitter.emit('replace', {
      key,
      name,
      props,
    })

  function ModalProvider() {
    const [state, setState] = useState<StateItem[]>([])

    // Remove closed modals from state after their exit animation completes
    useEffect(() => {
      const hasClosedModals = state.some((item) => typeof item.closedAt === 'number')
      if (!hasClosedModals) return

      const timer = setTimeout(() => {
        setState((p) => p.filter(filterGarbage))
      }, 350)

      return () => {
        clearTimeout(timer)
      }
    }, [state])

    useEffect(() => {
      const pushHandler: Handler<EventHandlers['push']> = ({ key, name, props }) => {
        emitter.emit('change', { name, open: true, props })
        setState((p) => [...p, createStateItem(name, props, key)].filter(filterGarbage))
      }
      const replaceHandler: Handler<EventHandlers['replace']> = ({ key, name, props }) => {
        setState((p) => {
          const last =
            key !== undefined
              ? p.find((item) => item.key === key && item.open)
              : p.findLast((item) => item.open)

          if (!last) {
            emitter.emit('change', { name, open: true, props })
            return [...p, createStateItem(name, props)].filter(filterGarbage)
          }

          emitter.emit('change', { name: last.name, open: false, props: last.props })
          resolveAsyncModal(last.key, undefined)
          emitter.emit('change', { name, open: true, props })

          return p.map((item) =>
            item.key === last.key
              ? {
                  ...item,
                  name,
                  props,
                  open: true,
                  closedAt: undefined,
                  instance: item.instance + 1,
                }
              : item
          )
        })
      }

      const popHandler: Handler<EventHandlers['pop']> = ({ key, name }) => {
        setState((items) => {
          const index =
            key !== undefined
              ? items.findIndex((item) => item.key === key)
              : name === undefined
                ? // Pick last open item if no name is provided
                  items.findLastIndex((item) => item.open)
                : items.findLastIndex((item) => item.name === name && item.open)
          const match = items[index]
          if (match) {
            resolveAsyncModal(match.key, undefined)
            emitter.emit('change', {
              name: match.name,
              open: false,
              props: match.props,
            })
          }
          return items.map((item) =>
            match?.key !== item.key ? item : { ...item, open: false, closedAt: Date.now() }
          )
        })
      }

      const popAllHandler: Handler<EventHandlers['popAll']> = () => {
        setState((items) => {
          items.forEach((item) => {
            if (item.open) {
              resolveAsyncModal(item.key, undefined)
              emitter.emit('change', { name: item.name, open: false, props: item.props })
            }
          })
          return items.map((item) =>
            item.open ? { ...item, open: false, closedAt: Date.now() } : item
          )
        })
      }
      emitter.on('push', pushHandler)
      emitter.on('replace', replaceHandler)
      emitter.on('pop', popHandler)
      emitter.on('popAll', popAllHandler)
      return () => {
        emitter.off('push', pushHandler)
        emitter.off('replace', replaceHandler)
        emitter.off('pop', popHandler)
        emitter.off('popAll', popAllHandler)
      }
    }, [])

    return (
      <>
        {state.map((item) => {
          const entry = modals[item.name]!
          const isFlow = '__flow' in entry
          const Root = ('Wrapper' in entry ? entry.Wrapper : undefined) ?? defaultWrapper

          if (!Root) {
            throw new Error(
              `Modal "${String(item.name)}" declares no Wrapper, and createPushModal was called ` +
                `without a defaultWrapper. Pass the root of your dialog primitive, e.g. ` +
                `createPushModal({ modals, defaultWrapper: Dialog.Root }).`
            )
          }

          const body = isFlow ? (
            <FlowHost key={item.instance} definition={entry} initialProps={item.props} />
          ) : (
            <Suspense>
              {React.createElement(
                ('Component' in entry ? entry.Component : entry) as React.ComponentType<
                  Record<string, unknown>
                >,
                item.props
              )}
            </Suspense>
          )

          return (
            <Root
              key={item.key}
              open={item.open}
              onOpenChange={(isOpen) => {
                if (!isOpen) {
                  closeModalByKey(item.key)
                }
              }}
            >
              <ModalControlsContext.Provider
                value={{
                  key: item.key,
                  name: item.name,
                  close: () => closeModalByKey(item.key),
                  resolve: (value) => resolveModalByKey(item.key, value),
                  reject: (reason) => rejectModalByKey(item.key, reason),
                  replace: (name, props = {}) =>
                    replaceModalByKey(item.key, name as ModalKeys, props),
                }}
              >
                {body}
              </ModalControlsContext.Provider>
            </Root>
          )
        })}
      </>
    )
  }

  type ModalInvocationFor<T extends ModalKeys> = ModalInvocation<Modals, T>

  const createModalHandle = (key: string): ModalHandle<Modals> => ({
    key,
    close: () => closeModalByKey(key),
    replace: (...invocation) => {
      const [name, ...args] = invocation
      const [props] = args
      replaceModalByKey(key, name, props ?? {})
      return createModalHandle(key)
    },
  })

  const pushModal = <T extends StateItem['name']>(...invocation: ModalInvocationFor<T>) => {
    const [name, ...args] = invocation
    const [props] = args
    const key = createModalKey()

    emitter.emit('push', {
      key,
      name,
      props: props ?? {},
    })

    return createModalHandle(key)
  }

  const popModal = (name?: StateItem['name']) =>
    emitter.emit('pop', {
      name,
    })

  const replaceWithModal = <T extends StateItem['name']>(...invocation: ModalInvocationFor<T>) => {
    const [name, ...args] = invocation
    const [props] = args
    emitter.emit('replace', {
      name,
      props: props ?? {},
    })
  }

  function pushModalAsync<T extends StateItem['name']>(
    ...invocation: ModalInvocationFor<T>
  ): Promise<ExtractModalResult<Modals[T]> | undefined>
  function pushModalAsync<T extends StateItem['name']>(...invocation: ModalInvocationFor<T>) {
    const [name, ...args] = invocation
    const [props] = args
    const key = createModalKey()

    return new Promise<unknown | undefined>((resolve, reject) => {
      asyncResolutions.set(key, {
        resolve,
        reject,
      })

      emitter.emit('push', {
        key,
        name,
        props: props ?? {},
      })
    })
  }

  const popAllModals = () => emitter.emit('popAll')

  type EventCallback<T extends ModalKeys> = (
    open: boolean,
    props: ExtractModalProps<Modals[T]>,
    name?: T
  ) => void

  type CloseCallback<T extends ModalKeys> = (props: ExtractModalProps<Modals[T]>, name?: T) => void

  const onPushModal = <T extends ModalKeys>(name: T | '*', callback: EventCallback<T>) => {
    const fn: Handler<EventHandlers['change']> = (payload) => {
      if (payload.name === name) {
        callback(payload.open, payload.props as ExtractModalProps<Modals[T]>, payload.name as T)
      } else if (name === '*') {
        callback(
          payload.open,
          payload.props as unknown as ExtractModalProps<Modals[T]>,
          payload.name as T
        )
      }
    }
    emitter.on('change', fn)
    return () => emitter.off('change', fn)
  }

  const onCloseModal = <T extends ModalKeys>(
    name: T | '*',
    callback: CloseCallback<T>,
    options?: { delay?: number }
  ) => {
    const delay = options?.delay ?? 0

    const fn: Handler<EventHandlers['change']> = (payload) => {
      if (!payload.open) {
        if (payload.name === name) {
          if (delay > 0) {
            setTimeout(() => {
              callback(payload.props as ExtractModalProps<Modals[T]>, payload.name as T)
            }, delay)
          } else {
            callback(payload.props as ExtractModalProps<Modals[T]>, payload.name as T)
          }
        } else if (name === '*') {
          if (delay > 0) {
            setTimeout(() => {
              callback(payload.props as ExtractModalProps<Modals[T]>, payload.name as T)
            }, delay)
          } else {
            callback(payload.props as ExtractModalProps<Modals[T]>, payload.name as T)
          }
        }
      }
    }

    emitter.on('change', fn)
    return () => emitter.off('change', fn)
  }

  return {
    ModalProvider,
    pushModal,
    pushModalAsync,
    popModal,
    popAllModals,
    replaceWithModal,
    onPushModal,
    onCloseModal,
    useOnPushModal: <T extends ModalKeys>(name: T | '*', callback: EventCallback<T>) => {
      useEffect(() => {
        return onPushModal(name, callback)
      }, [name, callback])
    },
    useOnCloseModal: <T extends ModalKeys>(
      name: T | '*',
      callback: CloseCallback<T>,
      options?: { delay?: number }
    ) => {
      useEffect(() => {
        return onCloseModal(name, callback, options)
      }, [name, callback, options])
    },
  }
}
