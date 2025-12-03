# Changelog

## 1.0.0

### Major Changes

- Initial release of `@zxkit/forge` - CLI for adding shadcn/ui components to Turborepo monorepos.

### Features

- `init` command - Initialize/configure UI package structure in Turborepo monorepos
  - Detects project name from root `package.json`
  - Creates `@<scope>/ui` package with proper structure
  - Configures `components.json` with correct aliases
  - Updates imports in apps to use barrel exports
  - Generates `index.ts` with ESM-compatible exports (`.js` extensions)
- `add` command - Add components from shadcn registry
  - Fetches components from official shadcn registry
  - Resolves and installs registry dependencies automatically
  - Transforms import paths to use package scope
  - Installs npm dependencies in `packages/ui`
  - Auto-updates barrel exports in `index.ts`
  - Supports `--overwrite` flag for existing components
- Automatic package manager detection (bun, pnpm, yarn, npm)
- Support for both `default` and `new-york` shadcn styles
