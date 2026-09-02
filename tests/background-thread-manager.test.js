'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createBackgroundThreadManager}=require('../electron/background-thread-manager');

test('thread manager pauses individual work and resumes its cooperative checkpoint',async()=>{
  const events=[],manager=createBackgroundThreadManager({emit:(task)=>events.push(task)});manager.report('scan','portfolio',{label:'Scanning',total:10});
  assert.equal(manager.setPaused('scan',true),true);let continued=false;const waiting=manager.wait('scan').then(()=>{continued=true;});await new Promise((resolve)=>setImmediate(resolve));assert.equal(continued,false);assert.equal(events.at(-1).status,'paused');manager.setPaused('scan',false);await waiting;assert.equal(continued,true);assert.equal(events.at(-1).status,'running');
});

test('pause all queues new threads and queued threads can be reordered',async()=>{
  const events=[],manager=createBackgroundThreadManager({emit:(task)=>events.push(task)});manager.setAllPaused('portfolio',true);manager.report('first','portfolio',{label:'First'});manager.report('second','portfolio',{label:'Second'});assert.deepEqual(manager.snapshot('portfolio').map((task)=>task.status),['queued','queued']);assert.equal(manager.reorder(['second','first']),2);assert.deepEqual(manager.snapshot('portfolio').sort((a,b)=>a.order-b.order).map((task)=>task.id),['second','first']);manager.setPaused('second',false);await manager.wait('second');assert.equal(manager.snapshot('portfolio').find((task)=>task.id==='second').started,true);
});

test('completed threads wake waiters and cannot be paused again',async()=>{
  const manager=createBackgroundThreadManager();manager.setAllPaused('portfolio',true);manager.report('download','portfolio',{label:'Download'});const waiting=manager.wait('download');manager.report('download','portfolio',{label:'Complete',completed:1,total:1,done:true});assert.equal(await waiting,false);assert.equal(manager.setPaused('download',true),false);
});

test('removing a paused thread cancels its waiter and registered process control',async()=>{
  const events=[],controls=[],manager=createBackgroundThreadManager({emit:(task)=>events.push(task)});manager.report('scan','portfolio',{label:'Scan'});manager.registerPauseHandler('scan',(paused,options)=>controls.push({paused,options}));manager.setPaused('scan',true);const waiting=manager.wait('scan');assert.equal(manager.remove('scan'),true);assert.equal(await waiting,false);assert.deepEqual(manager.snapshot('portfolio'),[]);assert.equal(events.at(-1).status,'cancelled');assert.deepEqual(controls.at(-1),{paused:false,options:{cancelled:true}});assert.equal(manager.remove('scan'),false);
});
