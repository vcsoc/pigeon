const test=require('node:test');
const assert=require('node:assert/strict');
const {createThumbnailScheduler}=require('../electron/thumbnail-scheduler');

const tick=()=>new Promise((resolve)=>setImmediate(resolve));
test('thumbnail scheduler prioritizes selected, visible, ahead, and behind work',async()=>{
  const order=[];let release;const gate=new Promise((resolve)=>{release=resolve;});
  const scheduler=createThumbnailScheduler({maxConcurrency:1,idleDelayMs:10000,processJob:async(job)=>{order.push(job.id);if(order.length===1)await gate;}});
  scheduler.setContext({portfolioId:'p',generation:1});
  scheduler.updatePriority({portfolioId:'p',generation:1,behind:[{id:'behind',version:1}],ahead:[{id:'ahead',version:1}],visible:[{id:'visible',version:1}],selected:[{id:'selected',version:1}]});
  await tick();assert.equal(order[0],'selected');release();await tick();await tick();assert.deepEqual(order,['selected','visible','ahead','behind']);scheduler.dispose();
});

test('scheduler deduplicates versions, rejects stale context, and reserves idle capacity',async()=>{
  const active=[];const releases=[];const scheduler=createThumbnailScheduler({maxConcurrency:2,idleDelayMs:0,processJob:(job)=>new Promise((resolve)=>{active.push(job);releases.push(resolve);})});
  scheduler.setContext({portfolioId:'p',generation:3});
  const idle=[{id:'i1',version:1},{id:'i2',version:1},{id:'i3',version:1}];scheduler.setIdleProvider(()=>idle.shift()||null);scheduler.drain();await tick();
  assert.equal(scheduler.stats().activeBackground,1);
  assert.equal(scheduler.updatePriority({portfolioId:'p',generation:2,visible:[{id:'stale',version:1}]}),false);
  scheduler.updatePriority({portfolioId:'p',generation:3,visible:[{id:'v',version:1},{id:'v',version:1}]});await tick();
  assert.equal(scheduler.stats().activeInteractive,1);assert.equal(active.filter((job)=>job.id==='v').length,1);
  releases.splice(0).forEach((resolve)=>resolve());await tick();scheduler.dispose();
});

test('active viewport input pauses additional full-library warming',async()=>{
  let clock=0,nextTimer=0;const timers=new Map(),active=[],releases=new Map(),idle=[{id:'idle-1',version:1},{id:'idle-2',version:1}];
  const scheduler=createThumbnailScheduler({maxConcurrency:2,idleDelayMs:500,now:()=>clock,setTimer:(callback)=>{const id=++nextTimer;timers.set(id,callback);return id;},clearTimer:(id)=>timers.delete(id),processJob:(job)=>new Promise((resolve)=>{active.push(job.id);releases.set(job.id,resolve);})});
  scheduler.setContext({portfolioId:'p',generation:4});scheduler.setIdleProvider(()=>idle.shift()||null);clock=500;scheduler.drain();await tick();assert.deepEqual(active,['idle-1']);
  scheduler.updatePriority({portfolioId:'p',generation:4,visible:[{id:'visible',version:1}]});await tick();assert.deepEqual(active,['idle-1','visible']);
  releases.get('idle-1')();releases.get('visible')();await tick();await tick();assert.equal(active.includes('idle-2'),false);
  clock=1000;for(const callback of [...timers.values()])callback();await tick();assert.equal(active.includes('idle-2'),true);releases.get('idle-2')();scheduler.dispose();
});
