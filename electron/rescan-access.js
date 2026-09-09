const fs=require('node:fs/promises');const path=require('node:path');
function networkScanTimeout(source,fallback=3500){return /[\\/]gvfs[\\/]|^\\\\|^\/\//i.test(String(source||''))?30000:fallback;}
async function checkRescanSource(location,subfolder='',{stat=fs.stat,timeoutMs=networkScanTimeout(location?.path)}={}){
 if(!location)throw new Error('Indexed folder no longer exists');
 const root=path.resolve(location.path),target=path.resolve(root,subfolder),relative=path.relative(root,target);
 if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('The selected folder is outside its indexed root');
 let timer;
 try{const info=await Promise.race([stat(target),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('Timed out'),{code:'ETIMEDOUT'})),timeoutMs);})]);if(!(location.type==='file'&&!subfolder?info.isFile():info.isDirectory()))throw Object.assign(new Error('Not a folder'),{code:'ENOTDIR'});}
 catch(error){if(error.code==='ETIMEDOUT')throw new Error(`The folder is responding too slowly. The network share may still be connected; retry when it responds: ${target}`);if(['EACCES','EPERM'].includes(error.code))throw new Error(`Permission denied. Grant access before rescanning: ${target}`);throw new Error(`Folder unavailable. Reconnect the drive or network share, or check that the folder still exists, then rescan: ${target}`);}
 finally{clearTimeout(timer);}
 return target;
}
module.exports={checkRescanSource,networkScanTimeout};
