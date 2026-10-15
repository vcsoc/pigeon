'use strict';
const path=require('node:path');

function createWatchFileQueue({apply,isActive=()=>true,onError=()=>{},delay=250,batchSize=64,setTimer=setTimeout,clearTimer=clearTimeout,keyFor=value=>path.resolve(value)}={}){
  const pending=new Map(),versions=new Map();let timer=null,running=false,closed=false,sequence=0;
  const active=()=>!closed&&isActive();
  function arm(wait=delay){if(timer!==null)clearTimer(timer);if(!active())return;timer=setTimer(()=>{timer=null;void flush();},wait);}
  function enqueue(type,filePath,stat,attempt=0,wait=0){if(!active())return;const key=keyFor(filePath),version=++sequence;versions.set(key,version);pending.set(key,{type,path:path.resolve(filePath),stat,key,version,attempt});arm(Math.max(delay,attempt?250*2**attempt:0,wait));}
  function retry(event,{defer=false}={}){if(active()&&versions.get(event.key)===event.version&&(defer||event.attempt<3))enqueue(event.type,event.path,event.stat,defer?event.attempt:event.attempt+1,defer?1000:0);}
  async function flush(){if(running||!active())return;running=true;const batch=[...pending.values()].slice(0,batchSize);for(const event of batch)pending.delete(event.key);
    try{if(batch.length)await apply(batch,event=>active()&&versions.get(event.key)===event.version,retry);}
    catch(error){onError(error,batch);}
    finally{for(const event of batch)if(versions.get(event.key)===event.version)versions.delete(event.key);running=false;if(pending.size&&active())arm(0);}
  }
  function close(){closed=true;if(timer!==null)clearTimer(timer);timer=null;pending.clear();versions.clear();}
  return{enqueue,flush,close};
}
module.exports={createWatchFileQueue};
