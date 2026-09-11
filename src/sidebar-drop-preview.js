(function(root){
  'use strict';
  function destination(source,target,requested='inside'){
    if(!source||!target)return 'inside';
    if(source.kind===target.kind){
      if(source.id===target.id||target.ancestors?.includes(source.id)||source.kind==='folders'&&source.parent===target.id)return null;
      if(source.kind!=='folders'&&source.parent===target.parent&&requested!=='inside')return requested;
    }
    return 'inside';
  }
  function geometry({rect,iconLeft,depth=0,step=18,zone,tailBottom=rect.bottom}){
    return {left:iconLeft+(zone==='inside'?step:0),top:zone==='before'?rect.top:tailBottom,depth:depth+(zone==='inside'?1:0),right:rect.right-4};
  }
  if(typeof module==='object'&&module.exports){module.exports={destination,geometry};return;}
  const selector='.collection-item,.smart-folder-item,.location-root-button,.location-folder-item';
  let source=null,marker=null,active=null;
  function metadata(row){
    if(!row)return null;
    const kind=row.matches('.collection-item')?'collections':row.matches('.smart-folder-item')?'smartFolders':'folders';
    if(kind==='folders'){
      const location=row.closest('.location-item')?.dataset.locationId||row.dataset.locationId,path=decodeURIComponent(row.dataset.subfolder||''),parts=path.split('/').filter(Boolean);
      return {kind,location,path,name:parts.at(-1)||'',id:JSON.stringify([location,path]),parent:JSON.stringify([location,parts.slice(0,-1).join('/')]),ancestors:parts.map((_,i)=>JSON.stringify([location,parts.slice(0,i).join('/')]))};
    }
    const id=row.dataset.collectionId||row.dataset.smartFolderId,items=state.library[kind]||[],byId=new Map(items.map(item=>[item.id,item])),item=byId.get(id),ancestors=[],seen=new Set();let parent=item?.parentId;
    while(parent&&!seen.has(parent)){seen.add(parent);ancestors.push(parent);parent=byId.get(parent)?.parentId;}
    return {kind,id,item,parent:item?.parentId??null,ancestors};
  }
  function hide(owner){if(owner&&active?.row!==owner)return;marker?.remove();marker=null;active=null;}
  function reset(){hide();for(const row of document.querySelectorAll('[data-drop-zone],#sidebar-tree-scroll .drag-over')){row.classList.remove('drop-before','drop-after','drop-inside','drag-over');delete row.dataset.dropZone;}}
  function show(row,requested='inside',options={}){
    const zone=options.explicit?requested:destination(source,metadata(row),requested);
    if(!zone){hide();return null;}
    hide();active={row,zone,options};
    marker=document.createElement('div');marker.className='sidebar-placement-placeholder';marker.setAttribute('role','status');marker.dataset.zone=zone;
    const name=(row.querySelector('.location-name')||row.querySelector('.nav-icon + span')||row).textContent.trim();
    marker.textContent=options.label||`${zone==='inside'?'Inside':zone==='before'?'Before':'After'} ${name}`;
    document.body.append(marker);position();return zone;
  }
  function position(){
    if(!active||!marker)return;
    const {row,zone,options}=active;if(!row.isConnected||!row.getClientRects().length){hide();return;}
    let anchor=row,placementZone=zone;
    if(source&&(zone==='inside'||Object.hasOwn(options,'parent'))){
      const target=metadata(row);let ordered=[],index=-1,findRow;
      if(source.kind===target?.kind&&source.kind!=='folders'){
        const parent=Object.hasOwn(options,'parent')?options.parent:target.id,items=state.library[source.kind]||[],siblings=items.filter(item=>(item.parentId??null)===parent&&item.id!==source.id),moved={...source.item,parentId:parent,order:siblings.length,updatedAt:Date.now()};
        ordered=sidebarSortedSiblings([...items.filter(item=>item.id!==source.id),moved],parent,source.kind);index=ordered.findIndex(item=>item.id===source.id);
        findRow=item=>document.querySelector(`[data-${source.kind==='collections'?'collection':'smart-folder'}-id="${CSS.escape(item.id)}"]`);
      }else if(source.kind==='folders'&&target?.kind==='folders'){
        const folders=folderTreeCache.get(target.location)?.folders||[],siblings=folders.filter(item=>item.path.split('/').slice(0,-1).join('/')===target.path),moved={...(folderTreeCache.get(source.location)?.folders||[]).find(item=>item.path===source.path),name:source.name,path:[target.path,source.name].filter(Boolean).join('/')},sort=sidebarSortValue('folders',`${target.location}:${target.path}`);
        ordered=[...siblings,moved].sort((a,b)=>compareSidebarItems(a,b,sort));index=ordered.indexOf(moved);
        findRow=item=>document.querySelector(`.location-item[data-location-id="${CSS.escape(target.location)}"] [data-subfolder="${CSS.escape(encodeURIComponent(item.path))}"]`);
      }
      const next=index>=0&&ordered.slice(index+1).map(findRow).find(item=>item?.getClientRects().length),previous=index>=0&&ordered.slice(0,index).reverse().map(findRow).find(item=>item?.getClientRects().length);
      if(next){anchor=next;placementZone='before';}else if(previous){anchor=previous;placementZone='after';}
    }
    const rect=anchor.getBoundingClientRect(),style=getComputedStyle(anchor),depth=Number(style.getPropertyValue('--depth'))||0,step=parseFloat(style.getPropertyValue('--tree-step'))||18;
    let tailBottom=rect.bottom;
    const container=anchor.closest('.location-item')||anchor.parentElement;
    const rows=[...container.querySelectorAll(selector)].filter(item=>item.getClientRects().length),index=rows.indexOf(anchor);
    for(let i=index+1;index>=0&&i<rows.length;i++){if((Number(getComputedStyle(rows[i]).getPropertyValue('--depth'))||0)<=depth)break;tailBottom=rows[i].getBoundingClientRect().bottom;}
    const iconLeft=anchor.querySelector('.nav-icon')?.getBoundingClientRect().left??rect.left+8;
    const box=geometry({rect,iconLeft,depth,step,zone:placementZone,tailBottom});
    if(options.depth!==undefined){box.left=iconLeft+(options.depth-depth)*step;box.depth=options.depth;}
    const viewport=document.querySelector('#sidebar-tree-scroll')?.getBoundingClientRect();
    marker.hidden=Boolean(viewport&&(box.top<viewport.top||box.top>viewport.bottom));
    marker.dataset.depth=String(box.depth);Object.assign(marker.style,{left:`${box.left}px`,top:`${box.top}px`,width:`${Math.max(20,box.right-box.left)}px`});
  }
  document.addEventListener('dragstart',event=>{source=metadata(event.target.closest(selector));hide();},true);
  document.addEventListener('dragend',()=>{source=null;reset();},true);
  document.addEventListener('drop',()=>{source=null;hide();queueMicrotask(reset);},true);
  document.addEventListener('dragleave',event=>{if(!event.relatedTarget||!event.relatedTarget.closest?.('#sidebar-tree-scroll'))reset();},true);
  document.addEventListener('scroll',position,true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){source=null;reset();}},true);
  root.PigeonSidebarDropPreview={show,hide,destination,geometry};
})(typeof window==='object'?window:globalThis);
