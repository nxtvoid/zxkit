import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: {
    sourcemap: false,
  },
  format: ['esm'],
  entry: ['./src/index.ts'],
  treeshake: true,
  clean: true,
  sourcemap: false,
  unbundle: true,
  deps: {
    skipNodeModulesBundle: true,
  },
})
