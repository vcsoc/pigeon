const test=require('node:test');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {create:createStream}=require('../src/asset-stream-state');
const {create:createIndexes}=require('../src/asset-indexes');
const {lightweightAsset,assetDetails}=require('../electron/asset-transport');

test('renderer projection keeps global-search fields and defers heavy selected-only details',()=>{
  const source={id:'a',filename:'reference.png',path:'C:/library/reference.png',note:'searchable note',tags:['Global'],contentHash:'hash',thumbnailPath:'thumb.jpg',histogram:Array(256).fill(2),palette:['#123456'],exif:{Image:{Description:'large'}},technicalMetadata:{codec:'png'},encryptedMediaPaths:{secret:'value'}};
  const light=lightweightAsset(source),details=assetDetails(source);assert.equal(light.path,source.path);assert.equal(light.note,source.note);assert.deepEqual(light.tags,source.tags);assert.equal(light.contentHash,source.contentHash);assert.equal(light.thumbnailPath,source.thumbnailPath);assert.equal(light.detailsDeferred,true);for(const field of ['histogram','palette','exif','technicalMetadata','encryptedMediaPaths'])assert.equal(Object.hasOwn(light,field),false);assert.deepEqual(details.exif,source.exif);assert(JSON.stringify(light).length<JSON.stringify(source).length/2);
});

test('realistic 41k startup projection and indexing yield between bounded 500-asset slices',async(t)=>{
  const total=41293,batchSize=500,histogram=Array(64).fill(2),indexes=createIndexes(),stream=createStream({minimumViewport:120,onUpsert:(asset)=>indexes.upsert(asset)}),assets=Array.from({length:total},(_,index)=>({id:`asset-${index}`,filename:`reference-${index}.png`,path:`C:/portfolio/long-folder-${index%97}/reference-${index}.png`,note:`searchable description ${index} `.repeat(3),tags:[`tag-${index%83}`,`group-${index%17}`],collectionIds:[`collection-${index%11}`],kind:'image',modified:total-index,indexedAt:index,size:index*37,contentHash:`hash-${index%9000}`,histogram,exif:{Image:{Description:`reference ${index}`}}}));stream.begin({streamGeneration:9,assetStreamPending:true,totalAssets:total});let maxSliceMs=0,yields=0;
  for(let offset=0;offset<assets.length;offset+=batchSize){const started=performance.now(),chunk=assets.slice(offset,offset+batchSize).map(lightweightAsset);stream.applyChunk({generation:9,assets:chunk});maxSliceMs=Math.max(maxSliceMs,performance.now()-started);await new Promise((resolve)=>setImmediate(()=>{yields+=1;resolve();}));}
  stream.finish({generation:9,total});assert.equal(stream.library.assets.length,total);assert.equal(indexes.snapshot().size,total);assert.equal(yields,Math.ceil(total/batchSize));assert(maxSliceMs<100,`largest synchronous startup slice was ${maxSliceMs.toFixed(1)} ms`);t.diagnostic(`largest synchronous slice ${maxSliceMs.toFixed(1)} ms across ${yields} yielded batches`);
});
