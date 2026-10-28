'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs');
process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-semantic-ui-')),fixture=await createFixtures(root,{count:1200,coldCount:0}),report=path.join(root,'report'),appRoot=path.join(root,'app');await fs.mkdir(report);await fs.mkdir(path.join(appRoot,'electron'),{recursive:true});
 await fs.writeFile(path.join(fixture.profile,'semantic-plugin.json'),JSON.stringify({enabled:true}));
 const sourceRoot=process.env.PIGEON_SEMANTIC_SOURCE_ROOT||path.resolve(__dirname,'../..'),python=path.join(fixture.profile,'python');await fs.writeFile(python,'');await fs.writeFile(path.join(fixture.profile,'semantic-runtime.json'),JSON.stringify({python}));await fs.writeFile(path.join(fixture.profile,'library.db.semantic-settings.json'),JSON.stringify({automatic:false}));
 await fs.copyFile(path.join(sourceRoot,'package.json'),path.join(appRoot,'package.json'));
 await fs.writeFile(path.join(appRoot,'electron/main.js'),`require(${JSON.stringify(path.resolve('tests/fixtures/semantic-engine-stub.cjs'))});require(${JSON.stringify(path.join(sourceRoot,'electron/semantic-governor.js'))}).createSemanticGovernor=()=>({close(){}});const t=require('node:worker_threads'),p=require('node:path'),W=t.Worker;t.Worker=class extends W{constructor(file,options){super(p.basename(String(file))==='semantic-host-worker.js'?${JSON.stringify(path.resolve('tests/fixtures/semantic-host-worker.cjs'))}:file,options);}};require(${JSON.stringify(path.join(sourceRoot,'electron/main.js'))});`);
 const previous=process.env.PIGEON_E2E_APP_ROOT;process.env.PIGEON_E2E_APP_ROOT=appRoot;let app;
 try{
  app=await launch(fixture.profile,report);await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending");
  await app.evaluate("globalThis.__uiHeartbeat={last:performance.now(),max:0,ticks:0};globalThis.__uiTimer=setInterval(()=>{const now=performance.now();__uiHeartbeat.max=Math.max(__uiHeartbeat.max,now-__uiHeartbeat.last);__uiHeartbeat.last=now;__uiHeartbeat.ticks++;},16);void(globalThis.__analysis=window.pigeon.semanticStart({scope:{type:'folder',id:'cached-root'}}));");
  const samples=await app.evaluate("(async()=>{const samples=[];for(let i=0;i<70;i++){const start=performance.now();await window.pigeon.listBackgroundThreads();samples.push(performance.now()-start);await new Promise(resolve=>setTimeout(resolve,12));}return samples;})()");
  await app.evaluate('window.__analysis');await app.wait("window.pigeon.semanticStatus().then(s=>s.state==='idle'&&s.indexed===1202)",10000);
  const status=await app.evaluate('window.pigeon.semanticStatus()'),heartbeat=await app.evaluate('clearInterval(__uiTimer);__uiHeartbeat'),maximum=Math.max(...samples),sorted=[...samples].sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)];
  const result={assets:1202,coordinatorThreadId:status.coordinatorThreadId,maxMainIpcMs:maximum,p95MainIpcMs:p95,rendererHeartbeatMaxMs:heartbeat.max,rendererHeartbeatTicks:heartbeat.ticks,simulatedCoordinatorCpuBurstsMs:[400,180],modelInference:'stubbed; tests coordinator isolation, not model quality'};await fs.writeFile(path.join(report,'result.json'),JSON.stringify(result,null,2));
  assert(maximum<200,`Analysis blocked foreground IPC for ${maximum.toFixed(1)}ms`);assert(status.coordinatorThreadId>0);assert(heartbeat.max<200);assert.deepEqual(app.errors,[]);console.log('Background analysis keeps foreground IPC and rendering responsive:',JSON.stringify(result),report);
 }finally{await app?.close();if(previous===undefined)delete process.env.PIGEON_E2E_APP_ROOT;else process.env.PIGEON_E2E_APP_ROOT=previous;}
})().catch(error=>{console.error(error);process.exitCode=1;});
