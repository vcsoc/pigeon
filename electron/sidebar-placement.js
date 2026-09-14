'use strict';
function plan(library,type,id,placement){
 const items=type==='collections'?library.collections:type==='smartFolders'?library.smartFolders:null;
 if(!items||!placement||!['before','after'].includes(placement.position))throw Error('Invalid sidebar placement');
 const source=items.find(item=>item.id===id),target=items.find(item=>item.id===placement.targetId);
 if(!source||!target||source===target)throw Error('Invalid sidebar target');
 const parentId=target.parentId??null,siblings=items.filter(item=>(item.parentId??null)===parentId&&item.id!==id),expected=new Set([...siblings.map(item=>item.id),id]),orderedIds=placement.orderedIds;
 if(!Array.isArray(orderedIds)||orderedIds.length!==expected.size||new Set(orderedIds).size!==expected.size||orderedIds.some(key=>!expected.has(key)))throw Error('Sidebar changed; retry the move');
 if(orderedIds.indexOf(id)!==orderedIds.indexOf(target.id)+(placement.position==='before'?-1:1))throw Error('Invalid sidebar position');
 return {type,parentId,orderedIds:[...orderedIds]};
}
function apply(library,placement){const items=library[placement.type],byId=new Map(items.map(item=>[item.id,item])),now=Date.now();placement.orderedIds.forEach((id,order)=>Object.assign(byId.get(id),{order,updatedAt:now}));library.settings.sidebarBranchSort={...(library.settings.sidebarBranchSort||{}),[`${placement.type}:${placement.parentId??'root'}`]:'manual'};}
module.exports={plan,apply};
