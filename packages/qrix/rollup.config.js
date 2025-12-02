import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import preserveDirectives from 'rollup-preserve-directives'
import { dts } from 'rollup-plugin-dts'

const isWatch = process.env.ROLLUP_WATCH === 'true'

const mainConfig = {
  input: './src/index.ts',
  output: [
    {
      file: './dist/index.cjs',
      format: 'cjs',
      interop: 'compat',
      exports: 'named',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    {
      file: './dist/index.js',
      format: 'esm',
      exports: 'named',
      sourcemap: true,
      inlineDynamicImports: true,
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
  external: ['react', 'react/jsx-runtime'],
}

const dtsConfig = {
  input: './dist/index.d.ts',
  output: [
    { file: './dist/index.d.ts', format: 'es' },
    { file: './dist/index.d.cts', format: 'cjs' },
  ],
  plugins: [dts()],
  external: [/\.css$/],
}

export default isWatch ? mainConfig : [mainConfig, dtsConfig]
