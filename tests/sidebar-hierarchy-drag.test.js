const test=require('node:test');const assert=require('node:assert/strict');const {plan}=require('../src/sidebar-hierarchy-drag');
const tree=[{id:'a',parentId:null},{id:'b',parentId:'a'},{id:'c',parentId:'b'},{id:'d',parentId:'b'}];
test('heading drops move multiple virtual items to root',()=>assert.deepEqual(plan(tree,['c','d'],true).map(x=>[x.id,x.destination]),[['c',null],['d',null]]));
test('left drops move exactly one level, not all the way to root',()=>assert.deepEqual(plan(tree,['c','d'],false).map(x=>[x.id,x.destination]),[['c','a'],['d','a']]));
test('selected descendants travel with parents and roots stay put',()=>{assert.deepEqual(plan(tree,['b','c'],false).map(x=>[x.id,x.destination]),[['b',null]]);assert.deepEqual(plan(tree,['a'],true),[]);});
const folders=[{id:'a',locationId:'l',subfolder:'a'},{id:'b',locationId:'l',subfolder:'a/b'},{id:'c',locationId:'l',subfolder:'a/b/c'},{id:'d',locationId:'other',subfolder:'a/d/e'}];
test('physical folder headings target each source indexed root',()=>assert.deepEqual(plan(folders,['c','d'],true,true).map(x=>[x.locationId,x.destination]),[['l',''],['other','']]));
test('physical left drops use grandparent directory, preserving the folder name',()=>assert.deepEqual(plan(folders,['c','d'],false,true).map(x=>x.destination),['a','a']));
test('physical batches suppress selected descendants and ignore root-level folders',()=>{assert.deepEqual(plan(folders,['b','c'],true,true).map(x=>x.id),['b']);assert.deepEqual(plan(folders,['a'],false,true),[]);});
