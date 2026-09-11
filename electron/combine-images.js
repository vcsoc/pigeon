'use strict';
const path=require('node:path'),fs=require('node:fs/promises'),crypto=require('node:crypto'),{Worker}=require('node:worker_threads');
function selectImages(library,ids,isLocked){
 if(!Array.isArray(ids)||ids.length<2||ids.length>64||new Set(ids).size!==ids.length)throw Error('Select 2–64 distinct images');
 const byId=new Map(library.assets.map(a=>[a.id,a]));return ids.map(id=>{const a=byId.get(id);if(!a||a.deletedAt||a.kind!=='image'||a.permissionDenied||a.sourceMissing||a.sourcePending||isLocked(a))throw Error('Every selected image must be available and unlocked');const proxy=a.proxyPath&&/\.(png|jpe?g|webp|tiff?)$/i.test(a.proxyPath)?a.proxyPath:null;return{source:path.resolve(a.editedPath||proxy||a.path),filename:a.filename||a.name,rotation:Number(a.rotation)||0};});
}
function register({ipcMain,dialog,getLibrary,getWindow,isAssetLocked}){
 let job=null;
 ipcMain.handle('images:cancel-combine',event=>{if(event.sender!==getWindow()?.webContents||!job)return false;job.cancelled=true;job.cancel?.();return true;});
 ipcMain.handle('images:combine',async(event,{ids,options={}}={})=>{
  if(event.sender!==getWindow()?.webContents)throw Error('Unavailable');if(job)throw Error('Another combination is still running');
  const library=getLibrary(),images=selectImages(library,ids,isAssetLocked);
  const current=job={cancelled:false};let worker,temporary;
  try{
   const choice=await dialog.showSaveDialog(getWindow(),{title:'Save combined image',defaultPath:'combined-images.png',filters:[{name:'PNG image',extensions:['png']}]});if(choice.canceled||!choice.filePath||current.cancelled)return null;
   if(getLibrary()!==library)throw Error('Portfolio changed; combine the selection again');selectImages(library,ids,isAssetLocked);
   const target=path.resolve(choice.filePath.toLowerCase().endsWith('.png')?choice.filePath:choice.filePath+'.png'),targetStat=await fs.lstat(target).catch(error=>{if(error.code==='ENOENT')return null;throw error;});if(targetStat?.isSymbolicLink())throw Error('Choose a regular output file, not a symbolic link');
   const canonicalTarget=await fs.realpath(target).catch(error=>{if(error.code==='ENOENT')return target;throw error;});for(const image of images)if(path.resolve(image.source)===target||await fs.realpath(image.source)===canonicalTarget)throw Error('The combined image must not replace a selected source');
   temporary=path.join(path.dirname(target),'.pigeon-combine-'+crypto.randomUUID()+'.png');worker=new Worker(path.join(__dirname,'combine-images-worker.js'),{workerData:{images,options,target:temporary}});
   const result=await new Promise((resolve,reject)=>{let done=false;const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value);},timer=setTimeout(()=>{worker.terminate().catch(()=>{});finish(Error('Image combination exceeded 12 seconds. Use fewer images or smaller output dimensions.'));},12000);current.cancel=()=>{worker.terminate().catch(()=>{});finish(Error('Combination cancelled'));};worker.on('message',value=>{if(value.error)finish(Error(value.error));else if(value.done)finish(null,value);});worker.once('error',error=>finish(error));worker.once('exit',()=>finish(Error('Image combination stopped before completion')));});
   if(current.cancelled)return null;if(getLibrary()!==library)throw Error('Portfolio changed; output was not saved');selectImages(library,ids,isAssetLocked);await fs.rename(temporary,target);temporary=null;return{path:target,width:result.width,height:result.height,count:result.count};
  }catch(error){if(current.cancelled)return null;throw error;}
  finally{if(worker)await worker.terminate().catch(()=>{});if(temporary)await fs.rm(temporary,{force:true}).catch(()=>{});if(job===current)job=null;}
 });
}
module.exports={register,selectImages};
