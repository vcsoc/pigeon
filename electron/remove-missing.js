'use strict';
const path=require('node:path'),fs=require('node:fs/promises');
function descendants(items,id){const ids=new Set([id]);let changed=true;while(changed){changed=false;for(const item of items||[])if(ids.has(item.parentId)&&!ids.has(item.id)){ids.add(item.id);changed=true;}}return ids;}
function inside(root,file){const relative=path.relative(root,path.resolve(file));return relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);}
function scopePredicate(library,scope,matchesSmartFolder){
 if(scope?.type==='trash')return asset=>Boolean(asset.deletedAt);
 let matches;
 if(scope?.type==='folder'){
  const location=library.locations.find(item=>item.id===scope.id);if(!location)throw Error('Indexed folder no longer exists');
  const root=path.resolve(location.path),target=path.resolve(root,scope.subfolder||'');if(!inside(root,target))throw Error('The selected folder is outside its indexed root');
  matches=asset=>inside(target,asset.path);
 }else if(scope?.type==='collection'){
  if(!library.collections.some(item=>item.id===scope.id))throw Error('Collection no longer exists');const ids=descendants(library.collections,scope.id);matches=asset=>(asset.collectionIds||[]).some(id=>ids.has(id));
 }else if(scope?.type==='smart-folder'){
  if(!library.smartFolders.some(item=>item.id===scope.id))throw Error('Smart Folder no longer exists');const ids=descendants(library.smartFolders,scope.id),folders=library.smartFolders.filter(item=>ids.has(item.id));matches=asset=>folders.some(folder=>matchesSmartFolder(library,folder,asset));
 }else throw Error('Select a folder, collection, smart folder or Trash');
 return asset=>!asset.deletedAt&&matches(asset);
}
async function findMissing(assets,{stat=fs.stat,isActive=()=>true,canCheck=async()=>true,onProgress=()=>{},timeoutMs=2500,concurrency=4}={}){
 const missing=[],skipped=[],checkedPaths=new Map();let cursor=0,completed=0;
 async function worker(){while(isActive()){
  const index=cursor++;if(index>=assets.length)return;const asset=assets[index],filePath=asset.path;let timer;
  try{if(!await canCheck(asset)){skipped.push(asset.id);continue;}if(!isActive())return;await Promise.race([stat(filePath),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('File check timed out'),{code:'ETIMEDOUT'})),timeoutMs);})]);}
  catch(error){if(['ENOENT','ENOTDIR'].includes(error.code)){missing.push(asset);checkedPaths.set(asset.id,filePath);}else skipped.push(asset.id);}
  finally{clearTimeout(timer);onProgress(++completed,assets.length);}
 }}
 await Promise.all(Array.from({length:Math.min(concurrency,assets.length)},worker));return{missing:isActive()?missing:[],checkedPaths,skipped};
}
module.exports={scopePredicate,findMissing};
