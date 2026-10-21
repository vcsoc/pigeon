'use strict';
const path=require('node:path');
const {Worker}=require('node:worker_threads');
const {execFile}=require('node:child_process');
const {admissible}=require('./semantic-policy');
const FIELDS=['id','path','kind','size','modified','name','filename','note','tags','collectionIds','locationId','contentHash','editedPath','editedAt','editedPreviewPath','proxyPath','thumbnailPath','deletedAt','sourceMissing','sourcePending','locked','encrypted','extension','rating','favorite','thumbnailEffect'];
function assetRecord(asset){const imageExtensions=new Set(['.png','.jpg','.jpeg','.webp','.gif','.bmp','.tif','.tiff']);return{id:asset.id,path:asset.path,kind:asset.kind,size:asset.size,modified:asset.modified,name:asset.name||asset.filename,note:asset.note||'',tags:Array.isArray(asset.tags)?[...asset.tags]:[],imagePath:asset.kind==='image'?(asset.editedPath||asset.editedPreviewPath||asset.proxyPath||(!imageExtensions.has(path.extname(asset.path).toLowerCase())?asset.thumbnailPath:null)||asset.path):null};}
function createSemanticHost({userData,ffmpeg,getContext,getAssets,getAsset,isAvailable=()=>true,getMetadata=()=>({}),getIdleSeconds=()=>0,getIdleMinutes=()=>10,isForegroundBusy=()=>false,emit=()=>{},report=()=>{},registerPause=()=>()=>{},diagnostic=()=>{},workerFile=path.join(__dirname,'semantic-host-worker.js')}){
  const worker=new Worker(workerFile,{workerData:{userData,ffmpeg},resourceLimits:{maxOldGenerationSizeMb:512,maxYoungGenerationSizeMb:64}});worker.unref();
  let generation=0,sequence=0,closed=false,closing=false,contextKey='',source=null,synchronizing=null,lastStatus={state:'waiting',detail:'Preparing background analysis.',total:0,completed:0},engine=null,failure=null;
  const pending=new Map(),revisions=new Map(),changes=new Set(),pauseHandlers=new Map();let flushScheduled=false;
  const post=message=>worker.postMessage({...message,generation});
  function killDetached(){if(engine?.scopeName)execFile('systemctl',['--user','kill','--signal=SIGKILL',engine.scopeName],{timeout:3000},()=>{});if(engine?.pid)try{process.platform==='win32'?process.kill(engine.pid):process.kill(-engine.pid,'SIGKILL');}catch{}engine=null;}
  function rejectPending(error){for(const job of pending.values()){clearTimeout(job.timer);job.reject(error);}pending.clear();}
  worker.on('error',error=>{failure=error;killDetached();rejectPending(error);diagnostic('error','Semantic coordinator worker failed',error.message);});
  worker.on('exit',code=>{killDetached();if(!closed){failure=Error(`Semantic coordinator exited (${code})`);rejectPending(failure);}});
  worker.on('message',message=>{
    if(message.type==='engine'){engine=message.value;return;}
    if(message.generation!==generation)return;
    if(message.type==='status'){if(message.value.portfolioId!=null&&message.value.portfolioId!==getContext()?.portfolioId)return;lastStatus=message.value;emit(lastStatus);return;}
    if(message.type==='report'){report(message.id,message.value);return;}
    if(message.type==='diagnostic'){diagnostic(...message.args);return;}
    if(message.type==='register-pause'){pauseHandlers.get(message.id)?.();pauseHandlers.set(message.id,registerPause(message.id,value=>{void call('pause',[value]).catch(()=>{});}));return;}
    if(message.type==='unregister-pause'){pauseHandlers.get(message.id)?.();pauseHandlers.delete(message.id);return;}
    const job=pending.get(message.id);if(!job)return;
    if(message.type==='result-start'){job.value={...message.value,results:[]};return;}
    if(message.type==='result-batch'){job.value.results.push(...message.items);return;}
    pending.delete(message.id);clearTimeout(job.timer);
    if(message.error)job.reject(Error(message.error));else job.resolve(message.type==='result-end'?job.value:message.value);
  });
  function rpc(method,args=[],timeout=600000){if(failure)return Promise.reject(failure);return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Semantic coordinator request timed out'));},timeout);timer.unref();pending.set(id,{resolve,reject,timer});post({type:'call',id,method,args});});}
  function signals(){return{idleSeconds:getIdleSeconds(),idleMinutes:getIdleMinutes(),foregroundBusy:isForegroundBusy()};}
  function row(asset){const item={};for(const field of FIELDS)if(asset[field]!==undefined)item[field]=asset[field];item._semanticRevision=revisions.get(asset.id)||0;return item;}
  // Keep main-loop copies bounded; portfolio planning and JSON serialization stay in the worker.
  async function synchronize(){
    if(closed||closing)throw Error('Pigeon is closing');if(failure)throw failure;
    const context=getContext(),assets=getAssets(),key=JSON.stringify([context?.portfolioId,context?.databaseFile,context?.loading,context?.accessKey]);
    if(synchronizing){await synchronizing.catch(()=>{});return synchronize();}
    if(key===contextKey&&source===assets)return;
    const token=++generation;contextKey=key;source=assets;rejectPending(Error('Portfolio changed'));post({type:'begin',context,metadata:getMetadata(),signals:signals()});
    synchronizing=(async()=>{for(let index=0;index<assets.length;){if(token!==generation||closed||closing)throw Error('Portfolio changed');const rows=[],ids=[],start=Date.now();do{const asset=assets[index++];ids.push(asset.id);if(isAvailable(asset))rows.push(row(asset));}while(index<assets.length&&rows.length<64&&ids.length<128&&Date.now()-start<3);post({type:'batch',rows,ids});await new Promise(resolve=>setImmediate(resolve));}if(token!==generation||closed||closing)throw Error('Portfolio changed');post({type:'commit'});})().finally(()=>{synchronizing=null;flushChanges();});
    return synchronizing;
  }
  function flushChanges(){flushScheduled=false;if(closed||closing||synchronizing)return;const items=[];for(const id of changes){changes.delete(id);const asset=getAsset(id);items.push(asset?{id,member:true,asset:isAvailable(asset)?row(asset):null}:{id,member:false});if(items.length>=64)break;}if(items.length)post({type:'changes',items});if(changes.size){flushScheduled=true;setImmediate(flushChanges);}}
  function assetsChanged(assets){for(const asset of Array.isArray(assets)?assets:[assets])if(asset?.id){revisions.set(asset.id,(revisions.get(asset.id)||0)+1);changes.add(asset.id);}if(!flushScheduled){flushScheduled=true;setImmediate(flushChanges);}}
  async function call(method,args=[]){await synchronize();if(closed||closing)throw Error('Pigeon is closing');post({type:'metadata',metadata:getMetadata(),signals:signals()});flushChanges();return rpc(method,args);}
  function stop(){generation++;contextKey='';source=null;changes.clear();lastStatus={...lastStatus,state:'paused',portfolioId:null};rejectPending(Error('Portfolio work stopped'));post({type:'stop'});}
  function refreshVisibility(){stop();void synchronize().catch(error=>{if(!closed&&!closing)diagnostic('warning','Semantic visibility refresh deferred',error.message);});}
  const ticker=setInterval(()=>{if(closed||closing)return;post({type:'metadata',metadata:getMetadata(),signals:signals()});void synchronize().catch(()=>{});},750);ticker.unref();
  // Acknowledge checkpoint cleanup before Electron terminates the coordinator.
  function close(){if(closed)return Promise.resolve();if(closing)return closing;clearInterval(ticker);closing=rpc('close',[],2500).catch(()=>{killDetached();}).finally(async()=>{closed=true;rejectPending(Error('Pigeon is closing'));for(const remove of pauseHandlers.values())remove();pauseHandlers.clear();await worker.terminate();});return closing;}
  const host={getStatus:()=>call('getStatus'),peekStatus:()=>lastStatus,configure:input=>call('configure',[input]),start:input=>call('start',[input]),pause:value=>call('pause',[value]),continueAnalysis:()=>call('continueAnalysis'),setup:()=>call('setup'),assetsChanged,refreshVisibility,refreshContext:()=>{void synchronize().catch(()=>{});},stop,close,assetRecord,
    async search(input){await synchronize();const token=generation,result=await call('search',[input]);if(token!==generation)throw Error('Portfolio changed during search');const results=[];for(let index=0;index<result.results.length;index++){const item=result.results[index],asset=getAsset(item.id);if(asset&&admissible(asset)&&isAvailable(asset)&&(revisions.get(item.id)||0)===item.sourceRevision){const {sourceRevision,...match}=item;results.push({...match,asset});}if(index%128===127)await new Promise(resolve=>setImmediate(resolve));}return{...result,results};}};
  void synchronize().catch(error=>diagnostic('warning','Semantic coordinator initialization delayed',error.message));return host;
}
module.exports={createSemanticHost,assetRecord};
