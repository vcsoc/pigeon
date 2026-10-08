"use strict";
const fs=require('node:fs'),os=require('node:os');
const {budget,systemCpuDelta}=require('./semantic-policy');
function availableMemory(){try{return Number(fs.readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\s+(\d+)/m)?.[1])*1024||os.freemem();}catch{return os.freemem();}}
function linuxProcessSample(pid,seen=new Set()){
  if(seen.has(pid))return{ticks:0,rss:0};seen.add(pid);
  try{const text=fs.readFileSync(`/proc/${pid}/stat`,'utf8'),parts=text.slice(text.lastIndexOf(')')+2).split(' ');let ticks=Number(parts[11])+Number(parts[12])+Number(parts[13])+Number(parts[14]),rss=Number(fs.readFileSync(`/proc/${pid}/status`,'utf8').match(/^VmRSS:\s+(\d+)/m)?.[1]||0)*1024;
    const children=fs.readFileSync(`/proc/${pid}/task/${pid}/children`,'utf8').trim().split(/\s+/).filter(Boolean);
    for(const child of children){const sample=linuxProcessSample(Number(child),seen);ticks+=sample.ticks;rss+=sample.rss;}return{ticks,rss};
  }catch{return{ticks:0,rss:0};}
}
function createSemanticGovernor({child,getMode=()=> 'automatic',getBudget=null,pauseOnActivity=()=>true,isPaused=()=>false,isBusy=()=>false,onSample=()=>{},onMemoryLimit=()=>{},clockTicks=100,intervalMs=100}={}){
  let previous=os.cpus(),closed=false,suspended=false,busy=0,previousTime=Date.now(),previousSample=linuxProcessSample(child.pid),debt=0;
  const signal=(pause)=>{if(closed||pause===suspended)return;suspended=pause;try{if(process.platform==='linux')process.kill(-child.pid,pause?'SIGSTOP':'SIGCONT');else if(process.platform!=='win32')child.kill(pause?'SIGSTOP':'SIGCONT');}catch{}};
  const timer=setInterval(()=>{
    if(closed||child.exitCode!==null)return;const current=os.cpus(),delta=systemCpuDelta(previous,current);previous=current;if(delta!==null)busy=delta;
    const p=getBudget?getBudget():budget(getMode()),now=Date.now(),elapsed=Math.max(1,now-previousTime),sample=linuxProcessSample(child.pid),cpuMs=Math.max(0,sample.ticks-previousSample.ticks)*1000/clockTicks;
    previousTime=now;previousSample=sample;debt=Math.max(0,debt+cpuMs-p.cpu*p.cores*elapsed);
    if(sample.rss>p.memoryBytes){signal(false);onMemoryLimit(new Error(`Semantic engine exceeded its ${Math.round(p.memory*100)}% memory budget; indexing stopped.`));return;}
    const pressure=availableMemory()<Math.max(512*1024*1024,p.memoryBytes*0.2),activityBlocked=pauseOnActivity()&&(isBusy()||busy>p.busy),blocked=isPaused()||activityBlocked||pressure;
    signal(blocked||debt>p.cpu*p.cores*intervalMs);
    onSample({cpuPercent:Math.round(cpuMs/elapsed/p.cores*1000)/10,systemCpuPercent:Math.round(busy*100),memoryBytes:sample.rss,cpuLimitPercent:p.cpu*100,memoryLimitBytes:p.memoryBytes,waiting:blocked,activityBlocked,memoryPressure:pressure,suspended});
  },intervalMs);timer.unref();
  return{close(){signal(false);closed=true;clearInterval(timer);},resume(){signal(false);}};
}
module.exports={createSemanticGovernor,linuxProcessSample,availableMemory};
