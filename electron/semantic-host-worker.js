'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const {createSemanticService}=require('./semantic-service');
const {semanticPriorityPlan}=require('./semantic-priority');
let generation=0,loading=true,context={loading:true},metadata={},signals={idleSeconds:0,idleMinutes:10,foregroundBusy:true},assets=new Map(),members=new Set();
const send=message=>parentPort.postMessage({...message,generation});
const library=()=>({...metadata,assets:[...assets.values()]});
const service=createSemanticService({
 userData:workerData.userData,ffmpeg:workerData.ffmpeg,getContext:()=>context,
 getAssets:()=>[...assets.values()],getAsset:id=>assets.get(id),getAllAssetIds:()=>[...members],getLocations:()=>metadata.locations||[],resolveScope:scope=>semanticPriorityPlan(library(),scope),
 getIdleSeconds:()=>signals.idleSeconds||0,getIdleMinutes:()=>signals.idleMinutes||10,isForegroundBusy:()=>signals.foregroundBusy,
 emit:value=>send({type:'status',value}),report:(id,value)=>send({type:'report',id,value}),diagnostic:(...args)=>send({type:'diagnostic',args}),
 onEngine:value=>send({type:'engine',value}),
 registerPause:id=>{send({type:'register-pause',id});return()=>send({type:'unregister-pause',id});}
});
parentPort.on('message',async message=>{
 if(message.type==='begin'){generation=message.generation;service.stop();loading=Boolean(message.context?.loading);context={...message.context,loading:true};metadata=message.metadata;signals=message.signals;assets=new Map();members=new Set();return;}
 if(message.generation!==generation&&message.type!=='stop'&&message.method!=='close')return;
 if(message.type==='stop'){generation=message.generation;context={...context,loading:true};service.stop();assets.clear();members.clear();return;}
 if(message.type==='batch'){for(const id of message.ids)members.add(id);for(const asset of message.rows)assets.set(asset.id,asset);return;}
 if(message.type==='commit'){context={...context,loading};return;}
 if(message.type==='signals'){signals=message.value;return;}
 if(message.type==='metadata'){metadata=message.metadata;signals=message.signals;return;}
 if(message.type==='changes'){const changed=[];for(const item of message.items){if(item.member)members.add(item.id);else members.delete(item.id);if(item.asset)assets.set(item.id,item.asset);else assets.delete(item.id);changed.push(item.asset||{id:item.id});}service.assetsChanged(changed);return;}
 if(message.type!=='call')return;
 const token=generation,id=message.id;
 try{
  let args=message.args||[];
  if(message.method==='start'){const input=args[0]||{};args=[{...input,priorityPlan:input.priorityPlan||semanticPriorityPlan(library(),input.scope)}];}
  if(!['getStatus','configure','start','pause','continueAnalysis','setup','search','close'].includes(message.method))throw Error('Unknown semantic coordinator method');
  const value=await service[message.method](...args);
  if(token!==generation)return;
  if(message.method==='search'){
   const {results,...rest}=value;send({type:'result-start',id,value:rest});
   for(let offset=0;offset<results.length;offset+=128){if(token!==generation)return;send({type:'result-batch',id,items:results.slice(offset,offset+128).map(({asset,...match})=>({...match,sourceRevision:asset._semanticRevision||0}))});await new Promise(resolve=>setTimeout(resolve,1));}
   send({type:'result-end',id});
  }else send({type:'result',id,value});
 }catch(error){if(token===generation)send({type:'result',id,error:error.message});}
});
