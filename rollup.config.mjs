import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import fs from 'fs';
import path from 'path';

// Plugin to set executable permissions
const executableBinary = () => ({
  name: 'executable-binary',
  writeBundle(options) {
    if (options.file && options.file.includes('bin')) {
      fs.chmodSync(options.file, '755');
    }
  }
});

export default [
  // Main translation script
  {
    input: 'src/translate-content.mjs',
    output: {
      file: 'dist/translate-content.js',
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
      json()
    ]
  },
  // Binary script
  {
    input: 'bin/translate.mjs',
    output: {
      file: 'dist/bin/translate.js',
      format: 'es',
      sourcemap: true
    },
    external: [
      'chalk',
      'fs',
      'path',
      'url',
      'contentful-translator/dist/translate-content.js'
    ],
    plugins: [
      nodeResolve(),
      commonjs(),
      json(),
      executableBinary(),
      {
        name: 'shebang',
        renderChunk(code) {
          return '#!/usr/bin/env node\n' + code.replace('#!/usr/bin/env node\n', '');
        }
      }
    ]
  }
]; 