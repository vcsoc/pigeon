'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {createSemanticGovernor}=require('../electron/semantic-governor');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const cap={cpu:.15,memory:.15,cores:1,memoryBytes:1000};
test('manual governor ignores zero free RAM and activity, but preserves explicit pause',async()=>{
  const original=os.freemem;os.freemem=()=>0;let paused=false,last;
  const control=createSemanticGovernor({child:{pid:999999999,exitCode:null},getMode:()=> 'manual',getBudget:()=>cap,getProcessSample:()=>({ticks:0,rss:100}),isBusy:()=>true,isPaused:()=>paused,onSample:sample=>last=sample,intervalMs:10});
  try{await sleep(60);assert.equal(last.waiting,false);assert.equal(last.activityBlocked,false);assert.equal(last.memoryPressure,false);assert.equal(last.memoryLimitBytes,1000);paused=true;await sleep(30);assert.equal(last.waiting,true);}finally{control.close();os.freemem=original;}
});
test('automatic governor uses the idle callback, not machine CPU or free RAM thresholds',async()=>{
  let idleReady=false,last;
  const control=createSemanticGovernor({child:{pid:999999999,exitCode:null},getMode:()=> 'automatic',getBudget:()=>cap,getProcessSample:()=>({ticks:0,rss:100}),isBusy:()=>!idleReady,onSample:sample=>last=sample,intervalMs:10});
  try{await sleep(40);assert.equal(last.activityBlocked,true);idleReady=true;await sleep(30);assert.equal(last.waiting,false);}finally{control.close();}
});
test('actual memory over the slider cap is reported rather than waiting for free RAM',async()=>{
  let error;const control=createSemanticGovernor({child:{pid:999999999,exitCode:null},getMode:()=> 'manual',getBudget:()=>cap,getProcessSample:()=>({ticks:0,rss:1001}),onMemoryLimit:value=>error=value,intervalMs:10});
  try{await sleep(40);assert.match(error.message,/15% memory cap/);assert.match(error.message,/Increase Resource limit/);}finally{control.close();}
});
test('manual work is CPU-throttled when actual process use exceeds its cap',async()=>{
  let ticks=0,last;const control=createSemanticGovernor({child:{pid:999999999,exitCode:null},getMode:()=> 'manual',getBudget:()=>cap,getProcessSample:()=>({ticks:ticks+=10,rss:100}),onSample:sample=>last=sample,intervalMs:10});
  try{await sleep(40);assert.equal(last.suspended,true);assert.equal(last.waiting,false,'CPU throttling is not an admission wait');}finally{control.close();}
});
const python=process.env.PIGEON_SEMANTIC_PYTHON||path.resolve('.semantic-runtime/bin/python');
test('native resource accounting observes and pauses the actual macOS/Windows worker',{skip:process.platform==='linux'||!fs.existsSync(python),timeout:6000},async()=>{
  const child=spawn(process.execPath,['-e','let value=0;setInterval(()=>{const end=Date.now()+25;while(Date.now()<end)value++},30)'],{detached:process.platform!=='win32',stdio:'ignore'});
  let last,error;const samples=[];const control=createSemanticGovernor({child,python,getMode:()=> 'manual',getBudget:()=>({cpu:.05,memory:.5,cores:1,memoryBytes:512*1024**2}),onSample:sample=>{last=sample;samples.push(sample);},onMonitorError:value=>error=value});
  try{await sleep(1400);assert.equal(error,undefined);assert.ok(last.memoryBytes>1024**2,'real RSS is measured rather than assumed zero');assert.ok(samples.some(sample=>sample.suspended),'real CPU usage triggers throttling');}finally{
    control.close({terminate:true});try{if(process.platform!=='win32')process.kill(-child.pid,'SIGKILL');else child.kill();}catch{}
    await new Promise(resolve=>child.exitCode!==null||child.signalCode!==null?resolve():child.once('exit',resolve));
  }
});
