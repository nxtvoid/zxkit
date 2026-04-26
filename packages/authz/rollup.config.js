import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import preserveDirectives from 'rollup-preserve-directives'
import { dts } from 'rollup-plugin-dts'

const input = {
  index: './src/index.ts',
  cli: './src/cli.ts',
  client: './src/client.tsx',
  server: './src/server.ts',
  react: './src/react.tsx',
  next: './src/next.ts',
  prisma: './src/prisma.ts',
  'core/index': './src/core/index.ts',
  'cache/index': './src/cache/index.ts',
  'adapters/index': './src/adapters/index.ts',
  'adapters/prisma': './src/adapters/prisma.ts',
}

const mainConfig = {
  input,
  output: [
    {
      dir: './dist',
      format: 'esm',
      exports: 'named',
      entryFileNames: '[name].js',
    },
    {
      dir: './dist',
      format: 'cjs',
      interop: 'compat',
      exports: 'named',
      entryFileNames: '[name].cjs',
    },
  ],
  plugins: [
    peerDepsExternal(),
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.build.json',
    }),
    preserveDirectives(),
  ],
  external: ['react', 'react/jsx-runtime', 'next/server', 'node:fs', 'node:path'],
}

const dtsConfig = {
  input,
  output: {
    dir: './dist',
    format: 'es',
    entryFileNames: '[name].d.ts',
  },
  plugins: [dts()],
  external: [/\.css$/],
}

export default [mainConfig, dtsConfig]
