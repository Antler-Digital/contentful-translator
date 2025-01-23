import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default [
  // Main translation script
  {
    input: 'src/translate-content.mjs',
    output: {
      dir: 'dist',
      format: 'es',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src'
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
      json()
    ]
  },
  // Binary script
  {
    input: 'bin/translate.mjs',
    output: {
      dir: 'dist/bin',
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
      json()
    ]
  }
]; 