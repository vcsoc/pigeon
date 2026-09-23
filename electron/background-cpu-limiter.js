'use strict';

// Cooperative budget for CPU-only background worker threads. A thread cannot
// control work performed by Sharp, ffmpeg, Chromium or the GPU.
function createBackgroundCpuLimiter({dutyCycle=0.08,now=()=>performance.now(),usage=()=>typeof process.threadCpuUsage==='function'?process.threadCpuUsage():process.cpuUsage(),sleep=(ms)=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms),cancelled=()=>false,startedAt=null,initialUsage=null}={}){
  const fraction=Math.max(0.01,Math.min(0.12,Number(dutyCycle)||0.08));
  let started=startedAt===null?now():startedAt,baseline=initialUsage||usage();
  return function checkpoint(){
    if(cancelled())throw new Error('Background comparison cancelled');
    const current=usage(),elapsed=Math.max(0,now()-started),cpuMs=Math.max(0,(current.user-baseline.user+current.system-baseline.system)/1000);
    let rest=Math.max(0,Math.ceil(cpuMs/fraction-elapsed));
    if(rest){while(rest){sleep(Math.min(rest,100));if(cancelled())throw new Error('Background comparison cancelled');rest=Math.max(0,Math.ceil(cpuMs/fraction-(now()-started)));}started=now();baseline=usage();}
    else if(elapsed>250){started=now();baseline=current;}
    if(cancelled())throw new Error('Background comparison cancelled');
  };
}
module.exports={createBackgroundCpuLimiter};
