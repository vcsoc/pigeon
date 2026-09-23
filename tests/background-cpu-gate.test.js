const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('electron/main.js','utf8'),code=source.slice(source.indexOf('async function waitForIndexCpuBudget('),source.indexOf('function scanWorkActive()'));

test('background indexing and preview jobs wait while aggregate Electron CPU exceeds budget',async()=>{
 const values=[31,19,2],labels=[],context={app:{getAppMetrics:()=>[{cpu:{percentCPUUsage:values.shift()??2}}]},INDEX_CPU_LIMIT:8,MIN_FREE_MEMORY_BYTES:100,backgroundRunActive:()=>true,waitForBackgroundThread:async()=>true,availableMemoryBytes:async()=>200,reportBackgroundProgress:(_id,entry)=>labels.push(entry.label),setTimeout:fn=>{fn();return 1}};vm.createContext(context);vm.runInContext(code,context);
 assert.equal(await context.waitForIndexCpuBudget({progressId:'scan'}),true);assert.deepEqual(labels,['Background work paused for CPU','Background work paused for CPU']);
});
