# zxkit

A collection of React components, utilities, and tooling for building modern web applications.

## Packages

| Package                                | Description                                                      |
| -------------------------------------- | ---------------------------------------------------------------- |
| [`@zxkit/authz`](./packages/authz)     | Storage-agnostic roles, permissions, guards, and Next.js helpers |
| [`@zxkit/qrix`](./packages/qrix)       | QR code generator for React                                      |
| [`@zxkit/surface`](./packages/surface) | Dialog, sheet, and drawer helpers for React                      |

## Internal Packages

| Package                                                        | Description                     |
| -------------------------------------------------------------- | ------------------------------- |
| [`@workspace/eslint-config`](./packages/eslint-config)         | Shared ESLint configuration     |
| [`@workspace/typescript-config`](./packages/typescript-config) | Shared TypeScript configuration |
| [`@zxkit/ui`](./packages/ui)                                   | Shared UI components            |

## Getting Started

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Build all packages
bun build
```

## Scripts

| Command            | Description                  |
| ------------------ | ---------------------------- |
| `bun dev`          | Start development server     |
| `bun build`        | Build all packages           |
| `bun lint`         | Run ESLint                   |
| `bun check`        | Run TypeScript type checking |
| `bun format`       | Format code with Prettier    |
| `bun format:check` | Check code formatting        |

## Tech Stack

- **Monorepo**: Turborepo + Bun workspaces
- **Framework**: Next.js 16
- **Styling**: Tailwind CSS v4
- **Components**: Radix UI
- **Language**: TypeScript

## License

MIT
