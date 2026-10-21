(function(root){
  'use strict';
  function ordered(items,ids=[]){
    const rank=new Map((Array.isArray(ids)?ids:[]).map((id,index)=>[id,index]));
    return [...items].sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity));
  }
  function move(items,ids,sourceId,targetId,position){
    if(!['before','after'].includes(position))throw Error('Root folders can only be reordered before or after another root.');
    const order=ordered(items,ids).map(item=>item.id);
    if(!order.includes(sourceId)||!order.includes(targetId))throw Error('This indexed folder is no longer available.');
    if(sourceId===targetId)return order;
    order.splice(order.indexOf(sourceId),1);order.splice(order.indexOf(targetId)+(position==='after'?1:0),0,sourceId);return order;
  }
  const api={ordered,move};
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  root.PigeonLocationOrder=api;
  const mime='application/x-pigeon-location-order';let drag=null;
  const rowOf=event=>event.target.closest('.location-root-button');
  const idOf=row=>row?.closest('.location-item')?.dataset.locationId;
  const clear=()=>root.PigeonSidebarDropPreview?.hide();
  document.addEventListener('dragstart',event=>{
    const row=rowOf(event);if(!row)return;drag={id:idOf(row),portfolioId:state.library.activePortfolioId};
    event.dataTransfer.effectAllowed='move';event.dataTransfer.setData(mime,drag.id);
  },true);
  document.addEventListener('dragover',event=>{
    if(!drag||!event.dataTransfer.types.includes(mime))return;
    event.preventDefault();event.stopImmediatePropagation();const row=rowOf(event);
    if(!row||idOf(row)===drag.id||drag.portfolioId!==state.library.activePortfolioId){clear();event.dataTransfer.dropEffect='none';return;}
    event.dataTransfer.dropEffect='move';const rect=row.getBoundingClientRect(),position=event.clientY<rect.top+rect.height/2?'before':'after';
    root.PigeonSidebarDropPreview?.show(row,position,{explicit:true,label:`${position==='before'?'Before':'After'} ${row.querySelector('.location-name').textContent} (sidebar order only)`});
  },true);
  document.addEventListener('drop',async event=>{
    if(!drag||!event.dataTransfer.types.includes(mime))return;
    event.preventDefault();event.stopImmediatePropagation();const source=drag,row=rowOf(event);drag=null;clear();
    if(!row||idOf(row)===source.id||source.portfolioId!==state.library.activePortfolioId)return;
    const rect=row.getBoundingClientRect(),position=event.clientY<rect.top+rect.height/2?'before':'after';
    try{const order=await window.pigeon.reorderLocations(source.id,idOf(row),position,source.portfolioId);if(source.portfolioId!==state.library.activePortfolioId)return;state.library.settings={...(state.library.settings||{}),sidebarLocationOrder:order};renderSidebar(false);}catch(error){showToast(error.message);}
  },true);
  document.addEventListener('dragend',()=>{drag=null;clear();},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){drag=null;clear();}},true);
})(typeof window==='object'?window:globalThis);
