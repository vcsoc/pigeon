(function(root){
  'use strict';
  function rebase(cache,sourceId,sourcePath,destinationId,destinationPath){
    const source=cache.get(sourceId),destination=cache.get(destinationId);if(!source||!destination)return false;
    const from=String(sourcePath).replace(/\\/g,'/').replace(/^\/+|\/+$/g,''),to=String(destinationPath).replace(/\\/g,'/').replace(/^\/+|\/+$/g,''),prefix=from.toLowerCase();if(!from||!to)return false;
    const moved=source.folders.filter(folder=>{const key=folder.path.toLowerCase();return key===prefix||key.startsWith(`${prefix}/`);});if(!moved.length)return false;
    const retained=source.folders.filter(folder=>!moved.includes(folder));
    const rebased=moved.map(folder=>{const path=to+folder.path.slice(from.length);return {...folder,path,name:path.split('/').pop(),depth:path.split('/').length-1};});
    if(source===destination)source.folders=[...retained,...rebased];else{source.folders=retained;destination.folders=[...destination.folders,...rebased];}
    for(const tree of new Set([source,destination])){const parents=new Set(tree.folders.map(folder=>folder.path.split('/').slice(0,-1).join('/').toLowerCase()).filter(Boolean));tree.folders=tree.folders.map(folder=>({...folder,hasChildren:parents.has(folder.path.toLowerCase())})).sort((a,b)=>a.path.localeCompare(b.path,undefined,{numeric:true,sensitivity:'base'}));tree.totalFolders=tree.visibleFolders=tree.folders.length;}
    return true;
  }
  const api={rebase};if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonFolderTreeMove=api;
})(typeof window==='object'?window:globalThis);
