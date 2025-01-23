import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import fs from 'fs';
import path from 'path';

// Plugin to set executable permissions
const executableBinary = () => ({
  name: 'executable-binary',
  writeBundle(options) {
    if (options.dir?.includes('bin')) {
      const binPath = path.join(options.dir, 'translate.mjs');
      fs.chmodSync(binPath, '755');
    }
  }
});

export default [
  // Main translation script
  {
    input: 'src/translate-content.mjs',
    output: {
      dir: 'dist',
      format: 'es',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].mjs'
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
      entryFileNames: 'translate.mjs',
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
      json(),
      executableBinary()
    ]
  }
]; 