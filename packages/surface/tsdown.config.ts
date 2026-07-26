import { defineConfig } from 'tsdown'

export default defineConfig({
  // Two independent entries: the root is agnostic of both dialog primitives and
  // form libraries, and the react-hook-form integration lives behind its own
  // subpath so consumers only pull the peers they actually use.
  entry: ['./src/index.ts', './src/react-hook-form.ts'],
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
