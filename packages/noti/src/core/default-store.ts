import { createNotiStore, type NotiStore } from './store'

/**
 * Store behind the module-level `noti` API.
 *
 * The global key survives HMR and duplicate bundles, keeping one module's
 * outlet wired to another's calls. `v2` is the singleton shape — a leftover
 * `v1` holds a record list this code cannot read.
 */
const defaultStoreKey = Symbol.for('@zxkit/noti/default-store/v2')
const registeredStore = Reflect.get(globalThis, defaultStoreKey) as NotiStore | undefined

export const defaultNotiStore: NotiStore = registeredStore ?? createNotiStore()

if (registeredStore === undefined) {
  Reflect.set(globalThis, defaultStoreKey, defaultNotiStore)
}
