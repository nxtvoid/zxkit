import type { NotiOptions, NotiPosition } from '../types'

/** Objects only, like every other call. There is no textual API to fall back to. */
export type NotiPromiseMessage = Omit<NotiOptions, 'type'>

export type NotiPromiseResolver<A> =
  NotiPromiseMessage | ((argument: A) => NotiPromiseMessage | Promise<NotiPromiseMessage>)

export interface NotiPromiseOptions<T> {
  /**
   * Where the whole flow sits, loading and outcome alike. A single message can
   * still override it; without this the position had to be repeated four times.
   */
  position?: NotiPosition
  /** Shown immediately, sticky until the promise settles. */
  loading: NotiPromiseMessage
  /** Omit to dismiss the notification on success instead of showing one. */
  success?: NotiPromiseResolver<T>
  /** Errors are typed `unknown`: a rejection can be anything. */
  error?: NotiPromiseResolver<unknown>
  /** Replaces `success` when present, as an `action` notification with a button. */
  action?: NotiPromiseResolver<T>
  /** Runs once the promise settles, whichever way. */
  finally?: () => unknown
}

/** Applies the flow's position to a message that did not name its own. */
export function atPosition<T extends NotiPromiseMessage>(
  message: T,
  position: NotiPosition | undefined
): T {
  if (position === undefined || message.position !== undefined) return message
  return { ...message, position }
}

/** Resolves a message spec, awaiting it when the callback is async. */
export async function resolveNotiMessage<A>(
  resolver: NotiPromiseResolver<A> | undefined,
  argument: A
): Promise<NotiPromiseMessage | undefined> {
  if (resolver === undefined) return undefined
  return typeof resolver === 'function' ? await resolver(argument) : resolver
}

/**
 * Accepts a promise or a promise factory, turning a synchronous throw into a
 * rejection so both shapes behave identically.
 */
export function toPromise<T>(input: Promise<T> | (() => Promise<T>)): Promise<T> {
  if (typeof input !== 'function') return input

  try {
    return Promise.resolve(input())
  } catch (error) {
    // Untouched: a factory that throws a string rejects with that string.
    return Promise.reject(error)
  }
}
