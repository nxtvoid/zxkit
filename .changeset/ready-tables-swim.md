---
'@zxkit/forge': major
---

Initial release of @zxkit/forge - CLI for adding shadcn/ui components to Turborepo monorepos.

### Features

- `init` command - Initialize/configure UI package structure
- `add` command - Add components from shadcn registry
- Automatic package manager detection (bun, pnpm, yarn, npm)
- Import path transformation to use package scope
- Auto-generated barrel exports with ESM-compatible `.js` extensions
- Registry dependency resolution
