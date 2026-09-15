'use client'

import { useLayoutEffect, useState } from 'react'
import { createNotiApi, type NotiApi, type NotiScope } from '../client'
import { defaultNotiStore } from '../core/default-store'
import type { NotiStore } from '../core/store'

function createScopedClient(store: NotiStore) {
  const scope: NotiScope = { active: true, id: null }
  const dismiss = createNotiApi(store).dismiss

  return {
    api: createNotiApi(store, scope),
    mount() {
      scope.active = true

      return () => {
        scope.active = false
        const id = scope.id
        scope.id = null
        if (id !== null) dismiss(id)
      }
    },
  }
}

/**
 * The same API as `noti`, owned by this component. Its live notification closes
 * on unmount; other owners' replacements are left alone. Use the module-level
 * `noti` for notifications that should survive the component.
 */
export function useNoti(): NotiApi {
  return useNotiWithStore(defaultNotiStore)
}

/** Internal injection point for tests. The store is fixed for this mount. */
export function useNotiWithStore(store: NotiStore): NotiApi {
  const [client] = useState(() => createScopedClient(store))

  // Retire the scope during the commit, before a late callback can act on a
  // removed view. Setup also restores it for React's effect replay.
  useLayoutEffect(() => client.mount(), [client])

  return client.api
}
