# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-12-02

### Added

- Initial release of `@zxkit/forge`
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
