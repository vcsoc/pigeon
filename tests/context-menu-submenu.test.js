'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const renderer=fs.readFileSync(path.join(__dirname,'..','src','renderer.js'),'utf8');

test('outside interactions close the asset context menu and its convert submenu together',()=>{
  assert.match(renderer,/function hideContextMenu\(\)[^\n]*#asset-context-submenu/);
  assert.match(renderer,/if \(!event\.target\.closest\('#asset-context-menu, #asset-context-submenu'\)\) \{ hideContextMenu\(\);/);
  assert.doesNotMatch(renderer,/if \(!event\.target\.closest\('#asset-context-menu'\)\) \{ elements\.contextMenu\.classList\.add\('hidden'\)/);
});
