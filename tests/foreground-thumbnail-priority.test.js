'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createThumbnailScheduler}=require('../electron/thumbnail-scheduler');
const source=fs.readFileSync('electron/main.js','utf8'),budgetCode=source.slice(source.indexOf('async function waitForIndexCpuBudget('),source.indexOf('function scanWorkActive()'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function budgetContext(overrides={}){return vm.createContext({app:{getAppMetrics:()=>[{cpu:{percentCPUUsage:95}}]},INDEX_CPU_LIMIT:8,MIN_FREE_MEMORY_BYTES:100,backgroundRunActive:()=>true,waitForBackgroundThread:async()=>true,availableMemoryBytes:async()=>0,foregroundWorkPending:()=>false,reportBackgroundProgress(){},setTimeout(){throw Error('Foreground work was incorrectly throttled');},...overrides});}
test('visible thumbnails and explicit rescans bypass aggregate background CPU and free-memory start gates',async()=>{
 for(const run of [{foreground:true},{isForeground:()=>true}]){const context=budgetContext();vm.runInContext(budgetCode,context);assert.equal(await context.waitForIndexCpuBudget(run),true);}
});
test('automatic work yields to foreground pressure and resumes under the existing background budget',async()=>{
 let pressure=true,waits=0;const context=budgetContext({app:{getAppMetrics:()=>[{cpu:{percentCPUUsage:0}}]},availableMemoryBytes:async()=>200,foregroundWorkPending:()=>pressure,setTimeout(fn,ms){assert.equal(ms,50);waits++;pressure=false;fn();}});vm.runInContext(budgetCode,context);
 assert.equal(await context.waitForIndexCpuBudget({}),true);assert.equal(waits,1);
});
test('a running thumbnail promoted from warming can leave an already-blocked CPU gate',async()=>{
 let foreground=false,waits=0;const context=budgetContext({setTimeout(fn){waits++;foreground=true;fn();}});vm.runInContext(budgetCode,context);
 assert.equal(await context.waitForIndexCpuBudget({isForeground:()=>foreground}),true);assert.equal(waits,1);
});
test('foreground priority does not override an explicit user pause or cancellation',async()=>{
 const context=budgetContext({waitForBackgroundThread:async()=>false});vm.runInContext(budgetCode,context);assert.equal(await context.waitForIndexCpuBudget({foreground:true}),false);
});
test('read-ahead leaves capacity for visible thumbnails instead of occupying every worker',async t=>{
 const active=[],releases=[];const scheduler=createThumbnailScheduler({maxConcurrency:2,idleDelayMs:10000,processJob:job=>new Promise(resolve=>{active.push(job);releases.push(resolve);})});t.after(()=>{scheduler.dispose();for(const release of releases)release();});
 scheduler.setContext({portfolioId:'p',generation:1});scheduler.updatePriority({portfolioId:'p',generation:1,ahead:[{id:'ahead1'},{id:'ahead2'}]});await tick();assert.equal(active.length,1);assert.equal(scheduler.stats().queued,1,'reserved work must stay queued');
 scheduler.updatePriority({portfolioId:'p',generation:1,visible:[{id:'visible'}],ahead:[{id:'ahead1'},{id:'ahead2'}]});await tick();assert.deepEqual(active.map(job=>job.id),['ahead1','visible']);assert.equal(scheduler.stats().activeForeground,1);
});
test('warming jobs already in flight are promoted in place when they become visible',async t=>{
 let job,release;const scheduler=createThumbnailScheduler({maxConcurrency:2,idleDelayMs:0,processJob:value=>{job=value;return new Promise(resolve=>{release=resolve;});}});t.after(()=>{scheduler.dispose();release?.();});scheduler.setContext({portfolioId:'p',generation:1});let next={id:'a',version:1};scheduler.setIdleProvider(()=>{const value=next;next=null;return value;});scheduler.drain();await tick();assert.equal(job.priority,4);
 scheduler.updatePriority({portfolioId:'p',generation:1,visible:[{id:'a',version:1}]});assert.equal(job.priority,1);assert.equal(job.reason,'visible');assert.equal(scheduler.stats().activeForeground,1);assert.equal(scheduler.stats().queued,0);
});
test('only explicit rescan IPC elevates a scan and its thumbnail jobs inherit that priority',async()=>{
 const handlers=new Map(),calls=[],location={id:'root',name:'Root'},context=vm.createContext({ipcMain:{handle:(name,handler)=>handlers.set(name,handler)},normalizedSubfolder:value=>value,library:{locations:[location]},activePortfolioId:'p',path:require('node:path'),reportBackgroundProgress(){},require:()=>({checkRescanSource:async()=>{}}),waitForBackgroundThread:async()=>true,publicLibrarySummary:()=>({}),scanLocation:async(id,options)=>calls.push({id,options}),broadcastLocations(){}});
 vm.runInContext(source.slice(source.indexOf("ipcMain.handle('library:rescan'"),source.indexOf("ipcMain.handle('library:refresh-sources'")),context);
 await handlers.get('library:rescan')(null,{id:'root',subfolder:'child'});assert.equal(calls[0].options.reason,'manual-rescan');
 assert.match(source,/run\.foreground=reason==='manual-rescan'/);assert.match(source,/isForeground:\(\)=>job\.priority<=1\|\|Boolean\(job\.scanRun\?\.foreground\)/);
});
