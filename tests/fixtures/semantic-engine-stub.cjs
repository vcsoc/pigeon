'use strict';
const cp=require('node:child_process'),path=require('node:path'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream'),{threadId}=require('node:worker_threads');
require('../../electron/semantic-governor').createSemanticGovernor=()=>({close(){}});
const spawn=cp.spawn,exec=cp.execFile;
cp.execFile=(command,args,options,callback)=>command==='systemctl'&&args.some(value=>String(value).startsWith('pigeon-semantic-'))?setImmediate(()=>callback(null,'','')):exec(command,args,options,callback);
let pending=[],count=0,done=new Set();
cp.spawn=(command,args,options)=>{
 if(![command,...args].some(value=>path.basename(String(value))==='python'||String(value).endsWith('semantic-engine.py')))return spawn(command,args,options);
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.pid=99999999;child.kill=()=>setImmediate(()=>child.emit('exit',0));
 if(args.some(value=>String(value).endsWith('semantic-engine.py'))){
  child.stdin={write(value,callback){
   const request=JSON.parse(value);let result;
   const info=()=>({indexed:count-pending.filter(id=>!done.has(id)).length,limited:0,vectors:count,coordinatorThreadId:threadId});
   if(request.action==='prune'){const until=Date.now()+400;while(Date.now()<until){}count=Object.keys(request.assets).length;pending=Object.keys(request.assets).slice(0,4);result=info();}
   else if(request.action==='plan')result={pending:pending.filter(id=>!done.has(id))};
   else if(request.action==='index_batch'){const until=Date.now()+180;while(Date.now()<until){}for(const job of request.jobs)done.add(job.asset.id);result={results:request.jobs.map(job=>({id:job.asset.id,done:true})),info:info()};}
   else if(request.action==='search')result={results:Object.keys(request.assets).slice(0,10).map(id=>({id,score:1})),indexed:count};
   else result=info();
   setTimeout(()=>child.stdout.write(JSON.stringify({id:request.id,result})+'\n'),request.action==='search'?80:0);callback?.();
  }};
  setImmediate(()=>child.stdout.write('{"ready":true}\n'));
 }else setImmediate(()=>child.emit('exit',0));
 return child;
};
