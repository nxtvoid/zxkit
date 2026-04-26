import type { AuthzCache } from '../core/types'

export function memoryCache(options?: { ttl?: number }): AuthzCache {
  const store = new Map<string, { value: unknown; expiresAt: number | null }>()

  function isExpired(entry: { expiresAt: number | null }) {
    return entry.expiresAt != null && entry.expiresAt <= Date.now()
  }

  return {
    async get<T>(key: string) {
      const entry = store.get(key)

      if (!entry) {
        return null
      }

      if (isExpired(entry)) {
        store.delete(key)
        return null
      }

      return entry.value as T
    },
    async set<T>(key: string, value: T, setOptions?: { ttl?: number }) {
      const ttl = setOptions?.ttl ?? options?.ttl
      store.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : null,
      })
    },
    async delete(key: string) {
      store.delete(key)
    },
    async deleteMany(keys: string[]) {
      for (const key of keys) {
        store.delete(key)
      }
    },
    async clearNamespace(namespace: string) {
      for (const key of store.keys()) {
        if (key.startsWith(namespace)) {
          store.delete(key)
        }
      }
    },
  }
}
