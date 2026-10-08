'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const {normalizeIdleMinutes}=require('../electron/semantic-policy');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<300;i++){if(check())return;await delay(10);}assert.fail('Expected scheduler transition');}
function fixture(t,{hold=false}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pigeon-semantic-start-')),python=path.join(root,'python'),jobs=[],held=[],governors=[],launches=[],done=new Set();
  fs.writeFileSync(python,'');fs.writeFileSync(path.join(root,'semantic-runtime.json'),JSON.stringify({python}));
  const assets=['a','b','c'].map(id=>({id,path:path.join(root,id+'.jpg'),kind:'image',name:id,tags:[],size:1,modified:1}));
  let idle=0,minutes=10;
  const operationTimers=[],originalTimeout=global.setTimeout,originalClearTimeout=global.clearTimeout;
  global.setTimeout=(callback,ms,...args)=>{if(ms!==600000)return originalTimeout(callback,ms,...args);const timer={callback,cleared:false};operationTimers.push(timer);return timer;};
  global.clearTimeout=timer=>{if(operationTimers.includes(timer))timer.cleared=true;else originalClearTimeout(timer);};
  const originalSpawn=cp.spawn,originalExec=cp.execFile,originalFree=os.freemem,originalTotal=os.totalmem,moduleFile=require.resolve('../electron/semantic-service');
  os.freemem=()=>0;os.totalmem=()=>4*1024**3;
  cp.execFile=(command,args,options,callback)=>setImmediate(()=>callback(null,'',''));
  cp.spawn=(command,args)=>{
    launches.push({command,args});const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.pid=999999999;child.exitCode=null;child.kill=()=>{child.exitCode=0;child.emit('exit',0);};
    if(args.some(value=>String(value).endsWith('semantic-engine.py'))){
      child.stdin={write(line,callback){
        const req=JSON.parse(line);jobs.push(req);
        const reply=()=>{let result={indexed:done.size,limited:0,vectors:done.size};
          if(req.action==='plan')result={pending:assets.filter(asset=>!done.has(asset.id)).map(asset=>asset.id)};
          if(req.action==='index_batch'){for(const job of req.jobs)done.add(job.asset.id);result={results:req.jobs.map(job=>({id:job.asset.id,done:true})),info:{indexed:done.size,limited:0,vectors:done.size}};}
          child.stdout.write(JSON.stringify({id:req.id,result})+'\n');
        };
        if(req.action==='index_batch'&&hold)held.push(reply);else setImmediate(reply);callback?.();
      }};setImmediate(()=>child.stdout.write('{"ready":true}\n'));
    }else setImmediate(()=>child.emit('exit',0));
    return child;
  };
  delete require.cache[moduleFile];
  const service=require(moduleFile).createSemanticService({userData:root,getContext:()=>({portfolioId:'p',databaseFile:path.join(root,'library.db')}),getAssets:()=>assets,getIdleSeconds:()=>idle,getIdleMinutes:()=>minutes,isBusy:()=>true,createGovernor:options=>{governors.push(options);return{close(){}};}});
  t.after(()=>{service.close();global.setTimeout=originalTimeout;global.clearTimeout=originalClearTimeout;cp.spawn=originalSpawn;cp.execFile=originalExec;os.freemem=originalFree;os.totalmem=originalTotal;delete require.cache[moduleFile];fs.rmSync(root,{recursive:true,force:true});});
  return{service,root,jobs,held,governors,launches,operationTimers,setIdle(value){idle=value;},setMinutes(value){minutes=value;},batches:()=>jobs.filter(job=>job.action==='index_batch')};
}
test('idle preference defaults to ten minutes and rejects or bounds invalid values',()=>{
  for(const value of [undefined,null,'',NaN,Infinity,-1,0])assert.equal(normalizeIdleMinutes(value),10);
  assert.equal(normalizeIdleMinutes('7'),7);assert.equal(normalizeIdleMinutes(1000),240);assert.equal(normalizeIdleMinutes(.1),1);
});
test('Analyze now starts with zero free RAM and no inactivity, retaining the selected cap',async t=>{
  const f=fixture(t,{hold:true});await f.service.configure({automatic:false,resourcePercent:15});
  await f.service.start({portfolioId:'p'});await until(()=>f.held.length===1);
  const status=await f.service.getStatus(),control=f.governors[0];assert.equal(status.mode,'manual');assert.equal(status.waitReason,null);assert.equal(control.getMode(),'manual');
  assert.equal(control.getBudget().cpu,.15);assert.equal(control.getBudget().memoryBytes,Math.floor(4*1024**3*.15));assert.equal(f.batches()[0].memoryLimit,Math.floor(4*1024**3*.15));
  assert.equal(status.resourcePercent,15);assert.equal(status.pauseOnActivity,true,'manual work does not disable later idle-only automation');
  while(f.held.length)f.held.shift()();await until(()=>f.batches().length>=1&&f.service.peekStatus().completed>=2);
});
test('automatic setup and analysis wait for real ten-minute inactivity, not a CPU or free-memory threshold',async t=>{
  const f=fixture(t);const initial=await f.service.getStatus();assert.equal(initial.waitReason,'activity');assert.equal(initial.idleMinutes,10);assert.equal(f.launches.length,0);
  f.setIdle(599);await f.service.getStatus();assert.equal(f.launches.length,0);
  f.setIdle(600);await f.service.getStatus();await until(()=>f.batches().length>0);
  assert.equal(f.governors[0].getMode(),'automatic');assert.equal(f.governors[0].isBusy(),false,'unrelated busy-work callback is not an admission gate');
  assert.equal(f.batches()[0].memoryLimit,Math.floor(4*1024**3*.15));
});
test('automatic batches pause on renewed activity, then resume after the configurable idle period',async t=>{
  const f=fixture(t,{hold:true});f.setMinutes(2);f.setIdle(120);await f.service.getStatus();await until(()=>f.held.length===1);
  f.setIdle(0);assert.equal(f.governors[0].isBusy(),true);f.held.shift()();await until(()=>f.service.peekStatus().waitReason==='activity');
  const count=f.batches().length;await delay(100);assert.equal(f.batches().length,count);
  f.setIdle(119);await delay(100);assert.equal(f.batches().length,count);
  f.setIdle(120);await until(()=>f.batches().length>count);
  assert.equal((await f.service.getStatus()).idleMinutes,2);
});
test('the operation watchdog defers expiry during a long idle pause and clears the renewed timer on completion',async t=>{
  const f=fixture(t,{hold:true});f.setIdle(600);await f.service.getStatus();await until(()=>f.held.length===1);
  const timer=f.operationTimers.at(-1);f.setIdle(0);timer.callback();
  const renewed=f.operationTimers.at(-1);assert.notEqual(renewed,timer);assert.notEqual(f.service.peekStatus().state,'error');
  f.setIdle(600);f.held.shift()();await until(()=>f.batches().length===2);assert.equal(renewed.cleared,true);
});
test('the operation watchdog still stops genuinely stalled active work',async t=>{
  const f=fixture(t,{hold:true});await f.service.start();await until(()=>f.held.length===1);
  f.operationTimers.at(-1).callback();await until(()=>f.service.peekStatus().state==='error');assert.match(f.service.peekStatus().error,/timed out/);
});
test('Continue resumes an idle-paused batch immediately without changing automatic idle policy',async t=>{
  const f=fixture(t,{hold:true});f.setIdle(600);await f.service.getStatus();await until(()=>f.held.length===1);
  f.setIdle(0);f.held.shift()();await until(()=>f.service.peekStatus().waitReason==='activity');
  await f.service.continueAnalysis();await until(()=>f.batches().length===2);
  assert.equal(f.governors[0].getMode(),'manual');assert.equal((await f.service.getStatus()).resourcePercent,15);
  const saved=JSON.parse(fs.readFileSync(path.join(f.root,'library.db.semantic-settings.json')));assert.equal(saved.pauseOnActivity,true);assert.equal(saved.resumeRequested,true);
});
