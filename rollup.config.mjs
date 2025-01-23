import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default [
  // Main translation script
  {
    input: 'src/translate-content.mjs',
    output: {
      file: 'dist/translate-content.mjs',
      format: 'es',
      sourcemap: true
    },
    external: [
      'chalk',
      'contentful-management',
      'deepl-node',
      'dotenv',
      'fs',
      'inquirer',
      'path',
      'url'
    ],
    plugins: [
      nodeResolve(),
      commonjs(),
      terser()
    ]
  },
  // Binary script
  {
    input: 'bin/translate.mjs',
    output: {
      file: 'dist/bin/translate.mjs',
      format: 'es',
      sourcemap: true,
      banner: '#!/usr/bin/env node'
    },
    external: [
      'chalk',
      'fs',
      'path',
      'url'
    ],
    plugins: [
      nodeResolve(),
      commonjs(),
      terser()
    ]
  }
]; 