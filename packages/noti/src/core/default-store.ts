import { createNotiStore, type NotiStore } from './store'

/**
 * Store behind the module-level `noti` API.
 *
 * The global key survives HMR and duplicate bundles, keeping one module's
 * outlet wired to another's calls. `v4` removes the retired modal lifecycle
 * so hot reloads cannot reuse a store holding a modal session.
 */
const defaultStoreKey = Symbol.for('@zxkit/noti/default-store/v4')
const registeredStore = Reflect.get(globalThis, defaultStoreKey) as NotiStore | undefined

export const defaultNotiStore: NotiStore = registeredStore ?? createNotiStore()

if (registeredStore === undefined) {
  Reflect.set(globalThis, defaultStoreKey, defaultNotiStore)
}
