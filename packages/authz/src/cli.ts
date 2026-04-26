#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, parse, resolve } from 'node:path'

const SKILL_CONTENT = `---
name: authz
description: "Use when working with @zxkit/authz in this repository or in a consumer app: setting up Prisma roles and assignments, creating createAuthz server helpers, wiring client snapshots and guards, protecting Next.js routes with createAuthzProxy, seeding test roles, or debugging permissions, roles, cache invalidation, and authorization behavior."
---

# Authz

Use this skill when the task involves the \`@zxkit/authz\` package.

## Operating Rules For Agents

- First inspect the app for existing \`permissions.ts\`, \`authz.ts\`, \`authz-client.ts\`, \`routes.ts\`, Prisma schema, auth helper, db helper, and Redis helper. Extend those files instead of creating duplicate authz setup.
- Keep the permission catalog as the source of truth. Pass the same \`permissions\` object to \`createAuthz({ permissions, ... })\` and \`createAuthzClient(permissions)\`.
- Server setup and client setup are separate files. The server helper must stay server-only; the client helper that calls \`createAuthzClient\` must start with \`'use client'\`.
- Do not import \`Can\`, \`Guard\`, \`AuthzProvider\`, or hooks directly from \`@zxkit/authz/client\` in app code. Import them from the local typed \`authz-client.ts\`.
- Use \`authz.assignRole\`, \`authz.removeRole\`, \`authz.updateRole\`, and \`authz.deleteRole\` for mutations so cache invalidation runs.
- Use \`redisCache(redis, { ttl })\` for Upstash Redis. Do not wrap Upstash values with manual \`JSON.parse\` or \`JSON.stringify\`.

Recommended file layout:

\`\`\`txt
lib/authz/permissions.ts    # definePermissions catalog
lib/authz/authz.ts          # server createAuthz helper
lib/authz/authz-client.ts   # 'use client' createAuthzClient helper
lib/authz/routes.ts         # optional shared route requirements
prisma/schema.prisma        # AuthzRole and AuthzUserRole models
\`\`\`

## Core Model

\`@zxkit/authz\` assumes authentication already exists. Authentication identifies the user; authz decides what that user can do.

Keep the permission catalog in code and store roles plus user-role assignments in the database.

Permissions are shaped as:

\`\`\`ts
{ resource: ['action'] }
\`\`\`

Wildcards are supported:

\`\`\`ts
{ '*': ['*'] }
{ order: ['*'] }
\`\`\`

Define the catalog once and import it from both server and client setup files.

\`\`\`ts
import { definePermissions } from '@zxkit/authz'

export const permissions = definePermissions({
  order: ['read', 'create', 'update', 'delete'],
  invoice: ['read', 'export'],
  settings: ['manage'],
})
\`\`\`

## Prisma Schema

Use these models, optionally adding a relation from \`AuthzUserRole.userId\` to the existing \`User.id\` model for database integrity. The Prisma adapter expects delegates named \`db.authzRole\` and \`db.authzUserRole\`; if a project uses different model names, write a custom adapter instead.

\`\`\`prisma
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
\`\`\`

If the app has a \`User\` model, prefer:

\`\`\`prisma
authzRoles AuthzUserRole[]
\`\`\`

on \`User\`, and:

\`\`\`prisma
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
\`\`\`

on \`AuthzUserRole\`.

## Server Setup

Create one server helper near the app auth/db setup. Always pass the permission catalog so server checks are typed.

\`\`\`ts
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
\`\`\`

The server helper file should not include \`'use client'\`. It may import server-only APIs such as \`next/headers\`, Better Auth server APIs, Prisma, and Redis.

Use \`authz.protect\`, \`authz.require\`, \`authz.hasRole\`, \`authz.requireRole\`, and \`authz.requireRoute\` in server actions, route handlers, server components, and proxy code.

\`\`\`ts
export const deleteOrder = authz.protect(
  { order: ['delete'] },
  async ({ user }, orderId: string) => {
    return { deletedBy: user.id, orderId }
  }
)
\`\`\`

Common server operations:

\`\`\`ts
await authz.requireAuth()
await authz.require({ order: ['delete'] })
await authz.requireRole(['admin', 'billing'], { match: 'all' })

const canExportInvoices = await authz.can({ invoice: ['export'] })
const snapshot = await authz.getSnapshot()

const updateSettings = authz.protect(
  { settings: ['manage'] },
  async ({ user }, input: { theme: string }) => {
    return { updatedBy: user.id, input }
  }
)

const adminOnly = authz.protectRole('admin', async ({ user }) => user.id)
const signedInOnly = authz.protectAuth(async ({ user }) => user.id)

const created = await authz.createRole({
  name: 'orders_manager',
  label: 'Orders manager',
  permissions: { order: ['read', 'update'] },
})

if (!created.success || !created.role) {
  return created
}

const assigned = await authz.assignRole({ userId: user.id, roleId: created.role.id })

if (!assigned.success) {
  return assigned
}

await authz.removeRole({ userId: user.id, roleId: created.role.id })
await authz.updateRole(created.role.id, { permissions: { order: ['read'] } })
await authz.deleteRole(created.role.id)
\`\`\`

\`createRole\` returns \`{ success, message, role }\` instead of leaking unique constraint errors. If a role name already exists, \`success\` is \`false\` and \`role\` contains the existing role when it can be found. \`assignRole\` returns \`{ success, message }\` and invalidates the assigned user's cached snapshot.

Use result checks instead of assuming mutations throw:

\`\`\`ts
const created = await authz.createRole({
  name: 'orders_viewer',
  permissions: { order: ['read'] },
})

if (!created.success) {
  return { error: created.message }
}
\`\`\`

## Client Setup

Create typed client helpers from the permission catalog. The file that calls \`createAuthzClient\` must be a client module, usually named \`authz-client.ts\`.

\`\`\`ts
'use client'

import { createAuthzClient } from '@zxkit/authz/client'
import { permissions } from './permissions'

export const authzClient = createAuthzClient(permissions)

export const {
  AuthzProvider,
  Can,
  Guard,
  Role,
  useAuthz,
  useAuthzRefresh,
  useAuthzSnapshot,
  useAllowedRoutes,
  useCan,
  useCanAccessRoute,
  useHasRole,
  useRoles,
} = authzClient
\`\`\`

Do not call \`createAuthzClient(permissions)\` from a Server Component, layout, server action, or route handler. If Next.js throws "Attempted to call createAuthzClient() from the server", add \`'use client'\` to the local \`authz-client.ts\` file or move that factory call into a dedicated client module.

Load one snapshot on the server and pass it into the client provider. Client hooks and guards check the snapshot locally and do not fetch.

\`\`\`tsx
import { AuthzProvider } from './authz-client'
import { authz } from './authz'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const snapshot = await authz.getSnapshot()

  return <AuthzProvider snapshot={snapshot}>{children}</AuthzProvider>
}
\`\`\`

The provider snapshot is a client-side value. After a server mutation that changes roles, refresh the route or call the provider \`refresh\` flow so already-rendered client guards see the new snapshot.

Client components must use \`'use client'\`.

\`\`\`tsx
'use client'

import { Can, Guard, Role, useCan, useHasRole, useRoles } from './authz-client'

export function DeleteOrderButton() {
  const canDeleteOrders = useCan({ order: ['delete'] })
  const isAdmin = useHasRole('admin')
  const roles = useRoles()

  return (
    <>
      <Can permissions={{ order: ['delete'] }} fallback={<span>No access</span>}>
        <button disabled={!canDeleteOrders}>Delete order</button>
      </Can>

      <Role role='admin'>
        <span>Admin tools: {isAdmin ? roles.join(', ') : null}</span>
      </Role>

      <Guard roles={['admin', 'support']} match='any' permissions={{ invoice: ['read'] }}>
        <a href='/invoices'>Invoices</a>
      </Guard>
    </>
  )
}
\`\`\`

TypeScript autocompletes resources such as \`order\`, \`invoice\`, and \`settings\`, and actions such as \`settings: ['manage']\`.

Invalid resources or actions should be TypeScript errors:

\`\`\`tsx
<Can permissions={{ settings: ['manage'] }} />

// Should fail if the catalog only has settings: ['manage'].
<Can permissions={{ settings: ['delete'] }} />
\`\`\`

## Routes And Proxy

Define shared routes with \`defineRoutes\` when sidebars, guards, and server checks should use the same requirements. Keep permission names from the catalog.

\`\`\`ts
import { defineRoutes } from '@zxkit/authz'

export const routes = defineRoutes({
  orders: {
    path: '/orders',
    label: 'Orders',
    permissions: { order: ['read'] },
  },
  invoices: {
    path: '/invoices',
    label: 'Invoices',
    permissions: { invoice: ['read'] },
  },
  settings: {
    path: '/settings',
    label: 'Settings',
    permissions: { settings: ['manage'] },
    roles: ['admin'],
  },
})
\`\`\`

Use the typed client route hook in client navigation.

\`\`\`tsx
'use client'

import Link from 'next/link'
import { routes } from './routes'
import { useAllowedRoutes } from './authz-client'

export function Sidebar() {
  const items = useAllowedRoutes(routes)

  return items.map((item) => (
    <Link key={item.path} href={item.path}>
      {item.label as string}
    </Link>
  ))
}
\`\`\`

Check the same routes on the server when needed.

\`\`\`ts
import { authz } from './authz'
import { routes } from './routes'

await authz.requireRoute(routes.settings)
\`\`\`

For Next.js proxy, use \`createAuthzProxy\`.

\`\`\`ts
import { createAuthzProxy } from '@zxkit/authz/next'
import { authz } from './authz'

export const proxy = createAuthzProxy({
  authz,
  signInPath: '/login',
  forbiddenPath: '/forbidden',
  rules: [
    { matcher: '/admin/:path*', roles: ['admin'] },
    { matcher: '/billing/:path*', roles: ['admin', 'billing_manager'], match: 'any' },
    { matcher: '/settings/:path*', permissions: { settings: ['manage'] } },
  ],
})
\`\`\`

Multiple roles default to \`match: 'all'\`. Use \`match: 'any'\` only when any listed role should pass.

## Cache And Invalidation

Use \`memoryCache\` for local development and \`redisCache\` for multi-instance production. Mutations made through the authz helper invalidate affected user snapshots.

\`\`\`ts
import { memoryCache } from '@zxkit/authz/cache'

export const authz = createAuthz({
  permissions,
  getSession,
  adapter,
  cache: memoryCache({ ttl: 60 }),
})

await authz.assignRole({ userId, roleId })
await authz.removeRole({ userId, roleId })
await authz.updateRole(roleId, { permissions: { order: ['read'] } })
await authz.deleteRole(roleId)
\`\`\`

Configure TTL on the cache helper. If \`cacheTtl\` is passed to \`createAuthz\`, that explicit value overrides the helper default for snapshot writes.

TTL values are seconds:

\`\`\`ts
redisCache(redis, { ttl: 60 * 30 }) // 30 minutes
\`\`\`

With \`@upstash/redis\`, do not \`JSON.parse\` manually. Upstash deserializes JSON values by default; pass the Redis instance to \`redisCache\`.

\`\`\`ts
import { Redis } from '@upstash/redis'
import { redisCache } from '@zxkit/authz/cache'

const redis = Redis.fromEnv()

export const authz = createAuthz({
  permissions,
  getSession,
  adapter,
  cache: redisCache(redis, { ttl: 60 }),
})
\`\`\`

With Redis/KV, \`assignRole\` deletes \`authz:user:<userId>:snapshot\` through the cache adapter. The next server snapshot read is fresh. If the current browser already has an \`AuthzProvider\` snapshot, call its refresh flow, navigate, or \`router.refresh()\` after the mutation so client-rendered guards see the new snapshot immediately.

For custom Redis/KV clients, pass an object with \`get\`, \`set\`, and \`del\` methods shaped like the Upstash client.

## Seeding For Tests

For fast local testing, create a role and assign it to an existing user.

\`\`\`ts
const admin = await db.authzRole.upsert({
  where: { name: 'admin' },
  update: {
    permissions: { '*': ['*'] },
  },
  create: {
    name: 'admin',
    label: 'Admin',
    permissions: { '*': ['*'] },
  },
})

await db.authzUserRole.upsert({
  where: {
    userId_roleId: {
      userId: user.id,
      roleId: admin.id,
    },
  },
  update: {},
  create: {
    userId: user.id,
    roleId: admin.id,
  },
})
\`\`\`

## Verification

When changing this package, run:

\`\`\`bash
bun run test
bun run check-types
bun run lint
bun run build
\`\`\`

In consumer apps, validate the actual protected flow:

- unauthenticated user redirects or fails as expected
- authenticated user without role is forbidden
- authenticated user with role can access
- role updates/deletes invalidate cached snapshots

## Troubleshooting

- \`createAuthzClient\` server error: the local file that calls \`createAuthzClient(permissions)\` is missing \`'use client'\`.
- Missing TypeScript autocomplete: import \`Can\`, \`Guard\`, and hooks from the local typed \`authz-client.ts\`, not directly from \`@zxkit/authz/client\`.
- Wrong permission accepted by TS: make sure the same \`permissions\` catalog is passed to both \`createAuthz({ permissions, ... })\` and \`createAuthzClient(permissions)\`.
- Stale permission after a role mutation: mutate through \`authz.assignRole\`, \`authz.removeRole\`, \`authz.updateRole\`, or \`authz.deleteRole\` so cache invalidation runs.
- Redis value error such as \`"[object Object]" is not valid JSON\`: remove manual \`JSON.parse\` / \`JSON.stringify\` when using \`@upstash/redis\` defaults, or use \`redisCache(redis, { ttl })\`.
- Redis TTL always 60 seconds: remove unintended \`cacheTtl: 60\` from \`createAuthz\`, or set \`cacheTtl\` to the intended value. Prefer configuring TTL on \`redisCache(redis, { ttl })\`.
- Prisma unique constraint when creating roles: use the \`createRole\` result object and handle \`success: false\`; do not rely on raw database errors.
- UI still shows old permissions after assignment: server cache is invalidated, but an already-mounted \`AuthzProvider\` needs a route refresh, navigation, or custom provider refresh.
`

type ParsedArgs = {
  command?: string
  dryRun: boolean
  force: boolean
  root: string
}

function hasWorkspacePackageJson(directory: string) {
  const packageJsonPath = resolve(directory, 'package.json')

  if (!existsSync(packageJsonPath)) {
    return false
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      workspaces?: unknown
    }

    return Array.isArray(packageJson.workspaces) || typeof packageJson.workspaces === 'object'
  } catch {
    return false
  }
}

function findProjectRoot(start: string) {
  let current = resolve(start)
  let nearestPackageRoot: string | null = null
  const filesystemRoot = parse(current).root

  while (true) {
    if (existsSync(resolve(current, 'package.json')) && !nearestPackageRoot) {
      nearestPackageRoot = current
    }

    if (
      existsSync(resolve(current, '.git')) ||
      hasWorkspacePackageJson(current) ||
      existsSync(resolve(current, 'pnpm-workspace.yaml')) ||
      existsSync(resolve(current, 'turbo.json'))
    ) {
      return current
    }

    if (current === filesystemRoot) {
      return nearestPackageRoot ?? start
    }

    current = dirname(current)
  }
}

function readValue(args: string[], index: number, flag: string) {
  const value = args[index + 1]

  if (!value || value.startsWith('-')) {
    throw new Error(`${flag} requires a value.`)
  }

  return value
}

function parseArgs(args: string[]): ParsedArgs {
  let command: string | undefined
  let root = findProjectRoot(process.cwd())
  let dryRun = false
  let force = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      dryRun = true
      continue
    }

    if (arg === '--force') {
      force = true
      continue
    }

    if (arg === '--path' || arg === '--cwd') {
      root = findProjectRoot(readValue(args, index, arg))
      index += 1
      continue
    }

    if (arg === '--help' || arg === '-h') {
      command = 'help'
      continue
    }

    if (!command) {
      command = arg
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return { command, dryRun, force, root }
}

function printHelp() {
  console.log(`Usage:
  npx @zxkit/authz skill [--path <project-root>] [--force] [--dry-run]

Commands:
  skill      Create .agents/skills/authz/SKILL.md

Options:
  --path     Directory to search from before creating .agents/skills/authz/SKILL.md at the project root
  --force    Overwrite an existing skill file
  --dry-run  Print the target path without writing files
  --help     Show this help message`)
}

function createSkill({ dryRun, force, root }: ParsedArgs) {
  const target = resolve(root, '.agents', 'skills', 'authz', 'SKILL.md')

  if (dryRun) {
    console.log(`Would create ${target}`)
    return
  }

  if (existsSync(target) && !force) {
    throw new Error(`${target} already exists. Re-run with --force to overwrite.`)
  }

  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, SKILL_CONTENT)

  console.log(`Created ${target}`)
}

try {
  const args = parseArgs(process.argv.slice(2))

  if (!args.command || args.command === 'help') {
    printHelp()
    process.exit(0)
  }

  if (args.command !== 'skill') {
    throw new Error(`Unknown command: ${args.command}`)
  }

  createSkill(args)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
