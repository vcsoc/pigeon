'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const renderer=fs.readFileSync(path.join(__dirname,'..','src','renderer.js'),'utf8');

test('context menus display every applicable current keybinding',()=>{
  const start=renderer.indexOf('function applyCurrentContextMenuShortcuts'),end=renderer.indexOf('function positionMenu',start),source=renderer.slice(start,end);
  assert.ok(start>=0&&end>start);
  for(const [action,key] of [['open','Enter'],['open-default','Shift+Enter'],['reveal','Ctrl+Enter'],['rebuild-thumbnails','Ctrl+Alt+R'],['duplicate','Ctrl+D'],['five-stars','5'],['tag','Ctrl+T'],['trash','Delete']]){
    assert.match(source,new RegExp(`data-context-action=\\"${action}\\"[^\\n]+${key.replace(/[+\[\]]/g,'\\$&')}`));
  }
  assert.match(source,/data-context-action="location"[^\n]+state\.locationShortcut/);
  assert.match(source,/data-context-action="favorite"[^\n]+state\.favoriteShortcut/);
  assert.match(source,/data-context-action="rotate-left"[^\n]+preferences\.rotateLeftShortcut/);
  assert.match(source,/data-context-action="rotate-right"[^\n]+preferences\.rotateRightShortcut/);
  assert.match(source,/data-viewer-action="duplicate"[^\n]+'Ctrl\+D'/);
  assert.match(source,/data-viewer-action="open"[^\n]+'Shift\+Enter'/);
  assert.match(source,/shortcut=document\.createElement\('kbd'\)/);
  assert.match(renderer,/function positionMenu[\s\S]{0,100}applyCurrentContextMenuShortcuts\(menu\)/);
});
