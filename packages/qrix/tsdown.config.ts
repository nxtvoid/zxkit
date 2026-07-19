import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm'],
  dts: {
    sourcemap: false,
  },
  treeshake: true,
  clean: true,
  sourcemap: false,
  unbundle: true,
  deps: {
    skipNodeModulesBundle: true,
  },
})
