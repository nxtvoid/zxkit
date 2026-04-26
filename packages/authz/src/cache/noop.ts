import type { AuthzCache } from '../core/types'

export function createNoopCache(): AuthzCache {
  return {
    get: async () => null,
    set: async () => {},
    delete: async () => {},
    deleteMany: async () => {},
    clearNamespace: async () => {},
  }
}
