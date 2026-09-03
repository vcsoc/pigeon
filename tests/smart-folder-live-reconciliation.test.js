'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
const between = (start, end) => renderer.slice(renderer.indexOf(start), renderer.indexOf(end));

test('Smart Folder changes leave unaffected thumbnail DOM nodes in place', () => {
  const reconcile = between('function reconcileActiveSmartFolderMetadataDelta', 'function applyMetadataViewDelta');
  assert.match(reconcile, /let cursor=host\.firstElementChild/);
  assert.match(reconcile, /if\(card!==cursor\)host\.insertBefore\(card,cursor\)/);
  assert.match(reconcile, /cursor=card\.nextElementSibling/);
  assert.doesNotMatch(reconcile, /host\.appendChild\(card\)|replaceChildren|innerHTML/);
});

test('tag exclusions use changed-asset reconciliation instead of a grid render', () => {
  const tags = between('function applyTagsToAssetsOptimistically', 'async function addTagsToAssets');
  assert.match(tags, /previousIndices=reconcileActive\?\[\.\.\.currentViewIndices\(\)\]:null/);
  assert.match(tags, /applyMetadataViewDelta\(changes,\{previousIndices,reconcileActive\}\)/);
  assert.doesNotMatch(tags, /renderGrid|reconcileThumbnailCards/);
});

test('removed multi-selection advances to a centered surviving thumbnail', () => {
  const reconcile = between('function reconcileActiveSmartFolderMetadataDelta', 'function applyMetadataViewDelta');
  const selection = between('function selectSuccessorWithoutScrolling', 'function reconcileThumbnailCards');
  const focus = between('function focusSelectedAsset', 'function navigateAssets');
  assert.match(reconcile, /selectedWasRemoved=result\.removedIds\.includes\(state\.selectedId\)/);
  assert.match(reconcile, /selectedWasRemoved&&selection\.focusId/);
  assert.match(reconcile, /focusSelectedAsset\(\{lockScroll:true,block:'center'\}\)/);
  assert.match(selection, /focusSelectedAsset\(\{lockScroll:true,block:'center'\}\)/);
  assert.match(focus, /scrollIntoView\(\{block,inline:'nearest',behavior:'auto'\}\)/);
});

test('rename, privacy, trash, and automatic tags use the Smart Folder delta path', () => {
  const sources = [
    between('async function renameAssetFile', 'function beginInlineFilenameRename'),
    between('async function toggleThumbnailEffect', 'async function toggleQuickCheck'),
    between('async function setAssetTrashWithoutGridRefresh', 'async function handleDeleteSelection'),
    between('function applyTagsToMatchingAssetsAsync', 'function runAutoTagOptimistically'),
    between('function runAutoTagOptimistically', 'function applyTagsToAssetsOptimistically'),
  ];
  for (const source of sources) {
    assert.match(source, /applyMetadataViewDelta\(/);
    assert.doesNotMatch(source, /renderGrid\(/);
  }
});
