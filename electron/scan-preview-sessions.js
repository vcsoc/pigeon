const {createIncrementalWorkQueue}=require('./incremental-work-queue');
function createScanPreviewSessions({begin,isActive,finish,processItem,onProgress=()=>{},onError=()=>{},maxConcurrency=2}){
  const records=new WeakMap();
  function close(record){if(record.closing)return;record.closing=true;record.queue.close();if(records.get(record.location)===record)records.delete(record.location);finish(record.run);}
  return {open(scanRun,location,{retryCompleted=false}={}){let record=null,released=false;return{
    add(jobs){if(released||!jobs.length||!isActive(scanRun))return;
      if(!record){record=records.get(location);if(record&&!isActive(record.run))record=null;if(!record){const run=begin(location);if(!run)return;record={run,location,users:new Set(),completed:0,total:0,closing:false,queue:null};const owner=record;record.queue=createIncrementalWorkQueue({maxConcurrency,isActive:()=>isActive(run),processItem:job=>isActive(job.scanRun)?processItem({...job,previewRun:run}):undefined,onError,onProgress:progress=>{owner.completed=progress.completed;owner.total=progress.total;onProgress(owner,progress);if(!owner.users.size&&(owner.completed===owner.total||!isActive(owner.run))&&!owner.closing)close(owner);}});records.set(location,record);}record.users.add(scanRun);}
      record.queue.add(jobs.map(job=>({...job,scanRun})),{retryCompleted});
    },
    has:(id,version)=>Boolean(record?.queue.has(id,version)),
    // Release the producer, not the workers: later scans can discover files immediately.
    finish(){if(released)return;released=true;if(record){record.users.delete(scanRun);if(!record.users.size&&(record.completed===record.total||!isActive(record.run)))close(record);}}
  };}};
}
module.exports={createScanPreviewSessions};
