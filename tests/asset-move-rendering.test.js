'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

test('file moves reconcile keyed cards without refreshing the thumbnail grid', () => {
  const helper = renderer.match(/function applyAssetMutationVisibility[\s\S]*?\nfunction stageDuplicatedAssetCard/)?.[0] || '';
  assert.match(helper, /previousIndices=reconcile\?\[\.\.\.currentViewIndices\(\)\]:null/);
  assert.match(helper, /applyMetadataViewDelta\(changes,\{previousIndices,reconcileAnyView:true\}\)/);
  assert.match(helper, /if\(!deltaHandled\)reconcileThumbnailCards/);
  assert.doesNotMatch(helper, /renderGrid\(/);
});

test('keyed move reconciliation retains unaffected thumbnail nodes and cancels only removed cards', () => {
  const reconcile = renderer.match(/function reconcileActiveSmartFolderMetadataDelta[\s\S]*?\nfunction applyMetadataViewDelta/)?.[0] || '';
  assert.match(reconcile, /!state\.smartFolderId&&!reconcileAnyView/);
  assert.match(reconcile, /let card=existingById\.get\(asset\.id\)/);
  assert.match(reconcile, /activeThumbnailLoads\.get\(card\)\?\.cancel\(\);card\.remove\(\)/);
  assert.doesNotMatch(reconcile, /innerHTML/);
});
