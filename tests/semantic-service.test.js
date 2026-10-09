const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream'),cp=require('node:child_process');

test('concurrent operations share automatic preparation and recover a broken configured runtime',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pigeon-semantic-prepare-')),broken=path.join(root,'broken-python');fs.writeFileSync(broken,'broken');
 const originalSpawn=cp.spawn,originalExec=cp.execFile,originalPython=process.env.PIGEON_SEMANTIC_PYTHON;process.env.PIGEON_SEMANTIC_PYTHON=broken;
 const launches=[],requests=[];let healthChecks=0,service,holdPlans=false;
 cp.execFile=(command,args,options,callback)=>{queueMicrotask(()=>callback(null,'uv 1.0'));return new EventEmitter();};
 cp.spawn=(command,args,options)=>{
  const actual=args.includes('--')?args.slice(args.indexOf('--')+1):[command,...args],child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.exitCode=null;child.kill=()=>{child.exitCode=0;child.emit('exit',0);};launches.push({actual,args,options});
  if(actual.includes('-c')){healthChecks++;setTimeout(()=>{const code=actual[0]===broken?1:0;if(code)child.stderr.write('No module named torch');child.exitCode=code;child.emit('exit',code);},15);}
  else if(actual.includes('venv')){const python=path.join(actual.at(-1),'bin/python');fs.mkdirSync(path.dirname(python),{recursive:true});fs.writeFileSync(python,'healthy');setTimeout(()=>child.emit('exit',0),5);}
  else if(actual.includes('pip'))setTimeout(()=>child.emit('exit',0),5);
  else {child.stdin={write(line,callback){const message=JSON.parse(line);requests.push(message);if(holdPlans&&message.action==='plan'){callback?.();return;}const result=message.action==='search'?{results:[],totalMatches:0,indexed:0}:message.action==='plan'?{pending:[]}:{indexed:0,vectors:0};queueMicrotask(()=>{child.stdout.write(JSON.stringify({id:message.id,result})+'\n');callback?.();});}};queueMicrotask(()=>child.stdout.write('{"ready":true}\n'));}
  return child;
 };
 try{
  delete require.cache[require.resolve('../electron/semantic-service')];const {createSemanticService}=require('../electron/semantic-service');service=createSemanticService({userData:root,getContext:()=>({portfolioId:'one',databaseFile:path.join(root,'library.db'),loading:false}),getAssets:()=>[],getIdleSeconds:()=>600,createGovernor:()=>({close(){}})});
  const status=await service.getStatus();assert.equal(status.state,'setup');
  const [started,result]=await Promise.all([service.start(),service.search({query:'bird'})]);assert.equal(started.runtimeReady,true);assert.deepEqual(result.results,[]);
  assert.equal(launches.filter(l=>l.actual.includes('venv')).length,1);assert.equal(launches.filter(l=>l.actual[0]===broken&&l.actual.includes('-c')).length,1);assert.ok(launches.some(l=>l.actual.includes('pip')));
  const checked=healthChecks;await service.search({query:'another bird',all:true});assert.equal(requests.find(message=>message.action==='search'&&message.query==='another bird').all,true);assert.equal(requests.find(message=>message.action==='search'&&message.query==='bird').all,false);await service.getStatus();assert.equal(healthChecks,checked,'healthy installation is reused rather than reinstalling on each search');
  if(process.platform==='linux'&&fs.existsSync('/usr/bin/systemd-run'))for(const launch of launches.filter(l=>l.actual.includes('-c')||l.actual.includes('pip')))assert.ok(launch.args.some(a=>a.startsWith('CPUQuota='))&&launch.args.some(a=>a.startsWith('MemoryMax=')),'preparation receives kernel CPU and RAM limits');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'semantic-runtime.json'))).python,path.join(root,'semantic-runtime/bin/python'));
  assert.equal((await service.getStatus()).resourcePercent,15);
  holdPlans=true;await service.configure({automatic:false,resourcePercent:22});await service.start({portfolioId:'one',priorityIds:['priority']});service.pause(true);assert.equal((await service.configure({resourcePercent:22})).paused,true,'changing resource limits does not resume a paused scan');
  const saved=JSON.parse(fs.readFileSync(path.join(root,'library.db.semantic-settings.json')));assert.equal(saved.resumeRequested,true);assert.equal(saved.paused,true);assert.equal(saved.resourcePercent,22);assert.deepEqual(saved.priorityIds,['priority']);
  service.close();service=createSemanticService({userData:root,getContext:()=>({portfolioId:'one',databaseFile:path.join(root,'library.db'),loading:false}),getAssets:()=>[],createGovernor:()=>({close(){}})});const resumed=await service.getStatus();assert.equal(resumed.mode,'manual');assert.equal(resumed.paused,true);assert.equal(resumed.automatic,false);assert.equal(resumed.resourcePercent,22);service.pause(false);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'library.db.semantic-settings.json'))).paused,false);
 }finally{service?.close();cp.spawn=originalSpawn;cp.execFile=originalExec;if(originalPython===undefined)delete process.env.PIGEON_SEMANTIC_PYTHON;else process.env.PIGEON_SEMANTIC_PYTHON=originalPython;fs.rmSync(root,{recursive:true,force:true});}
});
