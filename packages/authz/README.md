<p align="center">
  <img src="https://raw.githubusercontent.com/nxtvoid/zxkit/main/packages/authz/github.png" alt="authz banner" width="100%" />
</p>

<h1 align="center">@zxkit/authz</h1>

<p align="center">
  Typed authorization for roles, permissions, guards, route access, and cache-aware server checks.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zxkit/authz"><img src="https://img.shields.io/npm/v/@zxkit/authz.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@zxkit/authz"><img src="https://img.shields.io/npm/dm/@zxkit/authz.svg" alt="npm downloads" /></a>
  <a href="https://www.npmjs.com/package/@zxkit/authz"><img src="https://img.shields.io/npm/l/@zxkit/authz.svg" alt="license" /></a>
</p>

---

## Features

- 🔐 **Typed permissions** - Define your permission catalog once and get TypeScript autocomplete everywhere
- 🧩 **Role-based access** - Store roles in your database and merge their permissions into user snapshots
- 🛡️ **Server guards** - Use `can`, `require`, `protect`, `protectRole`, and `protectAuth` in server code
- ⚛️ **React helpers** - Render `AuthzProvider`, `Can`, `Guard`, `Role`, and typed hooks in client components
- 🧭 **Route access** - Share route definitions between menus, guards, and server checks
- 🧱 **Navigation helpers** - Define typed navigation trees with custom metadata and filter them from the current snapshot
- 🚦 **Next.js proxy** - Protect routes before rendering with role and permission rules
- 🗄️ **Prisma adapter** - Drop in the included Prisma adapter or bring your own storage adapter
- ⚡ **Memory and Redis cache** - Cache authorization snapshots and invalidate affected users after mutations
- 🤖 **AI skill generator** - Generate `.agents/skills/authz/SKILL.md` so coding agents know how to use the package

## Installation

```bash
npm install @zxkit/authz
# or
yarn add @zxkit/authz
# or
pnpm add @zxkit/authz
# or
bun add @zxkit/authz
```

Optional packages depend on your setup:

```bash
npm install @prisma/client
npm install @upstash/redis
```

## Usage

### Define Permissions

Keep the permission catalog in code. This is the source of truth that powers type inference for server and client helpers.

```ts
import { definePermissions } from '@zxkit/authz'

export const permissions = definePermissions({
  order: ['read', 'create', 'update', 'delete'],
  invoice: ['read', 'export'],
  settings: ['manage'],
})
```

### Add Prisma Models

Store roles and user-role assignments in your database. Permissions are kept as JSON so each role can contain any subset of your permission catalog.

```prisma
model AuthzRole {
  id          String   @id @default(cuid())
  name        String   @unique
  label       String?
  description String?
  permissions Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users AuthzUserRole[]
}

model AuthzUserRole {
  userId    String
  roleId    String
  createdAt DateTime @default(now())

  role AuthzRole @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@index([roleId])
}
```

### Create The Server Helper

`createAuthz` needs your permission catalog, a session resolver, a storage adapter, and optionally a cache.

```ts
import { headers } from 'next/headers'
import { createAuthz, memoryCache } from '@zxkit/authz'
import { prismaAuthzAdapter } from '@zxkit/authz/prisma'
import { auth } from './auth'
import { db } from './db'
import { permissions } from './permissions'

export const authz = createAuthz({
  permissions,
  getSession: async () => {
    return auth.api.getSession({ headers: await headers() })
  },
  adapter: prismaAuthzAdapter(db),
  cache: memoryCache({ ttl: 60 }),
})
```

### Protect Server Work

Use server guards in server actions, route handlers, API handlers, or server components.

```ts
export const deleteOrder = authz.protect(
  { order: ['delete'] },
  async ({ user }, orderId: string) => {
    return { deletedBy: user.id, orderId }
  }
)
```

```ts
await authz.require({ settings: ['manage'] })
await authz.requireRole(['admin', 'billing_manager'], { match: 'any' })

const snapshot = await authz.getSnapshot()
const canExportInvoices = await authz.can({ invoice: ['export'] })
```

### Manage Roles

Role creation returns a controlled result, so duplicate role names do not leak database errors.

```ts
const created = await authz.createRole({
  name: 'orders_manager',
  label: 'Orders manager',
  permissions: { order: ['read', 'update'] },
})

if (created.success && created.role) {
  await authz.assignRole({
    userId: user.id,
    roleId: created.role.id,
  })
}
```

`assignRole` invalidates the assigned user's cached snapshot. `updateRole` and `deleteRole` invalidate affected users too.

### Create Typed Client Helpers

Create your own local client entrypoint from the same permission catalog. The file that calls `createAuthzClient(permissions)` must include `'use client'`.

```ts
'use client'

import { createAuthzClient } from '@zxkit/authz/client'
import { permissions } from './permissions'

export const authzClient = createAuthzClient(permissions)

export const {
  AuthzProvider,
  Can,
  Guard,
  Role,
  useAllowedNavigation,
  useAllowedRoutes,
  useCan,
  useHasRole,
  useRoles,
} = authzClient
```

Import `Can`, `Guard`, and hooks from this local file, not directly from `@zxkit/authz/client`. That gives TypeScript enough context to autocomplete resources like `order`, `invoice`, and `settings`, plus their valid actions.

### Render The Provider

Load the current authorization snapshot on the server and pass it into the client provider.

```tsx
import type { ReactNode } from 'react'
import { AuthzProvider } from './authz-client'
import { authz } from './authz'

export default async function Layout({ children }: { children: ReactNode }) {
  const snapshot = await authz.getSnapshot()

  return <AuthzProvider snapshot={snapshot}>{children}</AuthzProvider>
}
```

### Check Permissions In React

`Can`, `Role`, `Guard`, and route hooks read from the provider snapshot. They do not fetch on their own.

```tsx
'use client'

import { Can, useCan } from './authz-client'

export function DeleteOrderButton() {
  const canDeleteOrders = useCan({ order: ['delete'] })

  return (
    <Can permissions={{ order: ['delete'] }} fallback={<span>Not allowed</span>}>
      <button disabled={!canDeleteOrders}>Delete order</button>
    </Can>
  )
}
```

### Define Routes

Define routes once and reuse them in sidebars, menus, guards, navigation trees, and server checks.

```ts
import { defineRoutes } from '@zxkit/authz'

export const routes = defineRoutes({
  orders: {
    path: '/orders',
    label: 'Orders',
    permissions: { order: ['read'] },
  },
  settings: {
    path: '/settings',
    label: 'Settings',
    permissions: { settings: ['manage'] },
    roles: ['admin', 'owner'],
    match: 'any',
  },
})
```

`defineRoutes` intentionally does not accept UI-only fields such as `exact`; put active matching behavior on `defineNavigation` nodes instead.

### Define Navigation

Use `defineNavigation(routes, areas)` when your app has navigation trees with icons, groups, sidebar areas, menus, active-match flags, or other UI metadata. The package only understands `route` and `children`; everything else is your metadata and is preserved. Route nodes reference route keys, so TypeScript catches typos like `route: 'settngs'`.

```ts
import { defineNavigation } from '@zxkit/authz'
import { FileTextIcon, SettingsIcon, ShoppingBasketIcon } from 'lucide-react'
import { routes } from './routes'

export const navigation = defineNavigation(routes, {
  default: {
    direction: 'left',
    children: [
      {
        name: 'General',
        children: [
          { route: 'orders', icon: ShoppingBasketIcon, exact: true },
          { route: 'settings', icon: SettingsIcon, exact: true },
        ],
      },
    ],
  },
  docs: {
    direction: 'right',
    children: [
      {
        name: 'Docs',
        children: [{ route: 'orders', icon: FileTextIcon }],
      },
    ],
  },
})
```

Use the typed client hook to filter by the current `AuthzProvider` snapshot. It filters route nodes, removes empty child groups, keeps top-level areas stable, and materializes allowed route nodes with route data such as `path`, `href`, and `label`, plus UI metadata such as `exact`. Common UI fields such as `title`, `backHref`, `name`, `exact`, and `rightContent` are exposed as optional properties, so heterogeneous navigation trees can be mapped without type guards.

```tsx
'use client'

import Link from 'next/link'
import { useAllowedNavigation } from './authz-client'
import { navigation } from './navigation'

export function Sidebar() {
  const areas = useAllowedNavigation(navigation)

  return areas.default.children.map((group) => (
    <div key={group.name}>
      {group.children.map((item) => (
        <Link key={item.href} href={item.href}>
          <item.icon />
          {item.label as string}
        </Link>
      ))}
    </div>
  ))
}
```

```tsx
'use client'

import Link from 'next/link'
import { useAllowedRoutes } from './authz-client'
import { routes } from './routes'

export function Sidebar() {
  const items = useAllowedRoutes(routes)

  return items.map((item) => (
    <Link key={item.path} href={item.path}>
      {item.label as string}
    </Link>
  ))
}
```

### Protect Next.js Routes

Use `createAuthzProxy` to protect routes before rendering. The route-aware API lets you describe public, guest-only, and protected areas without hand-writing proxy rules for every route.

```ts
import { createAuthzProxy } from '@zxkit/authz/next'
import { authz } from './authz'
import { routes } from './routes'

export const proxy = createAuthzProxy({
  authz,
  auth: {
    signIn: '/login',
    afterSignIn: '/hub',
    forbidden: '/hub',
  },
  public: ['/'],
  guestOnly: ['/login'],
  protected: [
    {
      matcher: '/hub/:path*',
      routes,
    },
  ],
})
```

`public` routes always pass. `guestOnly` routes pass only without a session and redirect signed-in users to `auth.afterSignIn`. Every `protected` area requires a session. When `routes` is provided, each route path is protected automatically, including nested paths such as `/hub/sales/:path*`.

Routes with `permissions` or `roles` require those permissions or roles. Multiple roles default to `match: 'all'`; set `match: 'any'` on the route when any listed role should pass. Routes without requirements are auth-only. Unknown paths inside a protected area are denied by default, so adding `/hub/admin` without adding it to `defineRoutes` does not silently make it public.

`auth.forbidden` and `auth.afterSignIn` are validated when they point inside a protected area. They must resolve to an auth-only route, not a route that can deny permissions again.

### Use Redis Cache

Cache is optional and pluggable. Use memory cache for local development and Redis for production deployments with multiple instances.

```ts
import { Redis } from '@upstash/redis'
import { createAuthz, redisCache } from '@zxkit/authz'

const redis = Redis.fromEnv()

export const authz = createAuthz({
  permissions,
  getSession,
  adapter,
  cache: redisCache(redis, {
    ttl: 60 * 30,
  }),
})
```

TTL values are in seconds. If you pass `cacheTtl` to `createAuthz`, that explicit value overrides the cache helper TTL for snapshot writes.

Session expiration does not delete a cached snapshot by itself. This is not used as authentication: `getSnapshot()`, `can()`, `require()`, and proxy checks resolve the current session before reading Redis, so an expired session cannot be authorized from a cached `authz:user:<userId>:snapshot` value. Keep a TTL on Redis anyway so old snapshots from users who never come back are cleaned up automatically and user metadata in snapshots does not live longer than intended.

With `@upstash/redis`, do not `JSON.parse` manually in a custom cache adapter. Upstash deserializes values by default.

### Generate The AI Skill

Generate a local Codex skill for this package in a consumer project:

```bash
npx @zxkit/authz skill
```

This creates `.agents/skills/authz/SKILL.md` at the project root. Use `--dry-run` to preview the target path, `--force` to overwrite, and `--path <project-root>` to choose another project root. Existing skills are left untouched.

## API Reference

### Core Helpers

| Helper                 | Import path           | Description                                   |
| ---------------------- | --------------------- | --------------------------------------------- |
| `definePermissions`    | `@zxkit/authz`        | Defines the typed permission catalog          |
| `createAuthz`          | `@zxkit/authz`        | Creates server authorization helpers          |
| `createAuthzClient`    | `@zxkit/authz/client` | Creates typed React helpers                   |
| `defineRoutes`         | `@zxkit/authz`        | Defines typed route metadata                  |
| `defineNavigation`     | `@zxkit/authz`        | Defines typed navigation trees from routes    |
| `getAllowedNavigation` | `@zxkit/authz`        | Filters navigation outside React              |
| `memoryCache`          | `@zxkit/authz`        | Creates an in-memory snapshot cache           |
| `redisCache`           | `@zxkit/authz`        | Creates a Redis-backed snapshot cache         |
| `prismaAuthzAdapter`   | `@zxkit/authz/prisma` | Creates the Prisma storage adapter            |
| `createAuthzProxy`     | `@zxkit/authz/next`   | Creates a Next.js proxy route guard           |
| `AccessDeniedError`    | `@zxkit/authz`        | Error thrown by `require` and `protect` calls |
| `createNoopCache`      | `@zxkit/authz`        | Disables cache behavior behind the cache API  |

### Server Methods

| Method              | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `getSession()`      | Returns the current session from your `getSession` callback    |
| `requireAuth()`     | Requires an authenticated session                              |
| `getSnapshot()`     | Returns `{ user, roles, permissions }` for the current user    |
| `can(permissions)`  | Checks whether the current user has every required permission  |
| `require(...)`      | Throws `AccessDeniedError` when permissions are missing        |
| `hasRole(...)`      | Checks whether the current user has required roles             |
| `requireRole(...)`  | Throws `AccessDeniedError` when roles are missing              |
| `canAccessRoute()`  | Checks a route created with `defineRoutes`                     |
| `requireRoute()`    | Requires access to a route created with `defineRoutes`         |
| `protect(...)`      | Wraps a handler with a permission check                        |
| `protectRole(...)`  | Wraps a handler with a role check                              |
| `protectAuth(...)`  | Wraps a handler with an auth-only check                        |
| `listRoles()`       | Lists all stored roles                                         |
| `createRole()`      | Creates a role and returns `{ success, message, role }`        |
| `updateRole()`      | Updates a role and invalidates affected snapshots              |
| `deleteRole()`      | Deletes a role and invalidates affected snapshots              |
| `assignRole()`      | Assigns a role and invalidates that user's snapshot            |
| `removeRole()`      | Removes a role assignment and invalidates that user's snapshot |
| `invalidateUser()`  | Deletes one user's cached snapshot                             |
| `invalidateUsers()` | Deletes multiple user snapshots                                |
| `invalidateRole()`  | Deletes snapshots for users assigned to a role when supported  |

### Client Helpers

| Helper                 | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `AuthzProvider`        | Provides the current authorization snapshot to React       |
| `Can`                  | Renders children when permissions match                    |
| `Guard`                | Renders children when route-style requirements match       |
| `Role`                 | Renders children when roles match                          |
| `useCan`               | Checks typed permissions from the current snapshot         |
| `useAllowedRoutes`     | Filters route definitions by the current snapshot          |
| `useAllowedNavigation` | Filters typed navigation trees by the current snapshot     |
| `useCanAccessRoute`    | Checks one route definition from the current snapshot      |
| `useHasRole`           | Checks roles from the current snapshot                     |
| `useRoles`             | Returns the current role names                             |
| `useAuthzSnapshot`     | Returns the full provider snapshot                         |
| `useAuthzRefresh`      | Updates the provider snapshot when your app gets a new one |

## Permission Matching

Permission checks require every requested resource/action pair. Role checks require all listed roles by default.

```ts
await authz.can({ order: ['read', 'update'] })
await authz.hasRole(['admin', 'billing_manager'])
await authz.hasRole(['admin', 'billing_manager'], { match: 'any' })
```

Wildcards are supported in stored role permissions:

```ts
await authz.createRole({
  name: 'admin',
  permissions: { '*': ['*'] },
})
```

## License

MIT © [nxtvoid](https://github.com/nxtvoid)
