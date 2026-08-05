import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  copy: [
    { from: 'src/styles/noti.css', to: 'dist/styles' },
    { from: 'src/styles/tokens.css', to: 'dist/styles' },
  ],
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
