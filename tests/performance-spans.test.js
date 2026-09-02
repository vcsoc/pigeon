const test=require('node:test');
const assert=require('node:assert/strict');
const {createPerformanceRecorder,assetMix}=require('../electron/performance-spans');

test('performance spans are bounded and omit sensitive details',()=>{
  let clock=0,observed=[];const recorder=createPerformanceRecorder({limit:2,now:()=>clock,onRecord:(entry)=>observed.push(entry)});const span=recorder.start('stream',{portfolioSize:100,path:'secret'});clock=12.345;recorder.end(span,{batchCount:2,heapUsedMb:467});recorder.record('one');recorder.record('two');const snapshot=recorder.snapshot();
  assert.equal(snapshot.length,2);assert.equal(JSON.stringify(snapshot).includes('secret'),false);assert.deepEqual(assetMix([{kind:'image'},{kind:'image'},{kind:'video'}]),{image:2,video:1});
  assert.equal(observed[0].heapUsedMb,467);
});
