const test=require('node:test');
const assert=require('node:assert/strict');
const delta=require('../src/metadata-view-delta');

const compare=(a,b)=>a.rating-b.rating||a.id.localeCompare(b.id);
const matchesUnrated=(asset)=>asset.rating===0&&asset.parent===true;

test('single and multi rating remove only changed Smart Folder members in deterministic order',()=>{
  const assets=[{id:'a',rating:0,parent:true},{id:'b',rating:1,parent:true},{id:'c',rating:0,parent:true},{id:'d',rating:0,parent:true}];
  const changes=[{index:0,before:{...assets[0]},after:Object.assign(assets[0],{rating:3})},{index:2,before:{...assets[2]},after:Object.assign(assets[2],{rating:5})}];
  const result=delta.reconcileIndices({indices:[0,2,3],changes,assets,compare,matches:matchesUnrated});
  assert.deepEqual(result.next,[3]);assert.deepEqual(result.removedIds,['a','c']);assert.deepEqual(result.addedIds,[]);
});

test('changed assets can enter a rated Smart Folder and move to the correct sort position',()=>{
  const assets=[{id:'a',rating:1},{id:'b',rating:4},{id:'c',rating:2}];
  const before={...assets[2]};assets[2].rating=5;
  const result=delta.reconcileIndices({indices:[0,1],changes:[{index:2,before,after:assets[2]}],assets,compare,matches:(asset)=>asset.rating>0});
  assert.deepEqual(result.next,[0,1,2]);assert.deepEqual(result.addedIds,['c']);
  const beforeSort={...assets[0]};assets[0].rating=6;
  const moved=delta.reconcileIndices({indices:result.next,changes:[{index:0,before:beforeSort,after:assets[0]}],assets,compare,matches:(asset)=>asset.rating>0});
  assert.deepEqual(moved.next,[1,2,0]);assert.deepEqual(moved.retainedIds,['a']);
});

test('tag changes remove only newly excluded Smart Folder members',()=>{
  const assets=[{id:'a',tags:['keep']},{id:'b',tags:['keep']},{id:'c',tags:['keep']}],before={...assets[1],tags:[...assets[1].tags]};assets[1].tags.push('excluded');
  const result=delta.reconcileIndices({indices:[0,1,2],changes:[{index:1,before,after:assets[1]}],assets,compare:(_a,_b)=>0,matches:(asset)=>!asset.tags.includes('excluded')});
  assert.deepEqual(result.next,[0,2]);assert.deepEqual(result.removedIds,['b']);assert.deepEqual(result.retainedIds,[]);
  assert.deepEqual(delta.keyedCardPlan(['a','b','c'],['a','c'],['b']),{remove:['b'],create:[],reuse:['a','c'],update:[],order:['a','c']});
});

test('effective inherited rules drive incremental counts for ancestors and descendants',()=>{
  const folders=[{id:'parent'},{id:'child'},{id:'unrelated'}],counts=new Map([['parent',2],['child',1],['unrelated',4]]),resolutions={parent:{match:(asset)=>asset.parent},child:{match:(asset)=>asset.parent&&asset.rating===0},unrelated:{match:(asset)=>asset.favorite}};
  const before={id:'a',parent:true,rating:0,favorite:false},after={...before,rating:4};
  const changed=delta.updateCounts({folders,counts,changes:[{before,after}],resolve:(folder)=>resolutions[folder.id],matches:(asset,resolution)=>resolution.match(asset)});
  assert.deepEqual(changed,['child']);assert.equal(counts.get('parent'),2);assert.equal(counts.get('child'),0);assert.equal(counts.get('unrelated'),4);
});

test('missing or cyclic Smart Folder resolutions fail closed without corrupting counts',()=>{
  const folders=[{id:'missing'},{id:'cycle'}],counts=new Map([['missing',0],['cycle',0]]),invalid={valid:false};
  assert.doesNotThrow(()=>delta.updateCounts({folders,counts,changes:[{before:{id:'a'},after:{id:'a',rating:1}}],resolve:()=>invalid,matches:(_asset,resolution)=>Boolean(resolution.valid)}));
  assert.deepEqual([...counts.values()],[0,0]);
});

test('keyed reconciliation preserves every unaffected card and thumbnail identity',()=>{
  const plan=delta.keyedCardPlan(['a','b','c','d'],['b','c','d','e'],['b']);
  assert.deepEqual(plan.remove,['a']);assert.deepEqual(plan.create,['e']);assert.deepEqual(plan.update,['b']);assert.deepEqual(plan.reuse,['c','d']);assert.deepEqual(plan.order,['b','c','d','e']);
});

test('selection moves to nearest survivor without embedding renderer scroll state',()=>{
  const assets=['a','b','c','d','e'].map((id)=>({id})),result=delta.selectionAfterRemoval({selectedId:'b',selectedIds:new Set(['b','c','d']),removedIds:['b','c','d'],previous:[0,1,2,3,4],next:[0,4],assets});
  assert.equal(result.selectedId,'e');assert.deepEqual([...result.selectedIds],['e']);assert.equal(Object.hasOwn(result,'scrollTop'),false);
});
