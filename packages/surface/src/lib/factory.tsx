'use client'

import React, { Suspense, useEffect, useState } from 'react'
import mitt, { Handler } from 'mitt'
import { Dialog } from 'radix-ui'

type ModalName = string | number | symbol
type ModalWrapperProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  defaultOpen?: boolean
}

export type ModalDefinition<Props, Result = unknown> =
  | (React.ComponentType<Props> & { __modalResult?: Result })
  | ({
      Wrapper: React.ComponentType<ModalWrapperProps>
      Component: React.ComponentType<Props>
    } & { __modalResult?: Result })

type ExtractModalProps<T> =
  T extends React.ComponentType<infer P>
    ? P
    : T extends { Component: React.ComponentType<infer P> }
      ? P
      : never

type ExtractModalResult<T> = T extends { __modalResult?: infer R } ? R : unknown
type Prettify<T> = {
  [K in keyof T]: T[K]
} & Record<never, never>
type ModalArgs<T> = keyof Prettify<ExtractModalProps<T>> extends never
  ? []
  : [props: Prettify<ExtractModalProps<T>>]
// `React.ComponentType` is invariant in its props, so the modal registry constraint
// needs a permissive placeholder type to preserve inference for each concrete modal entry.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModalRegistry = Record<string, ModalDefinition<any, any>>
type ModalInvocation<TModals extends ModalRegistry, TName extends keyof TModals> = [
  name: TName,
  ...args: ModalArgs<TModals[TName]>,
]

export type ModalHandle<TModals extends ModalRegistry> = {
  key: string
  close: () => void
  replace: <TName extends keyof TModals>(
    ...invocation: ModalInvocation<TModals, TName>
  ) => ModalHandle<TModals>
}

export function modal<Props, Result = unknown>(
  definition: ModalDefinition<Props, Result>
): ModalDefinition<Props, Result> {
  return definition
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
  modals: TModals
}

export function createPushModal<TModals extends ModalRegistry>({
  modals,
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
          const modal = modals[item.name]!
          const Component = ('Component' in modal ? modal.Component : modal) as React.ComponentType<
            Record<string, unknown>
          >
          const Root = 'Wrapper' in modal ? modal.Wrapper : Dialog.Root

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
                <Suspense>
                  <Component {...item.props} />
                </Suspense>
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
