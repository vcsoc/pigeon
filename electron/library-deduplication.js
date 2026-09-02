'use strict';

const path=require('node:path');

function pathApi(value){return process.platform==='win32'||/^[a-z]:[\\/]/i.test(String(value||''))||String(value||'').startsWith('\\\\')?path.win32:path;}
function normalizePath(value){const raw=String(value||'').trim();if(!raw)return'';const api=pathApi(raw),resolved=api.resolve(raw),root=api.parse(resolved).root;return resolved===root?resolved:resolved.replace(/[\\/]+$/,'');}
function normalizedPathKey(value){const normalized=normalizePath(value);return pathApi(normalized)===path.win32||process.platform==='darwin'?normalized.toLowerCase():normalized;}
function locationCoversPath(location,candidate){const root=normalizePath(location?.path),target=normalizePath(candidate);if(!root||!target)return false;if(location?.type==='file')return normalizedPathKey(root)===normalizedPathKey(target);const api=pathApi(root),relative=api.relative(root,target);return relative===''||relative!== '..'&&!relative.startsWith(`..${api.sep}`)&&!api.isAbsolute(relative);}
function findLocationOverlap(locations,candidatePath,candidateType='folder'){
  const candidate={path:normalizePath(candidatePath),type:candidateType};
  const available=locations||[],exact=available.find((location)=>normalizedPathKey(location.path)===normalizedPathKey(candidate.path));if(exact)return{location:exact,relation:'exact'};
  for(const location of available){if(locationCoversPath(location,candidate.path))return{location,relation:'covered'};if(candidateType==='folder'&&locationCoversPath(candidate,location.path))return{location,relation:'contains'};}
  return null;
}
function visibleLocations(locations=[]){const seen=new Set();return locations.filter((location)=>{const key=normalizedPathKey(location.path);if(!key||seen.has(key))return false;seen.add(key);return true;});}
function owningLocation(locations,filePath){return(locations||[]).filter((location)=>locationCoversPath(location,filePath)).sort((first,second)=>normalizePath(second.path).length-normalizePath(first.path).length||(first.type==='file'?-1:second.type==='file'?1:0)||(Number(first.addedAt)||0)-(Number(second.addedAt)||0))[0]||null;}
function uniqueValues(values){const seen=new Set();return values.filter((value)=>{const key=typeof value==='string'?value:JSON.stringify(value);if(!value||seen.has(key))return false;seen.add(key);return true;});}
function assetRichness(asset){return['note','thumbnailPath','contentHash','perceptualHash','technicalMetadata','exif','width','height','duration','sourceUrl'].reduce((score,key)=>score+(asset?.[key]?1:0),0)+(asset?.tags?.length||0)+(asset?.collectionIds?.length||0);}
function mergeAssetReferences(primary,references,owner){
  const merged={...primary,locationId:owner?.id||primary.locationId};
  merged.tags=uniqueValues(references.flatMap((asset)=>asset.tags||[]));merged.collectionIds=uniqueValues(references.flatMap((asset)=>asset.collectionIds||[]));merged.annotations=uniqueValues(references.flatMap((asset)=>asset.annotations||[]));
  const notes=uniqueValues(references.map((asset)=>String(asset.note||'').trim()));merged.note=notes.join('\n\n');merged.rating=Math.max(...references.map((asset)=>Number(asset.rating)||0));merged.favorite=references.some((asset)=>asset.favorite);merged.quickChecked=references.some((asset)=>asset.quickChecked);merged.thumbnailEffect=references.some((asset)=>asset.thumbnailEffect);merged.deletedAt=references.some((asset)=>!asset.deletedAt)?null:Math.min(...references.map((asset)=>Number(asset.deletedAt)||Date.now()));merged.sourceMissing=references.every((asset)=>asset.sourceMissing);merged.sourcePending=references.every((asset)=>asset.sourcePending);
  const fillFields=['thumbnailPath','proxyPath','proxyVersion','editedPath','contentHash','perceptualHash','dominantColor','histogram','palette','exif','technicalMetadata','width','height','duration','sourceUrl','linkedYouTube','youtubeVideoId','importMode','geo','stackId'];for(const field of fillFields)if(merged[field]==null||merged[field]===''){const source=references.find((asset)=>asset[field]!=null&&asset[field]!=='');if(source)merged[field]=source[field];}
  return merged;
}
function deduplicateAssetsByPath(library){
  const locations=visibleLocations(library?.locations||[]),groups=new Map(),withoutPath=[];for(const asset of library?.assets||[]){const key=normalizedPathKey(asset.path);if(!key){withoutPath.push(asset);continue;}const group=groups.get(key)||[];group.push(asset);groups.set(key,group);}
  const assets=[...withoutPath],removedIds=[];let changed=false;for(const references of groups.values()){const owner=owningLocation(locations,references[0].path);if(references.length===1&&(!owner||references[0].locationId===owner.id)){assets.push(references[0]);continue;}const ownerReferences=references.filter((asset)=>asset.locationId===owner?.id),primary=[...(ownerReferences.length?ownerReferences:references)].sort((a,b)=>assetRichness(b)-assetRichness(a))[0],merged=mergeAssetReferences(primary,references,owner);assets.push(merged);for(const asset of references)if(asset.id!==primary.id)removedIds.push(asset.id);changed=true;}
  if(changed){library.assets=assets;const counts=new Map();for(const asset of assets)counts.set(asset.locationId,(counts.get(asset.locationId)||0)+1);for(const location of library.locations||[])location.assetCount=counts.get(location.id)||0;}
  return{changed,removedIds,duplicatesRemoved:removedIds.length,assets};
}

module.exports={normalizePath,normalizedPathKey,locationCoversPath,findLocationOverlap,visibleLocations,owningLocation,deduplicateAssetsByPath};
