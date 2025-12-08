<h1 align="center">@zxkit/forge</h1>

<p align="center">
  CLI for adding <a href="https://ui.shadcn.com">shadcn/ui</a> components to Turborepo monorepos.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zxkit/forge"><img src="https://img.shields.io/npm/v/@zxkit/forge.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@zxkit/forge"><img src="https://img.shields.io/npm/dm/@zxkit/forge.svg" alt="npm downloads" /></a>
  <a href="https://github.com/nxtvoid/zxkit/blob/main/packages/forge/LICENSE"><img src="https://img.shields.io/npm/l/@zxkit/forge.svg" alt="license" /></a>
</p>

---

## Features

- 🏗️ **Monorepo-first** - Designed specifically for Turborepo monorepos
- 📦 **Automatic setup** - Creates and configures `packages/ui` structure
- ✨ **Always up-to-date** - Uses official shadcn CLI under the hood
- 📝 **Auto exports** - Automatically updates `index.ts` barrel exports
- 🔗 **Dependency resolution** - Installs component dependencies in the right place
- 🎨 **Import transformation** - Transforms imports to use your package scope
- ⚡ **Fast** - Uses your existing package manager (bun, pnpm, npm, yarn)

## Installation

```bash
# Run directly with bunx (recommended)
bunx --bun @zxkit/forge@latest init

# Or install globally
npm install -g @zxkit/forge
```

## Prerequisites

Before using forge, make sure you have:

1. A **Turborepo** monorepo (with `turbo.json` in root)
2. **shadcn/ui initialized** - Run `bunx --bun shadcn@latest init` first

## Usage

### Initialize

Set up the UI package structure in your monorepo:

```bash
bunx --bun @zxkit/forge@latest init
```

This will:

- Detect your project name and create `@<name>/ui` package
- Configure `packages/ui` with proper exports
- Update `components.json` with correct aliases
- Update imports in your apps to use the barrel export

### Add Components

Add components using the official shadcn CLI:

```bash
# Add a single component
bunx --bun @zxkit/forge@latest add button

# Add multiple components
bunx --bun @zxkit/forge@latest add button dialog card

# Overwrite existing components
bunx --bun @zxkit/forge@latest add button --overwrite
```

**How it works:**

1. Runs `bunx --bun shadcn@latest add <component>` in `packages/ui`
2. Captures and processes the files created by shadcn
3. Transforms imports from `@/` to your package scope (`@your-scope/ui`)
4. Updates barrel exports in `index.ts`

This ensures you always get the **latest component versions** directly from shadcn!

Components are installed to `packages/ui/src/components/` with:

- Dependencies installed in `packages/ui`
- Imports transformed to use your package scope
- Barrel exports automatically updated

## Project Structure

After initialization, your monorepo will have:

```
your-monorepo/
├── apps/
│   └── web/
│       └── ... (imports from @your-scope/ui)
├── packages/
│   └── ui/
│       ├── src/
│       │   ├── components/
│       │   │   ├── button.tsx
│       │   │   └── ...
│       │   ├── hooks/
│       │   ├── lib/
│       │   │   └── utils.ts
│       │   ├── styles/
│       │   │   └── globals.css
│       │   └── index.ts (barrel exports)
│       ├── components.json
│       ├── package.json
│       └── tsconfig.json
├── turbo.json
└── package.json
```

## Importing Components

After setup, import components in your apps:

```tsx
// Simple barrel import
import { Button, Card, Dialog } from '@your-scope/ui'

// Or specific imports (also works)
import { Button } from '@your-scope/ui/components/button'
```

## Commands

### `forge init`

Initialize/configure the UI package structure.

```bash
forge init
```

**What it does:**

- Detects Turborepo monorepo
- Reads project name from root `package.json`
- Creates/configures `packages/ui`
- Updates `components.json` aliases
- Updates app imports to use barrel exports

### `forge add [components...]`

Add components from the shadcn registry.

```bash
forge add <component> [component...] [options]
```

**Options:**

- `-o, --overwrite` - Overwrite existing files
- `-y, --yes` - Skip confirmation prompts

**Examples:**

```bash
forge add button
forge add button card dialog
forge add button --overwrite
```

## Configuration

Forge reads configuration from `components.json` in `packages/ui`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "tailwind": {
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@your-scope/ui/components",
    "utils": "@your-scope/ui/lib/utils",
    "hooks": "@your-scope/ui/hooks",
    "lib": "@your-scope/ui/lib"
  }
}
```

## Supported Package Managers

Forge automatically detects and uses your package manager:

- **bun** (recommended)
- **pnpm**
- **yarn**
- **npm**

## Requirements

- Node.js >= 20
- Turborepo monorepo
- shadcn/ui initialized (`bunx --bun shadcn@latest init`)

## License

MIT © [nxtvoid](https://github.com/nxtvoid)
