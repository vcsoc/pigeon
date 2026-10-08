'use strict';
const {matchesSmartFolder}=require('./library-core');

// Resolve against the complete main-process library, never the rendered thumbnail window.
function semanticPriorityIds(library,scope,includeSubfolders=true){
  if(!scope||typeof scope.id!=='string')return [];
  let matches=()=>false;
  if(scope.type==='collection'){
    if(!library.collections.some(item=>item.id===scope.id))return [];
    const ids=new Set([scope.id]);
    if(includeSubfolders){let changed=true;while(changed){changed=false;for(const item of library.collections)if(ids.has(item.parentId)&&!ids.has(item.id)){ids.add(item.id);changed=true;}}}
    matches=asset=>(asset.collectionIds||[]).some(id=>ids.has(id));
  }else if(scope.type==='smart-folder'){
    if(!library.smartFolders.some(item=>item.id===scope.id))return [];
    matches=asset=>matchesSmartFolder(library,scope.id,asset);
  }else if(scope.type==='folder'){
    const location=library.locations.find(item=>item.id===scope.id);if(!location)return [];
    const normalize=value=>String(value||'').replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase();
    const subfolder=String(scope.subfolder||'').replace(/\\/g,'/').replace(/^\/+|\/+$/g,'');
    if(subfolder.split('/').some(part=>part==='..'||part==='.'))return [];
    const target=normalize(location.path)+(subfolder?'/'+normalize(subfolder):'');
    matches=asset=>asset.locationId===scope.id&&(location.type!=='folder'||(includeSubfolders?normalize(asset.path).startsWith(target+'/'):normalize(asset.path).slice(0,normalize(asset.path).lastIndexOf('/'))===target));
  }
  return library.assets.filter(matches).map(asset=>asset.id);
}

function semanticPriorityPlan(library,scope){
  const item=scope?.type==='collection'?library.collections.find(item=>item.id===scope.id):scope?.type==='smart-folder'?library.smartFolders.find(item=>item.id===scope.id):scope?.type==='folder'?library.locations.find(item=>item.id===scope.id):null;
  if(!item)return{key:'portfolio',scope:null,label:'Portfolio',directIds:library.assets.map(asset=>asset.id),descendantIds:[]};
  const directIds=semanticPriorityIds(library,scope,false),direct=new Set(directIds);let all=semanticPriorityIds(library,scope,true);
  if(scope.type==='smart-folder'){const ids=new Set([scope.id]);let changed=true;while(changed){changed=false;for(const child of library.smartFolders)if(ids.has(child.parentId)&&!ids.has(child.id)){ids.add(child.id);changed=true;}}all=[...new Set([...all,...[...ids].flatMap(id=>semanticPriorityIds(library,{type:'smart-folder',id}))])];}
  const selected={type:scope.type,id:scope.id,...(scope.type==='folder'?{subfolder:String(scope.subfolder||'')}: {})};
  return{key:JSON.stringify(selected),scope:selected,label:String(item.name||item.path||scope.id)+(scope.subfolder?' / '+scope.subfolder:''),directIds,descendantIds:all.filter(id=>!direct.has(id))};
}

// Every tier is a completion barrier: direct files, then descendants, then queued
// scopes. Unfinished segments return to their own tier, never behind the portfolio.
function createSemanticWorkQueue(assets,{groupRemainingByLocation=false}={}){
  let priorityIds=null,tierIdentity=null,tiers=[],buckets=[],remaining=[],groups=new Map(),groupOrder=[],remainingLength=0;
  function remainingAssets(){return groupRemainingByLocation?[...groups.values()].flat():remaining;}
  function appendRemaining(asset){if(groupRemainingByLocation){const key=asset.locationId||'';if(!groups.has(key)){groups.set(key,[]);groupOrder.push(key);}groups.get(key).push(asset);}else remaining.push(asset);remainingLength++;}
  function partition(pending){buckets=tiers.map(()=>[]);remaining=[];groups=new Map();groupOrder=[];remainingLength=0;for(const asset of pending){const index=tiers.findIndex(ids=>ids.has(asset.id));if(index<0)appendRemaining(asset);else buckets[index].push(asset);}}
  const work={
    get length(){return buckets.reduce((total,bucket)=>total+bucket.length,remainingLength);},
    get activeTierIndex(){return buckets.findIndex(bucket=>bucket.length);},
    prioritize(ids){if(ids===priorityIds)return;priorityIds=ids;work.prioritizeTiers([ids]);},
    prioritizeTiers(next){if(next===tierIdentity)return;const pending=[...buckets.flat(),...remainingAssets()];tierIdentity=next;tiers=next;partition(pending);},
    replace(pending){partition(pending);},
    take(count){const index=work.activeTierIndex;if(index>=0)return buckets[index].splice(0,count);if(groupRemainingByLocation){while(groupOrder.length&&!groups.get(groupOrder[0])?.length){groups.delete(groupOrder.shift());}const result=(groups.get(groupOrder[0])||[]).splice(0,count);remainingLength-=result.length;return result;}const result=remaining.splice(0,count);remainingLength-=result.length;return result;},
    push(asset){const index=tiers.findIndex(ids=>ids.has(asset.id));if(index<0)appendRemaining(asset);else buckets[index].push(asset);}
  };partition(assets);return work;
}
module.exports={semanticPriorityIds,semanticPriorityPlan,createSemanticWorkQueue};
