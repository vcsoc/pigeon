const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../src/asset-stream-state');

test('asset stream rejects stale generations and becomes usable before completion',()=>{
  const stream=create({minimumViewport:120});
  const shell=stream.begin({activePortfolioId:'one',streamGeneration:7,assetStreamPending:true,totalAssets:6,locations:[]});
  assert.deepEqual(shell.assets,[]);
  assert.equal(stream.applyChunk({generation:6,assets:[{id:'stale'}]}).accepted,false);
  assert.equal(stream.applyChunk({generation:7,assets:[{id:'a'}]}).firstUsable,true);
  stream.applyChunk({generation:7,assets:[{id:'b'},{id:'c'}]});
  assert.deepEqual(stream.library.assets.map((asset)=>asset.id),['a','b','c']);
  assert.equal(stream.complete,false);
  assert.equal(stream.finish({generation:7}).accepted,true);
  assert.equal(stream.library.assetStreamPending,false);
});

test('stream indexes remain correct across chunks, scan additions, and patches',()=>{
  const stream=create();stream.begin({streamGeneration:2,assetStreamPending:true,totalAssets:3});
  stream.applyChunk({generation:2,assets:[{id:'a',rating:0},{id:'b',rating:0}]});
  stream.applyChunk({generation:2,assets:[{id:'b',rating:1},{id:'c',rating:0}]});
  stream.upsertMany([{id:'d',rating:0}]);stream.patch('c',{rating:5});
  assert.deepEqual(stream.library.assets.map((asset)=>asset.id),['a','b','c','d']);
  assert.equal(stream.indexes.get('d'),3);assert.equal(stream.library.assets[1].rating,1);assert.equal(stream.library.assets[2].rating,5);
});
