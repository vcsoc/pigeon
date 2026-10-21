'use strict';
const path=require('node:path');
const {Worker}=require('node:worker_threads');
function createDatabaseTelemetry({getContext,maxAgeMs=300000,timeoutMs=25000}){
 let cached=null,flight=null,closed=false;const workers=new Set(),cacheKey=context=>JSON.stringify([context.databaseFile,context.accessKey||'']);
 function get({force=false}={}){
  const context=getContext();if(closed||!context?.databaseFile)return Promise.resolve({unavailable:true});
  const key=cacheKey(context);
  if(flight?.key===key)return flight.promise;
  if(!force&&cached?.key===key&&Date.now()-cached.result.timestamp<maxAgeMs)return Promise.resolve(cached.result);
  const entry={key,promise:null};entry.promise=new Promise(resolve=>{
   const worker=new Worker(path.join(__dirname,'database-telemetry-worker.js'),{workerData:(()=>{const{getExcludedIds,...data}=context;return{...data,excludedIds:getExcludedIds?getExcludedIds():data.excludedIds};})(),resourceLimits:{maxOldGenerationSizeMb:192}});workers.add(worker);let finished=false;
   const finish=result=>{if(finished)return;finished=true;clearTimeout(timer);workers.delete(worker);void worker.terminate();if(flight===entry)flight=null;const current=getContext();if(closed||!current?.databaseFile||cacheKey(current)!==entry.key){resolve({portfolioId:current?.portfolioId,unavailable:true});return;}cached={key:entry.key,result};resolve(result);};
   const failure=message=>finish({portfolioId:context.portfolioId,timestamp:Date.now(),error:message});
   const timer=setTimeout(()=>failure('Database inventory timed out; previous scans and original files are untouched.'),timeoutMs);timer.unref();
   worker.once('message',message=>message.result?finish(message.result):failure(message.error||'Inventory failed'));
   worker.once('error',error=>failure(error.message));worker.once('exit',code=>{if(!finished)failure(`Inventory worker stopped (${code})`);});
  });flight=entry;return entry.promise;
 }
 function close(){closed=true;for(const worker of workers)void worker.terminate();workers.clear();}
 return{get,close};
}
module.exports={createDatabaseTelemetry};
