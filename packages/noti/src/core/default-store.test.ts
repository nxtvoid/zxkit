import { afterEach, describe, expect, it, vi } from 'vitest'

// A previous store may still hold a retired modal session.
const defaultStoreKey = Symbol.for('@zxkit/noti/default-store/v4')
const legacyStoreKey = Symbol.for('@zxkit/noti/default-store/v3')
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
