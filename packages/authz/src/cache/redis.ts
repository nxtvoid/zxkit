import type { AuthzCache, Awaitable } from '../core/types'

export type RedisCacheClient = {
  get: <T = unknown>(key: string) => Awaitable<T | null | undefined>
  set: <T = unknown>(key: string, value: T, options?: { ex: number }) => Awaitable<unknown>
  del: (...keys: string[]) => Awaitable<unknown>
}

export type RedisCacheOptions = {
  ttl?: number
}

export function redisCache(redis: RedisCacheClient, options?: RedisCacheOptions): AuthzCache {
  return {
    async get<T>(key: string) {
      return (await redis.get<T>(key)) ?? null
    },
    async set<T>(key: string, value: T, setOptions?: { ttl?: number }) {
      const ttl = setOptions?.ttl ?? options?.ttl

      if (ttl) {
        await redis.set(key, value, { ex: ttl })
        return
      }

      await redis.set(key, value)
    },
    async delete(key: string) {
      await redis.del(key)
    },
    async deleteMany(keys: string[]) {
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    },
  }
}
