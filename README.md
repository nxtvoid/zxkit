# zxkit

A collection of React components and utilities for building modern web applications.

## Packages

| Package                          | Description                     |
| -------------------------------- | ------------------------------- |
| [`@zxkit/qrix`](./packages/qrix) | QR code generator for React     |
| [`@workspace/ui`](./packages/ui) | Shared UI components (internal) |

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
