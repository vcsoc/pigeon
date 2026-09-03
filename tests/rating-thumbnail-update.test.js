'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
const between = (start, end) => renderer.slice(renderer.indexOf(start), renderer.indexOf(end));

test('backend acknowledgements of optimistic ratings do not schedule a grid reload', () => {
  const delta = between('function applyMetadataViewDelta', 'async function updateSelected');
  assert.match(delta, /if\(!actual\.length\)return true/);
  const patches = renderer.slice(renderer.indexOf('window.pigeon.onAssetsPatched'));
  assert.match(patches, /applyMetadataViewDelta\(changes,\{reconcileAnyView:true\}\)/);
});

test('single and multi ratings use keyed reconciliation for the current view', () => {
  const single = between('async function updateSelected', 'function patchCardMetadata');
  const multiple = between('async function updateAssetsWithoutGridRefresh', 'let thumbnailEffectMutationRevision');
  for (const source of [single, multiple]) {
    assert.match(source, /previousIndices=\[\.\.\.currentViewIndices\(\)\]/);
    assert.match(source, /reconcileAnyView:true/);
    assert.doesNotMatch(source, /renderGrid\(|scheduleStreamGridRender/);
  }
});
