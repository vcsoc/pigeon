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

// Separate queues form a completion barrier: unfinished priority segments must
// finish before any remaining-portfolio batch can start (even with spare workers).
function createSemanticWorkQueue(assets){
  let priorityIds=null,priority=[],remaining=[...assets];
  return {
    get length(){return priority.length+remaining.length;},
    prioritize(ids){if(ids===priorityIds)return;priorityIds=ids;const pending=[...priority,...remaining];priority=[];remaining=[];for(const asset of pending)(ids.has(asset.id)?priority:remaining).push(asset);},
    take(count){return (priority.length?priority:remaining).splice(0,count);},
    push(asset){(priorityIds?.has(asset.id)?priority:remaining).push(asset);}
  };
}
module.exports={semanticPriorityIds,createSemanticWorkQueue};
