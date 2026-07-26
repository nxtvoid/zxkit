'use client'

import React, { Suspense, useEffect, useState } from 'react'
import mitt, { Handler } from 'mitt'

import { listNames } from '../utils/names'
import { ModalControlsContext } from './controls'
import { FlowHost } from './flow'
import { ModalRoot } from './modal-root'
import type {
  ExtractModalProps,
  ExtractModalResult,
  ModalHandle,
  ModalInvocation,
  ModalRegistry,
  ModalWrapperProps,
} from './types'

const EXIT_ANIMATION_MS = 350
const GARBAGE_GRACE_MS = 300

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
    push: { key?: string; name: ModalKeys; props: Record<string, unknown> }
    replace: { key?: string; name: ModalKeys; props: Record<string, unknown> }
    pop: { key?: string; name?: ModalKeys }
    popAll: undefined
  }

  interface StateItem {
    key: string
    name: ModalKeys
    props: Record<string, unknown>
    open: boolean
    closedAt?: number
    /** Bumped on replace, so the body remounts while the wrapper stays open. */
    instance: number
  }

  const filterGarbage = (item: StateItem): boolean => {
    if (item.open || !item.closedAt) {
      return true
    }
    return Date.now() - item.closedAt < GARBAGE_GRACE_MS
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

  const popModalByKey = (key: string) => emitter.emit('pop', { key })

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

  const assertRegistered = (name: ModalKeys) => {
    if (name in modals) return

    const known = Object.keys(modals)

    throw new Error(
      `Modal "${String(name)}" is not registered with createPushModal. ` +
        (known.length > 0
          ? `Known modals, closest first: ${listNames(String(name), known)}.`
          : 'The modals object passed to createPushModal is empty.')
    )
  }

  const replaceModalByKey = (key: string, name: ModalKeys, props: Record<string, unknown>) => {
    assertRegistered(name)

    return emitter.emit('replace', { key, name, props })
  }

  function ModalProvider() {
    const [state, setState] = useState<StateItem[]>([])

    useEffect(() => {
      const hasClosedModals = state.some((item) => typeof item.closedAt === 'number')
      if (!hasClosedModals) return

      const timer = setTimeout(() => {
        setState((p) => p.filter(filterGarbage))
      }, EXIT_ANIMATION_MS)

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
                ? items.findLastIndex((item) => item.open)
                : items.findLastIndex((item) => item.name === name && item.open)

          const match = items[index]
          if (match) {
            resolveAsyncModal(match.key, undefined)
            emitter.emit('change', { name: match.name, open: false, props: match.props })
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
          const entry = modals[item.name]
          if (!entry) {
            assertRegistered(item.name)
            return null
          }

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
            <ModalRoot
              key={item.key}
              Root={Root}
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
            </ModalRoot>
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

  const pushModal = <T extends ModalKeys>(...invocation: ModalInvocationFor<T>) => {
    const [name, ...args] = invocation
    const [props] = args
    const key = createModalKey()

    assertRegistered(name)
    emitter.emit('push', { key, name, props: props ?? {} })

    return createModalHandle(key)
  }

  const popModal = (name?: ModalKeys) => emitter.emit('pop', { name })

  const replaceWithModal = <T extends ModalKeys>(...invocation: ModalInvocationFor<T>) => {
    const [name, ...args] = invocation
    const [props] = args

    assertRegistered(name)
    emitter.emit('replace', { name, props: props ?? {} })
  }

  function pushModalAsync<T extends ModalKeys>(
    ...invocation: ModalInvocationFor<T>
  ): Promise<ExtractModalResult<Modals[T]> | undefined>
  function pushModalAsync<T extends ModalKeys>(...invocation: ModalInvocationFor<T>) {
    const [name, ...args] = invocation
    const [props] = args
    const key = createModalKey()

    assertRegistered(name)

    return new Promise<unknown | undefined>((resolve, reject) => {
      asyncResolutions.set(key, { resolve, reject })
      emitter.emit('push', { key, name, props: props ?? {} })
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
      if (payload.name !== name && name !== '*') return

      callback(
        payload.open,
        payload.props as unknown as ExtractModalProps<Modals[T]>,
        payload.name as T
      )
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
      if (payload.open) return
      if (payload.name !== name && name !== '*') return

      const run = () => callback(payload.props as ExtractModalProps<Modals[T]>, payload.name as T)

      if (delay > 0) {
        setTimeout(run, delay)
      } else {
        run()
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
