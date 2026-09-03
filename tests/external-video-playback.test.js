'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const renderer=fs.readFileSync(path.join(__dirname,'..','src','renderer.js'),'utf8');

test('slow external-drive video loading does not trigger a full compatibility transcode',()=>{
  assert.match(renderer,/Loading video from external drive/);
  assert.match(renderer,/Waiting for external drive/);
  assert.doesNotMatch(renderer,/recoverViewerVideo\(asset\.id, 'timeout'\)/);
  assert.doesNotMatch(renderer,/recoverViewerVideo\(state\.viewerAssetId, 'timeout'\)/);
  assert.match(renderer,/addEventListener\('error',[\s\S]{0,400}recoverViewerVideo\(state\.viewerAssetId, 'codec'\)/);
});
