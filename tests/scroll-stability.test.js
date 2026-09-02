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
