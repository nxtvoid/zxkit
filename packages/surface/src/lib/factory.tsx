'use client'

import React, { Suspense, useEffect, useState } from 'react'
import mitt, { Handler } from 'mitt'
import { Dialog } from 'radix-ui'

interface CreatePushModalOptions<T> {
  modals: {
    [key in keyof T]:
      | {
          Wrapper: React.ComponentType<{
            open?: boolean
            onOpenChange?: (open: boolean) => void
            children?: React.ReactNode
            defaultOpen?: boolean
          }>
          Component: React.ComponentType<T[key]>
        }
      | React.ComponentType<T[key]>
  }
}

export function createPushModal<T>({ modals }: CreatePushModalOptions<T>) {
  type Modals = typeof modals
  type ModalKeys = keyof Modals

  type EventHandlers = {
    change: { name: ModalKeys; open: boolean; props: Record<string, unknown> }
    push: {
      name: ModalKeys
      props: Record<string, unknown>
    }
    replace: {
      name: ModalKeys
      props: Record<string, unknown>
    }
    pop: { name?: ModalKeys }
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
      const pushHandler: Handler<EventHandlers['push']> = ({ name, props }) => {
        emitter.emit('change', { name, open: true, props })
        setState((p) =>
          [
            ...p,
            {
              key: Math.random().toString(),
              name,
              props,
              open: true,
            },
          ].filter(filterGarbage)
        )
      }
      const replaceHandler: Handler<EventHandlers['replace']> = ({ name, props }) => {
        setState((p) => {
          // find last item to replace
          const last = p.findLast((item) => item.open)
          if (last) {
            // if found emit close event
            emitter.emit('change', { name: last.name, open: false, props: last.props })
          }
          emitter.emit('change', { name, open: true, props })

          return [
            // 1) close last item 2) filter garbage 3) add new item
            ...p
              .map((item) => {
                if (item.key === last?.key) {
                  return { ...item, open: false, closedAt: Date.now() }
                }
                return item
              })
              .filter(filterGarbage),
            {
              key: Math.random().toString(),
              name,
              props,
              open: true,
            },
          ]
        })
      }

      const popHandler: Handler<EventHandlers['pop']> = ({ name }) => {
        setState((items) => {
          // Find last open item index
          const index =
            name === undefined
              ? // Pick last open item if no name is provided
                items.findLastIndex((item) => item.open)
              : items.findLastIndex((item) => item.name === name && item.open)
          const match = items[index]
          if (match) {
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
          const modal = modals[item.name]
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
                  popModal(item.name)
                }
              }}
            >
              <Suspense>
                <Component {...item.props} />
              </Suspense>
            </Root>
          )
        })}
      </>
    )
  }

  type Prettify<T> = {
    [K in keyof T]: T[K]
  } & Record<never, never>
  type GetComponentProps<T> = T extends
    | React.ComponentType<infer P>
    | React.Component<infer P>
    | { Component: React.ComponentType<infer P> }
    ? P
    : never
  type IsObject<T> =
    Prettify<T> extends Record<string | number | symbol, unknown> ? Prettify<T> : never
  type HasKeys<T> = keyof T extends never ? never : T

  const pushModal = <T extends StateItem['name'], B extends Prettify<GetComponentProps<Modals[T]>>>(
    name: T,
    ...args: HasKeys<IsObject<B>> extends never
      ? // No props provided
        []
      : // Props provided
        [props: B]
  ) => {
    const [props] = args
    return emitter.emit('push', {
      name,
      props: props ?? {},
    })
  }

  const popModal = (name?: StateItem['name']) =>
    emitter.emit('pop', {
      name,
    })

  const replaceWithModal = <T extends StateItem['name'], B extends GetComponentProps<Modals[T]>>(
    name: T,
    ...args: HasKeys<IsObject<B>> extends never
      ? // No props provided
        []
      : // Props provided
        [props: B]
  ) => {
    const [props] = args
    emitter.emit('replace', {
      name,
      props: props ?? {},
    })
  }

  const popAllModals = () => emitter.emit('popAll')

  type EventCallback<T extends ModalKeys> = (
    open: boolean,
    props: GetComponentProps<Modals[T]>,
    name?: T
  ) => void

  type CloseCallback<T extends ModalKeys> = (props: GetComponentProps<Modals[T]>, name?: T) => void

  const onPushModal = <T extends ModalKeys>(name: T | '*', callback: EventCallback<T>) => {
    const fn: Handler<EventHandlers['change']> = (payload) => {
      if (payload.name === name) {
        callback(payload.open, payload.props as GetComponentProps<Modals[T]>, payload.name as T)
      } else if (name === '*') {
        callback(
          payload.open,
          payload.props as unknown as GetComponentProps<Modals[T]>,
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
              callback(payload.props as GetComponentProps<Modals[T]>, payload.name as T)
            }, delay)
          } else {
            callback(payload.props as GetComponentProps<Modals[T]>, payload.name as T)
          }
        } else if (name === '*') {
          if (delay > 0) {
            setTimeout(() => {
              callback(payload.props as GetComponentProps<Modals[T]>, payload.name as T)
            }, delay)
          } else {
            callback(payload.props as GetComponentProps<Modals[T]>, payload.name as T)
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
