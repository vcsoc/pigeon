const test=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../src/cooperative-view');

test('cooperative view filters and sorts 500,000 assets without one unbounded task',async()=>{
  const source=Array.from({length:500000},(_,index)=>({id:index,modified:(index*48271)%2147483647,kind:index%5?'image':'document'}));let schedules=0,preview=null,maxScannedStep=0,lastScanned=0;
  const indices=await new Promise((resolve)=>build({source,predicate:(asset)=>asset.kind==='image',compare:(a,b)=>b.modified-a.modified||a.id-b.id,schedule:(callback)=>{schedules+=1;setImmediate(callback);},onPreview:(value)=>{preview=value;},onProgress:(progress)=>{if(progress.phase==='filter'){maxScannedStep=Math.max(maxScannedStep,progress.scanned-lastScanned);lastScanned=progress.scanned;}},onDone:resolve}));
  assert.equal(indices.length,400000);assert.equal(preview.length,480);assert.ok(schedules>1000);assert.ok(maxScannedStep<=512);for(let index=1;index<indices.length;index+=1)assert.ok(source[indices[index-1]].modified>=source[indices[index]].modified);
});
