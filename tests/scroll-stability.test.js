'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

test('queued virtual relayouts discard stale anchors after direct scroll input', () => {
  assert.match(renderer, /pendingVirtualRelayout=\{anchor,interaction:gridScrollInteractionVersion,scrollTop:elements\.gridWrap\.scrollTop\}/);
  assert.match(renderer, /scrollUnchanged=pending&&Math\.abs\(elements\.gridWrap\.scrollTop-pending\.scrollTop\)<=1/);
  assert.match(renderer, /anchorStillCurrent=pending\?\.interaction===gridScrollInteractionVersion&&scrollUnchanged/);
  assert.match(renderer, /next=anchorStillCurrent\?pending\.anchor:captureVirtualLayoutAnchor\(\)/);
});

test('thumbnail completion relayouts only when logical geometry changes', () => {
  assert.match(renderer, /previousLayoutRatio=assetLayoutRatio\(asset\)/);
  assert.match(renderer, /layoutGeometryChanged=Math\.abs\(assetLayoutRatio\(asset\)-previousLayoutRatio\)>\.0005/);
  assert.match(renderer, /if\(layoutGeometryChanged\)scheduleThumbnailGeometryRefresh\(layoutAnchor\)/);
  assert.match(renderer, /if\(Date\.now\(\)>=thumbnailScrollUntil\).*scheduleVirtualLayoutRefresh\(anchor\)/);
  assert.match(renderer, /setTimeout\(\(\)=>\{thumbnailGeometrySettleTimer=null;scheduleThumbnailGeometryRefresh\(captureVirtualLayoutAnchor\(\)\);\}/);
});

test('rating reconciliation never collapses the active virtual scroll extent', () => {
  assert.doesNotMatch(renderer, /classList\.toggle\('virtualized-grid',(?:assetView\.virtual|virtual)\);elements\.grid\.style\.height=''/);
  assert.match(renderer, /if\(virtual\)\{state\.virtualExtentIdentity=metrics\.identity;state\.virtualExtentPx=metrics\.extentPx;elements\.grid\.style\.height=`\$\{state\.virtualExtentPx\}px`;\}else\{[^}]*elements\.grid\.style\.height=''/);
});

test('large removals mount and center a successor outside the current virtual window', () => {
  const reveal = renderer.slice(renderer.indexOf('function ensureVirtualSelectedAssetWindow'), renderer.indexOf('function navigateAssets'));
  assert.match(reveal, /currentViewIndexOf\(selectedId,indices\)/);
  assert.match(reveal, /placement\.y\+placement\.height\/2-viewportHeight\/2/);
  assert.match(reveal, /windowForScroll\(\{model:metrics,scrollTop,viewportHeight,size:VIRTUAL_ASSET_WINDOW\}\)/);
  assert.match(reveal, /if\(windowMissing\)renderGrid\(\{preserveCards:true\}\)/);
  assert.match(reveal, /block==='center'\?\[0,80,200,500,1000,1800,3000,5000\]/);
});
