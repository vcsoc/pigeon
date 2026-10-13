'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream'),cp=require('node:child_process');

test('analysis keeps its batch label between checkpoint updates and clears it on completion',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pigeon-panel-stability-')),python=path.join(root,'python');
  fs.writeFileSync(python,'');fs.writeFileSync(path.join(root,'semantic-runtime.json'),JSON.stringify({python}));
  const originalSpawn=cp.spawn,originalExec=cp.execFile,moduleFile=require.resolve('../electron/semantic-service'),statuses=[];
  let service,batches=0;
  cp.execFile=(command,args,options,callback)=>setImmediate(()=>callback(null,'',''));
  cp.spawn=(command,args)=>{
    const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.pid=99999999;child.kill=()=>{};
    if(args.some(value=>String(value).endsWith('semantic-engine.py'))){
      child.stdin={write(line,callback){
        const request=JSON.parse(line);
        let result={indexed:0,limited:0,vectors:0};
        if(request.action==='plan')result={pending:['a']};
        if(request.action==='index_batch'){batches++;result={info:{indexed:batches===2?1:0,limited:0,vectors:batches},results:[{id:'a',done:batches===2}]};}
        setImmediate(()=>child.stdout.write(JSON.stringify({id:request.id,result})+'\n'));callback?.();
      }};
      setImmediate(()=>child.stdout.write('{"ready":true}\n'));
    }else setImmediate(()=>child.emit('exit',0));
    return child;
  };
  t.after(()=>{service?.close();cp.spawn=originalSpawn;cp.execFile=originalExec;delete require.cache[moduleFile];fs.rmSync(root,{recursive:true,force:true});});
  delete require.cache[moduleFile];
  const {createSemanticService}=require(moduleFile);
  service=createSemanticService({userData:root,getContext:()=>({portfolioId:'one',databaseFile:path.join(root,'library.db')}),getAssets:()=>[{id:'a',path:'/a.txt',name:'a.txt',kind:'document',size:1,modified:1}],getIdleSeconds:()=>600,createGovernor:()=>({close(){}}),emit:status=>statuses.push(status)});
  await service.start();
  for(let n=0;n<100&&!statuses.some(status=>status.state==='idle'&&/analysis complete/i.test(status.detail));n++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(batches,2);
  const first=statuses.findIndex(status=>status.state==='indexing'&&status.current==='a.txt');assert(first>=0);
  for(const status of statuses.slice(first).filter(status=>status.state==='indexing')){
    assert.equal(status.current,'a.txt','checkpoint notifications must not blank the current-file row');assert.deepEqual(status.activeFiles,['a.txt']);
  }
  const finished=statuses.at(-1);assert.equal(finished.state,'idle');assert.equal(finished.current,'');assert.deepEqual(finished.activeFiles,[]);
});
