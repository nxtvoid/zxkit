import { describe, expect, it, vi } from 'vitest'
import { memoryCache } from './memory'

describe('memoryCache', () => {
  it('expires values by ttl', async () => {
    vi.useFakeTimers()
    const cache = memoryCache({ ttl: 1 })

    await cache.set('key', { ok: true })
    await expect(cache.get('key')).resolves.toEqual({ ok: true })

    vi.advanceTimersByTime(1001)

    await expect(cache.get('key')).resolves.toBeNull()
    vi.useRealTimers()
  })

  it('deletes many keys and clears namespaces', async () => {
    const cache = memoryCache()

    await cache.set('authz:user:1:snapshot', 1)
    await cache.set('authz:user:2:snapshot', 2)
    await cache.set('other', 3)
    await cache.deleteMany?.(['authz:user:1:snapshot'])

    await expect(cache.get('authz:user:1:snapshot')).resolves.toBeNull()
    await expect(cache.get('authz:user:2:snapshot')).resolves.toBe(2)

    await cache.clearNamespace?.('authz:user:')

    await expect(cache.get('authz:user:2:snapshot')).resolves.toBeNull()
    await expect(cache.get('other')).resolves.toBe(3)
  })
})
