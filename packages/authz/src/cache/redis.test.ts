import { describe, expect, it, vi } from 'vitest'
import { redisCache, type RedisCacheClient } from './redis'

describe('redisCache', () => {
  it('uses Redis JSON values without manual parsing', async () => {
    const get = vi.fn(async (key: string) => ({ ok: key === 'snapshot' }))
    const set = vi.fn(async () => 'OK')
    const del = vi.fn(async () => 1)
    const redis: RedisCacheClient = {
      async get<T>(key: string) {
        return (await get(key)) as T
      },
      set,
      del,
    }
    const cache = redisCache(redis, { ttl: 60 })

    await expect(cache.get('snapshot')).resolves.toEqual({ ok: true })
    await cache.set('snapshot', { ok: true })
    await cache.delete('snapshot')

    expect(get).toHaveBeenCalledWith('snapshot')
    expect(set).toHaveBeenCalledWith('snapshot', { ok: true }, { ex: 60 })
    expect(del).toHaveBeenCalledWith('snapshot')
  })

  it('supports per-write ttl and batched deletes', async () => {
    const redis = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => 'OK'),
      del: vi.fn(async () => 2),
    } satisfies RedisCacheClient
    const cache = redisCache(redis, { ttl: 60 })

    await cache.set('snapshot', { ok: true }, { ttl: 10 })
    await cache.deleteMany?.(['one', 'two'])
    await cache.deleteMany?.([])

    expect(redis.set).toHaveBeenCalledWith('snapshot', { ok: true }, { ex: 10 })
    expect(redis.del).toHaveBeenCalledTimes(1)
    expect(redis.del).toHaveBeenCalledWith('one', 'two')
  })
})
