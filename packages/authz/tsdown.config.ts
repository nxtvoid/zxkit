import { defineConfig } from 'tsdown'

const entry = [
  './src/index.ts',
  './src/cli.ts',
  './src/client.tsx',
  './src/server.ts',
  './src/react.tsx',
  './src/next.ts',
  './src/prisma.ts',
  './src/core/index.ts',
  './src/cache/index.ts',
  './src/adapters/index.ts',
  './src/adapters/prisma.ts',
]

const dtsEntry = entry.filter((path) => path !== './src/cli.ts')

export default defineConfig({
  dts: {
    entry: dtsEntry,
    sourcemap: false,
  },
  format: ['esm'],
  entry,
  treeshake: true,
  clean: true,
  sourcemap: false,
  unbundle: true,
  deps: {
    skipNodeModulesBundle: true,
  },
})
