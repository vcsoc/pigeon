"use strict";
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const {budget,systemCpuDelta}=require('./semantic-policy');
function availableMemory(){try{return Number(fs.readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\s+(\d+)/m)?.[1])*1024||os.freemem();}catch{return os.freemem();}}
function linuxProcessSample(pid,seen=new Set()){
  if(seen.has(pid))return{ticks:0,rss:0};seen.add(pid);
  try{const text=fs.readFileSync(`/proc/${pid}/stat`,'utf8'),parts=text.slice(text.lastIndexOf(')')+2).split(' ');let ticks=Number(parts[11])+Number(parts[12])+Number(parts[13])+Number(parts[14]),rss=Number(fs.readFileSync(`/proc/${pid}/status`,'utf8').match(/^VmRSS:\s+(\d+)/m)?.[1]||0)*1024;
    const children=fs.readFileSync(`/proc/${pid}/task/${pid}/children`,'utf8').trim().split(/\s+/).filter(Boolean);
    for(const child of children){const sample=linuxProcessSample(Number(child),seen);ticks+=sample.ticks;rss+=sample.rss;}return{ticks,rss};
  }catch{return{ticks:0,rss:0};}
}
function createProcessMonitor(child,python,onError){
  const script=path.join(__dirname,'semantic-resource-monitor.py').replace('app.asar'+path.sep,'app.asar.unpacked'+path.sep);
  const monitor=spawn(python,['-u',script,String(child.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let sample={ticks:0,rss:0},buffer='',errors='',closed=false;
  monitor.stdout.on('data',data=>{buffer+=data;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const next=JSON.parse(line);if(!Number.isFinite(next.ticks)||!Number.isFinite(next.rss))throw Error('Invalid worker resource sample');sample=next;}catch(error){if(!closed)onError(error);}}});
  monitor.stderr.on('data',data=>{errors=(errors+data).slice(-1000);});
  monitor.stdin.on('error',error=>{if(!closed)onError(error);});
  monitor.on('error',error=>{if(!closed)onError(error);});
  monitor.on('exit',()=>{if(!closed&&child.exitCode===null)onError(Error(errors||'Worker resource monitor stopped'));});
  const send=value=>{if(!closed)monitor.stdin.write(JSON.stringify(value)+'\n');};
  return{sample:()=>sample,signal:paused=>send({paused}),close(terminate=false){if(closed)return;send({close:true,terminate});closed=true;monitor.stdin.end();const timer=setTimeout(()=>monitor.kill(),2000);timer.unref();monitor.once('exit',()=>clearTimeout(timer));}};
}
function createSemanticGovernor({child,python=null,getMode=()=> 'automatic',getBudget=null,pauseOnActivity=()=>true,isPaused=()=>false,isBusy=()=>false,onSample=()=>{},onMemoryLimit=()=>{},onMonitorError=onMemoryLimit,getProcessSample=null,clockTicks=100,intervalMs=100}={}){
  const monitor=process.platform!=='linux'&&python&&!getProcessSample?createProcessMonitor(child,python,onMonitorError):null;
  const sampleProcess=getProcessSample||(monitor?monitor.sample:()=>linuxProcessSample(child.pid));
  let previous=os.cpus(),closed=false,suspended=false,busy=0,previousTime=Date.now(),previousSample=sampleProcess(),debt=0;
  const signal=pause=>{if(closed||pause===suspended)return;suspended=pause;try{if(process.platform==='win32')monitor?.signal(pause);else process.kill(-child.pid,pause?'SIGSTOP':'SIGCONT');}catch{}};
  const timer=setInterval(()=>{
    if(closed||child.exitCode!==null)return;const current=os.cpus(),delta=systemCpuDelta(previous,current);previous=current;if(delta!==null)busy=delta;
    const p=getBudget?getBudget():budget(getMode()),now=Date.now(),elapsed=Math.max(1,now-previousTime),sample=sampleProcess(),cpuMs=Math.max(0,sample.ticks-previousSample.ticks)*1000/clockTicks;
    previousTime=now;previousSample=sample;debt=Math.max(0,debt+cpuMs-p.cpu*p.cores*elapsed);
    if(sample.rss>p.memoryBytes){signal(false);onMemoryLimit(new Error(`Semantic engine exceeded its ${Math.round(p.memory*100)}% memory cap. Increase Resource limit and choose Analyze now to retry.`));return;}
    // Only automatic analysis waits for inactivity. The cap regulates actual
    // worker usage, never system free RAM or unrelated machine CPU activity.
    const activityBlocked=getMode()==='automatic'&&pauseOnActivity()&&isBusy(),blocked=isPaused()||activityBlocked;
    signal(blocked||debt>p.cpu*p.cores*intervalMs);
    onSample({cpuPercent:Math.round(cpuMs/elapsed/p.cores*1000)/10,systemCpuPercent:Math.round(busy*100),memoryBytes:sample.rss,cpuLimitPercent:p.cpu*100,memoryLimitBytes:p.memoryBytes,waiting:blocked,activityBlocked,memoryPressure:false,suspended});
  },intervalMs);timer.unref();
  return{close({terminate=false}={}){signal(false);closed=true;clearInterval(timer);monitor?.close(terminate);},resume(){signal(false);}};
}
module.exports={createSemanticGovernor,linuxProcessSample,availableMemory};
