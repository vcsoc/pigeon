'use strict';
const path=require('node:path'),os=require('node:os'),fs=require('node:fs/promises');
async function resolvePluginPython(configured='auto',{run,installMissing=false,managedDir,signal,onOutput=()=>{}}={}){
 const requested=String(configured||'auto').trim(),automatic=['auto','python'].includes(requested.toLowerCase());
 const invoke=(command,args,options={})=>{signal?.throwIfAborted();return run(command,args,process.cwd(),{timeoutMs:3000,signal,onOutput,...options});};
 const check=async(command,args=[])=>{try{const lines=(await invoke(command,[...args,'-c','import sys; print(sys.executable); print(f"{sys.version_info.major}.{sys.version_info.minor}")'])).trim().split(/\r?\n/),version=lines.at(-1);return ['3.10','3.11'].includes(version)?{executable:lines.at(-2),version}:null;}catch{signal?.throwIfAborted();return null;}};
 if(!automatic){const found=await check(requested);if(found)return found;throw Error('AI Object Removal requires Python 3.10 or 3.11. Choose a compatible executable or set Python to auto.');}
 const home=os.homedir(),tools=[{command:'uv',args:[]},...['.local/bin/uv','.cargo/bin/uv',...(process.platform==='win32'?['.local/bin/uv.exe']:[])].map(file=>({command:path.join(home,file),args:[]}))];let tool;
 for(const candidate of tools){try{await invoke(candidate.command,['--version']);tool=candidate;break;}catch{signal?.throwIfAborted();}}
 const findManaged=async()=>{if(!tool)return null;try{const executable=(await invoke(tool.command,[...tool.args,'python','find','3.11','--no-python-downloads'],{env:tool.env})).trim().split(/\r?\n/).at(-1);return executable?await check(executable):null;}catch{signal?.throwIfAborted();return null;}};
 const managed=await findManaged();if(managed)return managed;
 if(process.platform==='win32')for(const version of ['-3.11','-3.10']){const found=await check('py',[version]);if(found)return found;}
 for(const command of ['python3.11','python3.10','python3','python']){const found=await check(command);if(found)return found;}
 if(!installMissing)throw Error('Python 3.10/3.11 is missing. Run automatic setup to install a managed Python 3.11.');
 if(!tool&&managedDir){await fs.mkdir(managedDir,{recursive:true});onOutput('Installing a private uv runtime manager (system Python is not modified).');
  for(const host of process.platform==='win32'?[['py',['-3']],['python',[]]]:[['python3',[]],['python',[]]]){try{await invoke(host[0],[...host[1],'-I','-m','pip','install','--upgrade','--disable-pip-version-check','--only-binary=:all:','--target',managedDir,'uv==0.8.22'],{timeoutMs:120000});const candidate={command:host[0],args:[...host[1],'-I','-c','import sys,runpy; sys.path.insert(0,sys.argv[1]); del sys.argv[1]; runpy.run_module("uv",run_name="__main__")',managedDir]};await invoke(candidate.command,[...candidate.args,'--version'],{env:candidate.env});tool=candidate;break;}catch{signal?.throwIfAborted();}}
 }
 if(!tool)throw Error('Automatic Python setup needs uv or Python with pip. Install uv once, or configure a Python 3.11 executable; no system packages were changed.');
 onOutput('Installing managed Python 3.11 with uv. Your default/system Python is unchanged.');
 await invoke(tool.command,[...tool.args,'python','install','3.11'],{env:tool.env,timeoutMs:120000});
 const installed=await findManaged();if(installed)return installed;throw Error('Managed Python installation finished but Python 3.11 could not be validated. Retry setup or configure its executable.');
}
module.exports={resolvePluginPython};
