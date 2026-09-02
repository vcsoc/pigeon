'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const preparationSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'prepare-mac-universal.js'), 'utf8');

test('macOS universal preparation merges every architecture-specific native dependency', () => {
  assert.match(preparationSource, /async function universalizePair/);
  assert.match(preparationSource, /lipo', \['-create', arm64Path, x64Path/);
  assert.match(preparationSource, /sharp-darwin-arm64/);
  assert.match(preparationSource, /sharp-libvips-darwin-arm64/);
  assert.match(preparationSource, /canvas-darwin-arm64/);
  assert.match(preparationSource, /await prepareNativeLibraries\(temporaryDirectory\)/);
  assert.match(preparationSource, /architectures\.join\(' '\) !== 'arm64 x86_64'/);
});
