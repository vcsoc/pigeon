'use strict';
const path=require('node:path');
const {Worker}=require('node:worker_threads');
function createDatabaseTelemetry({getContext,maxAgeMs=10000,timeoutMs=25000}){
 let cached=null,flight=null,closed=false;const workers=new Set();
 function get({force=false}={}){
  const context=getContext();if(closed||!context?.databaseFile)return Promise.resolve({unavailable:true});
  if(flight?.key===context.databaseFile)return flight.promise;
  if(!force&&cached?.key===context.databaseFile&&Date.now()-cached.result.timestamp<maxAgeMs)return Promise.resolve(cached.result);
  const entry={key:context.databaseFile,promise:null};entry.promise=new Promise(resolve=>{
   const worker=new Worker(path.join(__dirname,'database-telemetry-worker.js'),{workerData:(()=>{const{getExcludedIds,...data}=context;return{...data,excludedIds:getExcludedIds?getExcludedIds():data.excludedIds};})(),resourceLimits:{maxOldGenerationSizeMb:192}});workers.add(worker);let finished=false;
   const finish=result=>{if(finished)return;finished=true;clearTimeout(timer);workers.delete(worker);void worker.terminate();if(flight===entry)flight=null;cached={key:entry.key,result};resolve(result);};
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
