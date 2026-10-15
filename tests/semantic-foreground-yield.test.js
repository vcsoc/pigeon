'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream'),cp=require('node:child_process');
const {describe}=require('../src/semantic-analysis-status');
test('foreground wait displays saved analysis rather than an inactivity wait',()=>{
 const result=describe({state:'waiting',mode:'manual',waitReason:'foreground',total:100,completed:96});assert.equal(result.kind,'foreground');assert.match(result.title,/Prioritizing thumbnails/);assert.match(result.barLabel,/96% saved/);assert.match(result.hint,/resumes automatically/);
});
test('even manually started analysis yields to thumbnails and its active worker can be suspended',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pigeon-foreground-yield-')),python=path.join(root,'python');fs.writeFileSync(python,'');fs.writeFileSync(path.join(root,'semantic-runtime.json'),JSON.stringify({python}));
 const originalSpawn=cp.spawn,originalExec=cp.execFile,moduleFile=require.resolve('../electron/semantic-service'),governors=[],statuses=[];let service,busy=true,releaseBatch;
 cp.execFile=(command,args,options,callback)=>setImmediate(()=>callback(null,'',''));
 cp.spawn=(command,args)=>{const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.pid=99999999;child.kill=()=>{};
  if(args.some(value=>String(value).endsWith('semantic-engine.py'))){child.stdin={write(line,callback){const request=JSON.parse(line),reply=result=>child.stdout.write(JSON.stringify({id:request.id,result})+'\n');if(request.action==='index_batch')releaseBatch=()=>reply({info:{indexed:1},results:[{id:'a',done:true}]});else setImmediate(()=>reply(request.action==='plan'?{pending:['a']}:{indexed:0,limited:0,vectors:0}));callback?.();}};setImmediate(()=>child.stdout.write('{"ready":true}\n'));}else setImmediate(()=>child.emit('exit',0));return child;};
 t.after(()=>{service?.close();cp.spawn=originalSpawn;cp.execFile=originalExec;delete require.cache[moduleFile];fs.rmSync(root,{recursive:true,force:true});});delete require.cache[moduleFile];
 service=require(moduleFile).createSemanticService({userData:root,getContext:()=>({portfolioId:'p',databaseFile:path.join(root,'library.db')}),getAssets:()=>[{id:'a',path:'/a.txt',name:'a.txt',kind:'document',size:1,modified:1}],getIdleSeconds:()=>600,isForegroundBusy:()=>busy,createGovernor:options=>{governors.push(options);return{close(){}};},emit:status=>statuses.push(status)});
 await service.start();assert(statuses.some(status=>status.waitReason==='foreground'));assert.equal(governors.length,0,'foreground work must prevent model/index startup');
 busy=false;await service.continueAnalysis();for(let n=0;n<100&&!releaseBatch;n++)await new Promise(resolve=>setTimeout(resolve,10));assert(releaseBatch);const governor=governors.at(-1);assert.equal(governor.getMode(),'manual');assert.equal(governor.isPaused(),false);busy=true;assert.equal(governor.isPaused(),true,'manual analysis must still yield its active worker to thumbnails');busy=false;assert.equal(governor.isPaused(),false);releaseBatch();
 for(let n=0;n<100&&!statuses.some(status=>status.state==='idle'&&/analysis complete/i.test(status.detail));n++)await new Promise(resolve=>setTimeout(resolve,10));assert(statuses.some(status=>status.state==='idle'&&/analysis complete/i.test(status.detail)));
});
