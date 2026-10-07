'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {semanticPriorityIds,createSemanticWorkQueue}=require('../electron/semantic-priority');
const library={
 locations:[{id:'folder',type:'folder',path:'/files'}],
 collections:[{id:'parent'},{id:'child',parentId:'parent'},{id:'other'}],
 smartFolders:[{id:'docs',filters:{rules:[{field:'type',operator:'equals',value:'document'}]}}],
 assets:[
  {id:'outside',kind:'image',locationId:'elsewhere',path:'/elsewhere/a.png',collectionIds:['other']},
  {id:'image',kind:'image',locationId:'folder',path:'/files/current/a.png',collectionIds:['parent']},
  {id:'document',kind:'document',locationId:'folder',path:'/files/current/note.txt',collectionIds:['parent']},
  {id:'nested',kind:'audio',locationId:'folder',path:'/files/current/nested/a.wav',collectionIds:['child']},
  {id:'sibling',kind:'video',locationId:'folder',path:'/files/current-other/a.mp4',collectionIds:[]}
 ]
};
test('folder priority includes all media types and respects direct/recursive navigation, not sibling prefixes',()=>{
 const scope={type:'folder',id:'folder',subfolder:'current'};
 assert.deepEqual(semanticPriorityIds(library,scope),['image','document','nested']);
 assert.deepEqual(semanticPriorityIds(library,scope,false),['image','document']);
 assert.deepEqual(semanticPriorityIds(library,{...scope,subfolder:'../elsewhere'}),[]);
});
test('collection priority covers direct and descendant memberships without duplicates',()=>{
 assert.deepEqual(semanticPriorityIds(library,{type:'collection',id:'parent'}),['image','document','nested']);
 assert.deepEqual(semanticPriorityIds(library,{type:'collection',id:'parent'},false),['image','document']);
});
test('smart-folder priority uses its actual saved rules and inherited rules',()=>{
 const scoped={...library,smartFolders:[...library.smartFolders,{id:'child',parentId:'docs',filters:{}}]};
 assert.deepEqual(semanticPriorityIds(scoped,{type:'smart-folder',id:'docs'}),['document']);
 assert.deepEqual(semanticPriorityIds(scoped,{type:'smart-folder',id:'child'}),['document']);
});
test('empty, deleted and unknown scopes fall back to the whole portfolio queue',()=>{
 for(const scope of [null,{type:'collection',id:'missing'},{type:'smart-folder',id:'missing'},{type:'folder',id:'missing'}])assert.deepEqual(semanticPriorityIds(library,scope),[]);
 const work=createSemanticWorkQueue(library.assets);work.prioritize(new Set());assert.deepEqual(work.take(100),library.assets);assert.equal(work.length,0);
});
test('priority items finish all incremental segments before remaining items, without mixed batches',()=>{
 const work=createSemanticWorkQueue(library.assets);work.prioritize(new Set(['nested','document']));
 const first=work.take(4);assert.deepEqual(first.map(a=>a.id),['document','nested']);
 work.push(first[1]);assert.deepEqual(work.take(4).map(a=>a.id),['nested']);
 assert.deepEqual(work.take(4).map(a=>a.id),['outside','image','sibling']);assert.equal(work.length,0);
});
test('repeated Analyze now reprioritizes pending and partially completed work without duplication',()=>{
 const work=createSemanticWorkQueue(library.assets);work.prioritize(new Set(['image']));
 const inFlight=work.take(2);assert.deepEqual(inFlight.map(a=>a.id),['image']);work.push(inFlight[0]);
 const next=new Set(['sibling','nested']);work.prioritize(next);
 assert.deepEqual(work.take(4).map(a=>a.id),['nested','sibling']);
 work.prioritize(next);assert.deepEqual(work.take(4).map(a=>a.id),['image','outside','document']);assert.equal(work.length,0);
});
