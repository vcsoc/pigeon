"use strict";
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn,execFile}=require('node:child_process');
const {budget,systemCpuDelta,fingerprint,admissible}=require('./semantic-policy');
const {createSemanticGovernor,availableMemory}=require('./semantic-governor');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const REQUIREMENTS=['sentence-transformers==6.1.0','transformers==5.19.0','pillow==12.3.0','soundfile==0.14.0','psutil==7.2.2','pypdf==6.19.0','pypdfium2==5.9.0','python-docx==1.2.0','openpyxl==3.1.5'];
function createSemanticService({userData,getContext,getAssets,getAsset=null,isBusy=()=>false,ffmpeg,emit=()=>{},report=()=>{},registerPause=()=>()=>{},diagnostic=()=>{}}){
  let scopeName='',scopeMode='',searching=false,healthyPython='',runtimeOverride='',setupRetryAfter=0,setupScope='';
  let contextKey='',epoch=0,child=null,governor=null,ready=null,sequence=0,pending=new Map(),queue=[],draining=false,indexing=false,paused=false,manual=false,closed=false,setupPromise=null,setupChild=null,settings={automatic:true},info={indexed:0,limited:0,vectors:0},lastCpus=os.cpus(),systemBusy=1,waitingSamples=0,indexDone=false,releasePause=()=>{},lastSearch=Date.now();
  let status={state:'unavailable',detail:'The local engine will be checked and prepared automatically.',completed:0,total:0,current:'',error:'',resources:{}};
  const managed=path.join(userData,'semantic-runtime'),globalConfig=path.join(userData,'semantic-runtime.json');
  function runtimePython(){let configured='';try{configured=JSON.parse(fs.readFileSync(globalConfig,'utf8')).python||'';}catch{}const dev=path.join(__dirname,'..','.semantic-runtime',process.platform==='win32'?'Scripts/python.exe':'bin/python');return runtimeOverride||process.env.PIGEON_SEMANTIC_PYTHON||configured||(fs.existsSync(dev)?dev:path.join(managed,process.platform==='win32'?'Scripts/python.exe':'bin/python'));}
  function snapshot(){const context=getContext();return{...status,...info,portfolioId:context?.portfolioId,automatic:settings.automatic!==false,paused,mode:manual?'manual':'automatic',model:'EmbeddingGemma 2',runtimeReady:fs.existsSync(runtimePython()),policy:{automatic:{cpu:12,memory:12},manual:{cpu:18,memory:18}},systemCpuPercent:Math.round(systemBusy*100)};}
  function publish(patch={}){Object.assign(status,patch);emit(snapshot());}
  function killEngine(reason='Semantic work stopped'){
    governor?.close();governor=null;releasePause();releasePause=()=>{};const old=child;child=null;ready=null;
    for(const {reject,timer} of pending.values()){clearTimeout(timer);reject(Error(reason));}pending.clear();for(const job of queue.splice(0))job.reject(Error(reason));
    if(scopeName){execFile('systemctl',['--user','kill','--signal=SIGKILL',scopeName],{timeout:3000},()=>{});scopeName='';scopeMode='';}
    if(old?.pid)try{if(process.platform==='linux')process.kill(-old.pid,'SIGKILL');else old.kill('SIGKILL');}catch{}
  }
  function context(){const c=getContext();if(!c?.databaseFile||c.loading)return null;const key=JSON.stringify([c.portfolioId,c.databaseFile]);if(key!==contextKey){epoch++;killEngine('Portfolio changed');contextKey=key;paused=false;manual=false;indexDone=false;info={indexed:0,limited:0,vectors:0};settings={automatic:true};try{settings={...settings,...JSON.parse(fs.readFileSync(c.databaseFile+'.semantic-settings.json','utf8'))};}catch{}publish({state:'idle',completed:0,total:0,current:'',error:''});}return c;}
  function currentAssets(){return getAssets().filter(admissible);}
  function assetRecord(asset){const imageExtensions=new Set(['.png','.jpg','.jpeg','.webp','.gif','.bmp','.tif','.tiff']);return{id:asset.id,path:asset.path,kind:asset.kind,size:asset.size,modified:asset.modified,name:asset.name||asset.filename,note:asset.note||'',tags:asset.tags||[],imagePath:asset.kind==='image'?(asset.proxyPath||(!imageExtensions.has(path.extname(asset.path).toLowerCase())?asset.thumbnailPath:null)||asset.path):null};}
  function assetFingerprints(assets=currentAssets()){return Object.fromEntries(assets.map(a=>[a.id,fingerprint(a)]));}
  function startEngine(){
    if(ready)return ready;
    const c=context();if(!c)throw Error('Wait for the active portfolio to load');const python=runtimePython();if(!fs.existsSync(python))throw Error('The local engine runtime is missing');
    const p=budget(manual||searching?'manual':'automatic');let readyResolve,readyReject;const session=epoch;
    ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});ready.catch(()=>{});
    const engineArgs=['-u',path.join(__dirname,'semantic-engine.py').replace('app.asar'+path.sep,'app.asar.unpacked'+path.sep),c.databaseFile+'.semantic.sqlite3'];
    const hardCaps=process.platform==='linux'&&fs.existsSync('/usr/bin/systemd-run');
    scopeName=hardCaps?`pigeon-semantic-${process.pid}-${Date.now()}.scope`:'';scopeMode=manual||searching?'manual':'automatic';
    const launchArgs=hardCaps?['--user','--scope','--quiet','--collect',`--unit=${scopeName}`,'-p',`CPUQuota=${(p.cpu*p.cores*100).toFixed(2)}%`,'-p','CPUQuotaPeriodSec=100ms','-p',`MemoryMax=${p.memoryBytes}`,'-p','MemorySwapMax=0','-p','TasksMax=128','--',python,...engineArgs]:engineArgs;
    status.hardCaps=hardCaps;
    const engine=spawn(hardCaps?'/usr/bin/systemd-run':python,launchArgs,{detached:process.platform==='linux',windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,CUDA_VISIBLE_DEVICES:'',PIGEON_SEMANTIC_THREADS:String(p.threads),PIGEON_SEMANTIC_FFMPEG:ffmpeg,OMP_NUM_THREADS:String(p.threads),MKL_NUM_THREADS:String(p.threads),OPENBLAS_NUM_THREADS:'1',TOKENIZERS_PARALLELISM:'false'}});child=engine;
    const bootTimer=setTimeout(()=>{readyReject(Error('Semantic engine startup timed out'));killEngine('Semantic engine startup timed out');},30000);
    let buffer='',errors='';engine.stderr.on('data',data=>{errors=(errors+data).slice(-5000);});
    engine.stdout.on('data',data=>{buffer+=data;if(buffer.length>16*1024*1024){killEngine('Semantic engine response exceeded safety limit');return;}let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);try{const message=JSON.parse(line);if(message.ready){clearTimeout(bootTimer);readyResolve();}else if(pending.has(message.id)){const job=pending.get(message.id);pending.delete(message.id);clearTimeout(job.timer);if(message.error)job.reject(Error(message.error));else job.resolve(message.result);}}catch(error){diagnostic('warning','Invalid semantic engine response',error.message);}}});
    engine.on('error',error=>{clearTimeout(bootTimer);readyReject(error);if(child===engine){killEngine(error.message);publish({state:'error',error:error.message,detail:'Local semantic engine could not start.'});}});
    engine.on('exit',(code,signal)=>{clearTimeout(bootTimer);readyReject(Error(errors||`Semantic engine exited (${code||signal})`));if(child===engine){killEngine('Semantic engine exited');if(session===epoch)publish({state:'error',error:errors.slice(-700)||'Engine stopped',detail:'The engine stopped. Its installation will be checked before the next operation.'});}});
    governor=createSemanticGovernor({child:engine,getMode:()=>manual||searching?'manual':'automatic',isPaused:()=>paused,isBusy:()=>isBusy()&&!pending.size,onMemoryLimit:error=>{killEngine(error.message);paused=true;publish({state:'error',error:error.message,detail:'Memory budget reached. Close other applications or resume with Analyze now.'});},onSample:resources=>{status.resources=resources;}});
    const id=`${c.portfolioId}:semantic-index`;releasePause=registerPause(id,value=>{paused=Boolean(value);publish({state:paused?'paused':'waiting'});});
    return ready;
  }
  function request(action,payload={},priority=false){return new Promise((resolve,reject)=>{const job={action,payload,resolve,reject,epoch};if(priority)queue.unshift(job);else queue.push(job);void drain();});}
  async function drain(){if(draining||closed)return;draining=true;try{while(queue.length&&!closed){const job=queue.shift();if(job.epoch!==epoch){job.reject(Error('Portfolio changed'));continue;}try{await startEngine();if(job.epoch!==epoch)throw Error('Portfolio changed');const id=++sequence;const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Semantic operation timed out'));killEngine('Semantic operation timed out');},600000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,action:job.action,...job.payload})+'\n',error=>{if(error){clearTimeout(timer);pending.delete(id);reject(error);}});});job.resolve(result);}catch(error){job.reject(error);}}}finally{draining=false;}}
  async function runIndex(){
    const c=context();if(!c||indexing||paused||closed||setupPromise)return;if(!manual&&settings.automatic===false)return;
    const p=budget(manual?'manual':'automatic');if(systemBusy>p.busy||isBusy()||availableMemory()<(child?512*1024*1024:p.memoryBytes+512*1024*1024)){waitingSamples=0;publish({state:'waiting',detail:'Waiting for low CPU use and available memory.'});return;}
    if(!manual&&++waitingSamples<3){publish({state:'waiting',detail:'Waiting for sustained low compute use.'});return;}
    if(healthyPython!==runtimePython()){if(Date.now()>=setupRetryAfter)void ensureReady().catch(()=>{});return;}
    indexing=true;const session=epoch,assets=currentAssets(),progressId=`${c.portfolioId}:semantic-index`;
    try{
      info=await request('prune',{assets:assetFingerprints(assets)},true);
      const pendingIds=new Set((await request('plan')).pending);
      const work=assets.filter(a=>pendingIds.has(a.id));
      if(!work.length){manual=false;await applyKernelBudget();publish({state:'idle',detail:'Portfolio index is up to date.',completed:assets.length,total:assets.length,current:'',error:''});return;}
      let completed=assets.length-work.length;
      publish({state:'indexing',detail:'Analyzing files in parallel batches, sharing one local model.',completed,total:assets.length,error:''});
      while(work.length){
        if(closed||session!==epoch)return;
        if(paused||(!manual&&settings.automatic===false)){publish({state:'paused',detail:'Analysis paused. Completed work is saved.'});return;}
        const batchBudget=budget(manual?'manual':'automatic');
        if(systemBusy>batchBudget.busy||isBusy()||availableMemory()<512*1024*1024){publish({state:'waiting',detail:'Paused while the machine is busy.'});await sleep(1000);continue;}
        const headroom=batchBudget.memoryBytes-(status.resources?.memoryBytes||0),workers=Math.min(batchBudget.fileWorkers,Math.max(1,Math.floor((headroom-32*1024*1024)/(96*1024*1024))));
        const batch=work.splice(0,workers),valid=batch.filter(asset=>{const current=getAsset?getAsset(asset.id):getAssets().find(item=>item.id===asset.id);return current&&admissible(current)&&fingerprint(current)===fingerprint(asset);});
        completed+=batch.length-valid.length;if(!valid.length)continue;
        const names=valid.map(asset=>asset.name||asset.filename);
        publish({state:'indexing',current:names.join(' · '),activeFiles:names,fileWorkers:workers,completed});
        report(progressId,{label:'Semantic analysis',detail:`${valid.length} files in batch: ${names.join(' · ')}`,completed,total:assets.length});
        const result=await request('index_batch',{jobs:valid.map(asset=>({asset:assetRecord(asset),fingerprint:fingerprint(asset)})),workers,steps:2,memoryLimit:batchBudget.memoryBytes});
        info=result.info||info;const outcomes=new Map(result.results.map(item=>[item.id,item]));
        for(const asset of valid){const item=outcomes.get(asset.id);if(!item)throw Error('Semantic batch returned an incomplete response');if(item.done)completed++;else work.push(asset);if(item.error)status.lastFileError=item.error;}
        publish({completed,activeFiles:[],current:''});
        await sleep(manual?25:100);
      }
      info=await request('info');indexDone=true;manual=false;await applyKernelBudget();publish({state:'idle',detail:'Portfolio analysis complete. New or changed files are picked up automatically.',current:'',activeFiles:[],fileWorkers:0});report(progressId,{label:'Semantic analysis',completed:assets.length,total:assets.length,done:true});
    }catch(error){if(session===epoch&&!closed){if(/No module named|local_files_only|model cache|cannot find|does not exist/i.test(error.message)){healthyPython='';setupRetryAfter=0;}publish({state:'error',error:error.message,detail:'Analysis stopped. Completed vectors are retained.',activeFiles:[],current:'',fileWorkers:0});report(progressId,{label:'Semantic analysis',detail:error.message,done:true,status:'error'});}}
    finally{indexing=false;}
  }
  const ticker=setInterval(()=>{if(closed)return;const cpus=os.cpus(),delta=systemCpuDelta(lastCpus,cpus);lastCpus=cpus;if(delta!==null)systemBusy=delta;context();if(!indexing){if(indexDone){indexDone=false;}void runIndex();}},5000);ticker.unref();
  const heartbeat=setInterval(()=>{if(child&&Date.now()-lastSearch>180000&&!indexing&&!pending.size&&!queue.length)killEngine('Idle engine unloaded');if(indexing||status.state==='waiting')emit(snapshot());},1000);heartbeat.unref();
  async function getStatus(){context();if(!closed&&!setupPromise&&healthyPython!==runtimePython()&&Date.now()>=setupRetryAfter)void ensureReady().catch(()=>{});if(child&&!pending.size&&!queue.length)try{info=await request('info',{},true);}catch{}return snapshot();}
  async function configure(input={}){const c=context();if(!c)throw Error('Wait for portfolio loading');if(typeof input.automatic==='boolean')settings.automatic=input.automatic;await fsp.writeFile(c.databaseFile+'.semantic-settings.json',JSON.stringify(settings));paused=false;if(settings.automatic===false&&!manual&&indexing){epoch++;killEngine('Automatic analysis disabled');}indexDone=false;publish({state:settings.automatic===false&&!manual?'idle':'waiting',detail:settings.automatic===false?'Automatic analysis disabled. Search and Analyze now remain available.':'Automatic analysis enabled.'});return snapshot();}
async function applyKernelBudget(){const mode=manual||searching?'manual':'automatic';if(!scopeName||scopeMode===mode)return;const p=budget(mode),scope=scopeName;await new Promise((resolve,reject)=>execFile('systemctl',['--user','set-property','--runtime',scope,`CPUQuota=${(p.cpu*p.cores*100).toFixed(2)}%`,`MemoryMax=${p.memoryBytes}`],{timeout:5000},error=>error?reject(error):resolve()));if(scopeName===scope)scopeMode=mode;}
  async function start(){context();manual=true;paused=false;await ensureReady();await applyKernelBudget();publish({state:'waiting',detail:'User-started analysis: 18% CPU and memory budgets.'});void runIndex();return snapshot();}
  function pause(value=true){paused=Boolean(value);publish({state:paused?'paused':'waiting',detail:paused?'Analysis paused. Search remains available after resume.':'Analysis resumed.'});if(!paused)void runIndex();return snapshot();}
  async function search(input={}){
    const c=context();if(!c)throw Error('Wait for the portfolio to load');if(paused)throw Error('Resume semantic analysis before searching');lastSearch=Date.now();const session=epoch;
    const assets=currentAssets().filter(a=>!input.kind||a.kind===input.kind);let sample=input.sample||null;if(input.assetId){const asset=currentAssets().find(a=>a.id===input.assetId);if(!asset)throw Error('Sample is unavailable or locked');sample=assetRecord(asset);}
    if(input.query&&typeof input.query!=='string')throw Error('Search text must be a string');
    let result;searching=true;try{await ensureReady();if(session!==epoch)throw Error('Portfolio changed during engine preparation');await applyKernelBudget();result=await request('search',{query:String(input.query||'').slice(0,4000),sample,assetId:input.assetId,minimum:input.minimum,limit:input.limit,offset:input.offset,assets:assetFingerprints(assets)},true);}catch(error){if(/No module named|local_files_only|model cache|cannot find|does not exist/i.test(error.message))healthyPython='';throw error;}finally{searching=false;await applyKernelBudget();}
    if(session!==epoch)throw Error('Portfolio changed during search');const fresh=new Map(currentAssets().map(a=>[a.id,a])),original=new Map(assets.map(a=>[a.id,a]));
    return{...result,portfolioId:c.portfolioId,results:result.results.filter(r=>fresh.has(r.id)&&fingerprint(fresh.get(r.id))===fingerprint(original.get(r.id))).map(r=>({...r,asset:fresh.get(r.id)}))};
  }
  async function runSetupCommand(command,args,{quiet=false,timeout=0}={}){
    if(closed)throw Error('Pigeon is closing');
    const p=budget(manual||searching?'manual':'automatic'),hardCaps=process.platform==='linux'&&fs.existsSync('/usr/bin/systemd-run');
    const scope=`pigeon-semantic-setup-${process.pid}-${Date.now()}.scope`;
    const scoped=hardCaps?['--user','--scope','--quiet','--collect',`--unit=${scope}`,'-p',`CPUQuota=${(p.cpu*p.cores*100).toFixed(2)}%`,'-p','CPUQuotaPeriodSec=100ms','-p',`MemoryMax=${p.memoryBytes}`,'-p','MemorySwapMax=0','--',command,...args]:args;
    await new Promise((resolve,reject)=>{const processChild=spawn(hardCaps?'/usr/bin/systemd-run':command,scoped,{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'1',MKL_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',TOKENIZERS_PARALLELISM:'false',UV_CONCURRENT_DOWNLOADS:'1',UV_CONCURRENT_BUILDS:'1',UV_CONCURRENT_INSTALLS:'1'}});setupChild=processChild;setupScope=hardCaps?scope:'';let output='',timer=null;
      if(timeout)timer=setTimeout(()=>{if(hardCaps)execFile('systemctl',['--user','kill','--signal=SIGKILL',scope],{timeout:3000},()=>{});processChild.kill('SIGKILL');reject(Error('Local engine health check timed out'));},timeout);
      for(const stream of [processChild.stdout,processChild.stderr])stream.on('data',data=>{output=(output+data).slice(-3000);if(!quiet)publish({state:'setup',detail:output.split(/\r?\n/).filter(Boolean).at(-1)||'Preparing local engine…'});});
      processChild.on('error',error=>{clearTimeout(timer);reject(error);});processChild.on('exit',code=>{clearTimeout(timer);if(setupChild===processChild){setupChild=null;setupScope='';}code===0?resolve():reject(Error(output.slice(-1000)||`Setup exited ${code}`));});});
  }
  const dependencyCheck='import torch, torchvision; assert torch.version.cuda is None; assert torch.__version__.split("+")[0] == "2.14.1"; assert torchvision.__version__.split("+")[0] == "0.29.1"; import pypdf, pypdfium2, docx, openpyxl; import importlib.metadata as m; from sentence_transformers import SentenceTransformer; from transformers.models.embedding_gemma2.processing_embedding_gemma2 import EmbeddingGemma2Processor; '+REQUIREMENTS.map(item=>{const [name,version]=item.split('==');return `assert m.version(${JSON.stringify(name)}) == ${JSON.stringify(version)}`;}).join('; ');
  const modelCheck='from huggingface_hub import snapshot_download; from pathlib import Path; p=Path(snapshot_download("google/embeddinggemma-2", revision="914f7f89142e33e77833254d9c9b90c3cef7303b", local_files_only=True)); assert all((p/f).is_file() for f in ["model.safetensors","modules.json","tokenizer.json","processor_config.json","preprocessor_config.json","config.json","1_Pooling/config.json"]), "Local model cache is incomplete"';
  async function ensureReady(){if(closed)throw Error('Pigeon is closing');if(healthyPython===runtimePython())return;setup();await setupPromise;if(healthyPython!==runtimePython())throw Error(status.error||'Local semantic engine preparation failed');}
  function setup(){if(setupPromise)return snapshot();killEngine('Checking runtime before semantic work');publish({state:'setup',error:'',detail:'Checking the local engine. Missing components are prepared automatically; portfolio files stay on this computer.'});
    setupPromise=(async()=>{let python=runtimePython(),healthy=false;
      if(fs.existsSync(python))try{await runSetupCommand(python,['-c',dependencyCheck],{quiet:true,timeout:30000});healthy=true;}catch{}
      if(!healthy){
        publish({state:'setup',detail:'Preparing the private Python runtime…'});
        const uvCandidates=['uv',path.join(os.homedir(),'.local','bin',process.platform==='win32'?'uv.exe':'uv')];let uv='';for(const candidate of uvCandidates)try{await new Promise((resolve,reject)=>execFile(candidate,['--version'],{timeout:3000},error=>error?reject(error):resolve()));uv=candidate;break;}catch{}
        if(!uv)throw Error('Automatic preparation needs uv (https://docs.astral.sh/uv/). Install uv and try your search again.');
        // Reuse partially installed environments so interrupted preparation can recover.
        python=path.join(managed,process.platform==='win32'?'Scripts/python.exe':'bin/python');
        if(!fs.existsSync(python))await runSetupCommand(uv,['venv','--python','3.12',managed]);
        await runSetupCommand(uv,['pip','install','--python',python,'torch==2.14.1','torchvision==0.29.1','--index-url','https://download.pytorch.org/whl/cpu']);await runSetupCommand(uv,['pip','install','--python',python,...REQUIREMENTS]);
      }
      let cached=false;try{await runSetupCommand(python,['-c',modelCheck],{quiet:true,timeout:30000});cached=true;}catch{}
      if(!cached){publish({state:'setup',detail:'Downloading the local embedding model. Portfolio files are never uploaded.'});await runSetupCommand(python,['-c','from huggingface_hub import snapshot_download; snapshot_download("google/embeddinggemma-2", revision="914f7f89142e33e77833254d9c9b90c3cef7303b", max_workers=1)']);await runSetupCommand(python,['-c',modelCheck],{quiet:true,timeout:30000});}
      await fsp.mkdir(userData,{recursive:true});await fsp.writeFile(globalConfig,JSON.stringify({python}));runtimeOverride=python;healthyPython=python;setupRetryAfter=0;killEngine('Runtime prepared');publish({state:paused?'paused':'waiting',error:'',detail:'Engine ready. Analysis starts when compute use is low.'});
    })().catch(error=>{healthyPython='';setupRetryAfter=Date.now()+60000;publish({state:'error',error:error.message,detail:'Automatic preparation could not finish. The next search will retry.'});throw error;}).finally(()=>{setupPromise=null;});setupPromise.catch(()=>{});return snapshot();}
  function stop(){epoch++;paused=true;killEngine('Portfolio work stopped');contextKey='';}
  function close(){closed=true;clearInterval(ticker);clearInterval(heartbeat);stop();if(setupScope)execFile('systemctl',['--user','kill','--signal=SIGKILL',setupScope],{timeout:3000},()=>{});setupChild?.kill();}
  return{getStatus,configure,start,pause,search,setup,stop,close,assetRecord,runtimePython};
}
module.exports={createSemanticService};
