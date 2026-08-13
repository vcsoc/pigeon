const { parentPort, workerData } = require('node:worker_threads');
const path = require('node:path');
const collapsed = new Set(workerData.collapsedKeys || []), assetsByLocation = new Map();
for (const asset of workerData.assets || []) { const list = assetsByLocation.get(asset.locationId) || []; list.push(asset.path); assetsByLocation.set(asset.locationId, list); }
const result = (workerData.locations || []).map((location) => {
  const root = String(location.path || '').replace(/\\/g, '/').replace(/\/$/, ''), folders = new Map();
  for (const sourceValue of assetsByLocation.get(location.id) || []) { const source = String(sourceValue || '').replace(/\\/g, '/'); if (!source.toLowerCase().startsWith(`${root}/`.toLowerCase())) continue; const parts = source.slice(root.length + 1).split('/').slice(0,-1); for (let depth=0; depth<parts.length; depth+=1) { const folderPath=parts.slice(0,depth+1).join('/'), current=folders.get(folderPath)||{name:parts[depth],path:folderPath,depth,count:0,directCount:0}; current.count+=1;if(depth===parts.length-1)current.directCount+=1; folders.set(folderPath,current); } }
  for(const emptyValue of workerData.emptyFolders?.[location.id]||[]){const source=String(emptyValue||'').replace(/\\/g,'/');if(!source.toLowerCase().startsWith(`${root}/`.toLowerCase()))continue;const parts=source.slice(root.length+1).split('/').filter(Boolean);for(let depth=0;depth<parts.length;depth+=1){const folderPath=parts.slice(0,depth+1).join('/');if(!folders.has(folderPath))folders.set(folderPath,{name:parts[depth],path:folderPath,depth,count:0,directCount:0});}}
  const sorted=[...folders.values()].sort((a,b)=>a.path.localeCompare(b.path,undefined,{numeric:true,sensitivity:'base'})), visible=collapsed.has(`location:${location.id}`)?[]:sorted.filter((folder)=>{const parts=folder.path.split('/');return !parts.slice(0,-1).some((_,index)=>collapsed.has(`subfolder:${location.id}:${parts.slice(0,index+1).join('/').toLowerCase()}`));}).map((folder)=>({...folder,hasChildren:sorted.some((item)=>item.path.startsWith(`${folder.path}/`))}));
  return {locationId:location.id,folders:visible.slice(0,Math.max(100,workerData.limits?.[location.id]||300)),visibleFolders:visible.length,totalFolders:sorted.length};
});
parentPort.postMessage(result);
