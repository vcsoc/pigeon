'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{apply}=require('../src/folder-tree-counts');
const tree=(folders)=>({folders:folders.map(([path,count,directCount])=>({path,name:path.split('/').at(-1),count,directCount,depth:path.split('/').length-1,hasChildren:false}))});
test('confirmed moves update direct and recursive counts for source and destination ancestors',()=>{
 const cache=new Map([['a',tree([['old',2,1],['old/nested',1,1],['new',0,0]])]]),locations=[{id:'a',path:'/photos'}];
 apply(cache,locations,[{before:{locationId:'a',path:'/photos/old/nested/a.jpg'},after:{locationId:'a',path:'/photos/new/a.jpg'}}]);
 const by=Object.fromEntries(cache.get('a').folders.map(f=>[f.path,f]));assert.equal(by.old.count,1);assert.equal(by.old.directCount,1);assert.equal(by['old/nested'].count,0);assert.equal(by['old/nested'].directCount,0);assert.equal(by.new.count,1);assert.equal(by.new.directCount,1);
});
test('moves inside one folder leave shared ancestors unchanged and handle cross-location targets',()=>{
 const cache=new Map([['a',tree([['same',2,0],['same/one',1,1],['same/two',1,1]])],['b',tree([['dest',0,0]])]]),locations=[{id:'a',path:'/a'},{id:'b',path:'/b'}];
 apply(cache,locations,[{before:{locationId:'a',path:'/a/same/one/a.jpg'},after:{locationId:'a',path:'/a/same/two/a.jpg'}}]);const a=cache.get('a').folders;assert.equal(a.find(f=>f.path==='same').count,2);assert.equal(a.find(f=>f.path==='same/one').directCount,0);assert.equal(a.find(f=>f.path==='same/two').directCount,2);
 apply(cache,locations,[{before:{locationId:'a',path:'/a/same/two/a.jpg'},after:{locationId:'b',path:'/b/dest/a.jpg'}}]);assert.equal(a.find(f=>f.path==='same').count,1);assert.equal(cache.get('b').folders[0].directCount,1);
});
test('unmatched and root-only paths do not change counts; new nested folders are created',()=>{
 const t=tree([['existing',1,1]]),cache=new Map([['a',t]]);apply(cache,[{id:'a',path:'/'}],[{before:{locationId:'a',path:'/existing/a.jpg'},after:{locationId:'a',path:'/new/deep/a.jpg'}}]);assert.equal(t.folders.find(f=>f.path==='existing').count,0);assert.equal(t.folders.find(f=>f.path==='new').hasChildren,true);assert.equal(t.folders.find(f=>f.path==='new/deep').directCount,1);
});
