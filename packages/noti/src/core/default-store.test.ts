import { afterEach, describe, expect, it, vi } from 'vitest'

// `v2` is the singleton shape. A `v1` store parked on `globalThis` by an older
// bundle holds a record list this code cannot read, so the key moved with it.
const defaultStoreKey = Symbol.for('@zxkit/noti/default-store/v2')
const legacyStoreKey = Symbol.for('@zxkit/noti/default-store/v1')
const originalStore = Reflect.get(globalThis, defaultStoreKey)

afterEach(() => {
  Reflect.deleteProperty(globalThis, defaultStoreKey)
  Reflect.deleteProperty(globalThis, legacyStoreKey)
  if (originalStore !== undefined) Reflect.set(globalThis, defaultStoreKey, originalStore)
  vi.resetModules()
})

describe('defaultNotiStore', () => {
  it('survives module reloads so HMR and duplicate bundles share one store', async () => {
    Reflect.deleteProperty(globalThis, defaultStoreKey)
    vi.resetModules()

    const first = (await import('./default-store')).defaultNotiStore
    vi.resetModules()
    const second = (await import('./default-store')).defaultNotiStore

    expect(second).toBe(first)

    first.destroy()
  })

  it('ignores a store left behind under the previous key', async () => {
    Reflect.deleteProperty(globalThis, defaultStoreKey)
    Reflect.set(globalThis, legacyStoreKey, { shape: 'stack' })
    vi.resetModules()

    const store = (await import('./default-store')).defaultNotiStore
    expect(store.getState()).toEqual({ current: null })

    store.destroy()
  })
})
