(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonMetadataViewDelta=api;})(typeof window!=='undefined'?window:globalThis,function(){
  function insertSorted(indices,index,assets,compare){let low=0,high=indices.length;while(low<high){const middle=(low+high)>>1;if(compare(assets[indices[middle]],assets[index])<=0)low=middle+1;else high=middle;}indices.splice(low,0,index);return low;}

  function reconcileIndices({indices,changes,assets,compare,matches}){
    const changedIndexes=new Set(changes.map((change)=>change.index)),previous=[...indices],previousPositions=new Map(previous.map((index,position)=>[assets[index]?.id,position])),next=indices.filter((index)=>!changedIndexes.has(index)),removedIds=[],addedIds=[],retainedIds=[];
    for(const change of changes){const beforeMatch=previousPositions.has(change.before?.id),afterMatch=Boolean(change.after&&matches(change.after));if(beforeMatch&&!afterMatch)removedIds.push(change.after?.id||change.before.id);if(!beforeMatch&&afterMatch)addedIds.push(change.after.id);if(beforeMatch&&afterMatch)retainedIds.push(change.after.id);if(afterMatch)insertSorted(next,change.index,assets,compare);}
    return{previous,next,previousPositions,removedIds,addedIds,retainedIds};
  }

  function updateCounts({folders,counts,changes,resolve,matches}){
    const changedFolderIds=[];
    for(const folder of folders){if(!counts.has(folder.id))continue;const resolution=resolve(folder),beforeCount=counts.get(folder.id)||0;let delta=0;for(const change of changes){const beforeMatch=Boolean(change.before&&matches(change.before,resolution)),afterMatch=Boolean(change.after&&matches(change.after,resolution));delta+=Number(afterMatch)-Number(beforeMatch);}if(delta){counts.set(folder.id,Math.max(0,beforeCount+delta));changedFolderIds.push(folder.id);}}
    return changedFolderIds;
  }

  function selectionAfterRemoval({selectedId,selectedIds,removedIds,previous,next,assets}){
    const removed=new Set(removedIds),remainingSelected=[...selectedIds].filter((id)=>!removed.has(id));if(!removed.has(selectedId))return{selectedId,selectedIds:new Set(remainingSelected),focusId:selectedId};
    const removedPositions=removedIds.map((id)=>previous.findIndex((index)=>assets[index]?.id===id)).filter((position)=>position>=0).sort((a,b)=>a-b),position=removedPositions[0]??0,nextIndex=next[Math.min(position,Math.max(0,next.length-1))],focusId=nextIndex===undefined?null:assets[nextIndex]?.id||null;
    return{selectedId:focusId,selectedIds:new Set(focusId?[...remainingSelected,focusId]:remainingSelected),focusId};
  }

  function keyedCardPlan(existingIds,desiredIds,changedIds=[]){const existing=new Set(existingIds),desired=new Set(desiredIds),changed=new Set(changedIds);return{remove:existingIds.filter((id)=>!desired.has(id)),create:desiredIds.filter((id)=>!existing.has(id)),reuse:desiredIds.filter((id)=>existing.has(id)&&!changed.has(id)),update:desiredIds.filter((id)=>existing.has(id)&&changed.has(id)),order:[...desiredIds]};}

  return{insertSorted,reconcileIndices,updateCounts,selectionAfterRemoval,keyedCardPlan};
});
