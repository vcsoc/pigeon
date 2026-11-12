'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {rebase}=require('../src/folder-tree-move');
const folder=path=>({path,name:path.split('/').pop(),depth:path.split('/').length-1,hasChildren:false,count:2,directCount:1});
function tree(paths){return{folders:paths.map(folder),totalFolders:paths.length,visibleFolders:paths.length};}
test('moving a nested folder immediately rebases descendants and branch toggles',()=>{
  const source=tree(['unsorted','unsorted/Community','unsorted/Community/Nested','comfyui']);const cache=new Map([['loc',source]]);
  assert.equal(rebase(cache,'loc','unsorted/Community','loc','comfyui/Community'),true);
  assert.deepEqual(source.folders.map(f=>f.path),['comfyui','comfyui/Community','comfyui/Community/Nested','unsorted']);
  assert.equal(source.folders.find(f=>f.path==='comfyui').hasChildren,true);assert.equal(source.folders.find(f=>f.path==='unsorted').hasChildren,false);assert.equal(source.folders.find(f=>f.path.endsWith('/Nested')).depth,2);assert.equal(source.totalFolders,4);
});
test('cross-location moves preserve descendants without duplicating the source',()=>{
  const source=tree(['a','a/child']),destination=tree(['dest']),cache=new Map([['from',source],['to',destination]]);
  assert.equal(rebase(cache,'from','a','to','dest/a'),true);assert.deepEqual(source.folders,[]);assert.deepEqual(destination.folders.map(f=>f.path),['dest','dest/a','dest/a/child']);assert.equal(destination.folders[0].hasChildren,true);
});
test('missing caches or missing source do not fabricate folder entries',()=>{const cache=new Map([['a',tree(['other'])],['b',tree([])]]);assert.equal(rebase(cache,'a','absent','b','dest'),false);assert.equal(rebase(cache,'missing','absent','b','dest'),false);});
