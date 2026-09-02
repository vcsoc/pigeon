const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../electron/library-core');
const rules=require('../src/smart-folder-rules');

const filter=(field,value,ruleMatch='all')=>({ruleMatch,rules:[{field,operator:'contains',value}]});
const fixture=()=>core.migrateLibrary({assets:[
  {id:'family-trip',filename:'family-trip.jpg',kind:'image',tags:['people','family','travel']},
  {id:'family-home',filename:'family-home.jpg',kind:'image',tags:['people','family']},
  {id:'work-trip',filename:'work-trip.jpg',kind:'image',tags:['people','work','travel']},
  {id:'unrelated',filename:'landscape.jpg',kind:'image',tags:['travel']}
]});

test('nested Smart Folders persist only local rules and actively AND every ancestor level',()=>{
  const library=fixture(),parent=core.createSmartFolder(library,'People',filter('tags','people')),child=core.createSmartFolder(library,'Family',filter('tags','family'),parent.id),grandchild=core.createSmartFolder(library,'Family trips',filter('tags','travel'),child.id);
  assert.deepEqual(child.filters,filter('tags','family'));
  assert.equal(Object.hasOwn(child.filters,'inheritedRules'),false);
  assert.deepEqual(rules.resolve(library.smartFolders,grandchild).chain.map((folder)=>folder.id),[parent.id,child.id,grandchild.id]);
  assert.deepEqual(core.evaluateSmartFolder(library,parent).map((asset)=>asset.id),['family-trip','family-home','work-trip']);
  assert.deepEqual(core.evaluateSmartFolder(library,child).map((asset)=>asset.id),['family-trip','family-home']);
  assert.deepEqual(core.evaluateSmartFolder(library,grandchild).map((asset)=>asset.id),['family-trip']);
});

test('parent edits propagate live while child local rules continue refining results',()=>{
  const library=fixture(),parent=core.createSmartFolder(library,'Parent',filter('tags','people')),child=core.createSmartFolder(library,'Child',filter('tags','family'),parent.id);
  assert.deepEqual(core.evaluateSmartFolder(library,child).map((asset)=>asset.id),['family-trip','family-home']);
  parent.filters=filter('tags','travel');parent.updatedAt=Date.now();
  assert.deepEqual(core.evaluateSmartFolder(library,child).map((asset)=>asset.id),['family-trip']);
  child.filters=filter('name','home');
  assert.deepEqual(core.evaluateSmartFolder(library,child).map((asset)=>asset.id),[]);
});

test('folder-level any semantics are preserved while hierarchy levels combine with AND',()=>{
  const library=fixture(),parent=core.createSmartFolder(library,'People or work',{ruleMatch:'any',rules:[{field:'tags',operator:'contains',value:'people'},{field:'tags',operator:'contains',value:'work'}]}),child=core.createSmartFolder(library,'Trips',filter('tags','travel'),parent.id);
  assert.deepEqual(core.evaluateSmartFolder(library,child).map((asset)=>asset.id),['family-trip','work-trip']);
});

test('missing parents apply the surviving local rule and cycles fail closed',()=>{
  const library=fixture(),orphan=core.createSmartFolder(library,'Orphan',filter('tags','family'));orphan.parentId='missing';
  const missing=rules.resolve(library.smartFolders,orphan);assert.equal(missing.valid,true);assert.equal(missing.missingParentId,'missing');assert.deepEqual(missing.chain.map((folder)=>folder.id),[orphan.id]);
  assert.deepEqual(core.evaluateSmartFolder(library,orphan).map((asset)=>asset.id),['family-trip','family-home']);
  const first=core.createSmartFolder(library,'Cycle A',filter('tags','people')),second=core.createSmartFolder(library,'Cycle B',filter('tags','travel'),first.id);first.parentId=second.id;
  assert.equal(rules.resolve(library.smartFolders,first).cycle,true);assert.deepEqual(core.evaluateSmartFolder(library,first),[]);assert.throws(()=>core.createSmartFolder(library,'Cycle child',filter('tags','family'),first.id),/cycle/);assert.throws(()=>core.moveSmartFolder(library,orphan.id,first.id),/cycle/);
});

test('effective evaluation supplies the same counts as effective result filtering',()=>{
  const library=fixture(),parent=core.createSmartFolder(library,'People',filter('tags','people')),child=core.createSmartFolder(library,'Family',filter('tags','family'),parent.id),resolutions=new Map(library.smartFolders.map((folder)=>[folder.id,rules.resolve(library.smartFolders,folder)]));
  const counts=new Map(library.smartFolders.map((folder)=>[folder.id,library.assets.filter((asset)=>rules.matchesResolved(asset,resolutions.get(folder.id),core.matchesFilters)).length]));
  assert.equal(counts.get(parent.id),core.evaluateSmartFolder(library,parent).length);assert.equal(counts.get(child.id),core.evaluateSmartFolder(library,child).length);
});
