const test=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../src/cooperative-view');

test('cooperative view filters and sorts 500,000 assets without one unbounded task',async()=>{
  const source=Array.from({length:500000},(_,index)=>({id:index,modified:(index*48271)%2147483647,kind:index%5?'image':'document'}));let schedules=0,preview=null,maxScannedStep=0,lastScanned=0;
  const indices=await new Promise((resolve)=>build({source,predicate:(asset)=>asset.kind==='image',compare:(a,b)=>b.modified-a.modified||a.id-b.id,schedule:(callback)=>{schedules+=1;setImmediate(callback);},onPreview:(value)=>{preview=value;},onProgress:(progress)=>{if(progress.phase==='filter'){maxScannedStep=Math.max(maxScannedStep,progress.scanned-lastScanned);lastScanned=progress.scanned;}},onDone:resolve}));
  assert.equal(indices.length,400000);assert.equal(preview.length,480);assert.ok(schedules>1000);assert.ok(maxScannedStep<=512);for(let index=1;index<indices.length;index+=1)assert.ok(source[indices[index-1]].modified>=source[indices[index]].modified);
});

test('large-folder preview is the final sorted prefix and never asks visible IDs to decode twice',async()=>{
  const source=Array.from({length:12000},(_,index)=>({id:`asset-${index}`,folder:index%3?'large':'other',modified:(index*48271)%2147483647})),previewPainted=new Set(),decodeStarts=new Map();let preview=[];
  const final=await new Promise((resolve)=>build({source,predicate:(asset)=>asset.folder==='large',compare:(a,b)=>b.modified-a.modified||a.id.localeCompare(b.id),previewLimit:120,filterChunk:128,runSize:256,mergeChunk:128,schedule:setImmediate,onPreview:(indices)=>{preview=indices;for(const index of indices){previewPainted.add(source[index].id);decodeStarts.set(source[index].id,(decodeStarts.get(source[index].id)||0)+1);}},onDone:resolve}));
  assert.deepEqual(preview,final.slice(0,120));
  for(const index of final.slice(0,120)){const id=source[index].id;if(!previewPainted.has(id))decodeStarts.set(id,(decodeStarts.get(id)||0)+1);}
  assert.equal(Math.max(...decodeStarts.values()),1);
});
