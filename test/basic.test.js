import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('build output exists', async (t) => {
  // Check main file
  const mainExists = fs.existsSync(path.resolve('dist/translate-content.js'));
  assert.equal(mainExists, true, 'Main translation file should exist in dist/');

  // Check binary file
  const binExists = fs.existsSync(path.resolve('dist/bin/translate.js'));
  assert.equal(binExists, true, 'Binary file should exist in dist/bin/');
});

test('binary file has correct permissions', async (t) => {
  const binPath = path.resolve('dist/bin/translate.js');
  const stats = fs.statSync(binPath);
  const isExecutable = (stats.mode & fs.constants.S_IXUSR) !== 0;
  assert.equal(isExecutable, true, 'Binary file should be executable');
}); 