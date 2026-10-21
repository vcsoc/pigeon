'use strict';
const {performance}=require('node:perf_hooks');
function sampleWorkerResources(entry,{now=()=>performance.now()}={}){
  if(entry.resourceSampling)return entry.resourceSampling;
  entry.resourceSampling=(async()=>{
    const read=method=>typeof entry.worker[method]==='function'?Promise.resolve().then(()=>entry.worker[method]()).catch(()=>null):Promise.resolve(null);
    const [usage,heap]=await Promise.all([read('cpuUsage'),read('getHeapStatistics')]),time=now(),previous=entry.resourceCpuBaseline;
    let cpu=null;
    if(usage&&Number.isFinite(usage.user)&&Number.isFinite(usage.system)){
      if(previous&&time>previous.time){const elapsed=time-previous.time,delta=usage.user+usage.system-previous.usage.user-previous.usage.system;if(delta>=0)cpu=Math.min(100,delta/1000/elapsed*100);}
      // cpuUsage() is cumulative. Never store a delta as the next baseline.
      entry.resourceCpuBaseline={time,usage};
    }
    const bytes=heap?.used_heap_size??heap?.usedHeapSize;
    return {cpu,cpuSource:cpu===null?'unavailable':'thread-cpu',memoryBytes:Number.isFinite(bytes)&&bytes>=0?bytes:null};
  })().finally(()=>{entry.resourceSampling=null;});
  return entry.resourceSampling;
}
module.exports={sampleWorkerResources};
