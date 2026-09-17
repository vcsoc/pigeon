(function(root){
 let dialog,items=[],seed=1,busy=false,generation=0,plan=null,dragFrom=null,dropIndex=null,placeholder=null;
 function create(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='combine-images-dialog';dialog.className='combine-images-dialog';
  dialog.innerHTML=`<form><h2>Combine Images</h2><p>Drag previews to reorder. Drag the bottom-right corner to resize this window. Originals are never changed.</p><fieldset><label>Layout <select name="layout"><option value="horizontal">Side by side — landscape</option><option value="vertical">Stacked — portrait</option><option value="mosaic">Mosaic / random</option><option value="rows">Tiled — N images per row</option><option value="columns">Tiled — N images per column</option></select></label><label>Images per row / column <input name="n" type="number" min="1" max="64" value="4"></label><label><input name="filenames" type="checkbox"> Show filenames below images</label><label>Maximum width (px) <input name="maxWidth" type="number" min="0" max="16384" value="4096"></label><label>Maximum height (px) <input name="maxHeight" type="number" min="0" max="16384" value="4096"></label><label>Background <input name="background" type="color" value="#ffffff"></label><button type="button" data-shuffle>Shuffle mosaic</button><p>Images fit proportionally without cropping. 0 uses the automatic limit (8,192px per side, 40 megapixels total). Animated images use their first frame.</p></fieldset><div class="combine-preview-viewport"><div data-combine-preview class="combine-preview"></div></div><p data-combine-status role="status"></p><footer><button type="button" data-cancel>Cancel</button><button type="submit">Save combined PNG…</button></footer></form>`;
  document.body.append(dialog);
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.querySelector('fieldset').addEventListener('input',preview);
  dialog.querySelector('[data-shuffle]').onclick=()=>{seed=(Math.random()*0xffffffff)>>>0;preview();};
  dialog.querySelector('[data-cancel]').onclick=()=>{generation++;clearDrag();if(busy)window.pigeon.cancelCombineImages();dialog.close();};
  dialog.addEventListener('cancel',()=>{generation++;clearDrag();if(busy)window.pigeon.cancelCombineImages();});
  dialog.addEventListener('close',clearDrag);
  const viewport=dialog.querySelector('.combine-preview-viewport');
  new ResizeObserver(fitPreview).observe(viewport);
  viewport.addEventListener('dragover',event=>{
   if(dragFrom===null||busy)return;
   const figures=[...dialog.querySelectorAll('.combine-preview figure')];let closest=null,distance=Infinity;
   for(const figure of figures){const r=figure.getBoundingClientRect(),dx=Math.max(r.left-event.clientX,0,event.clientX-r.right),dy=Math.max(r.top-event.clientY,0,event.clientY-r.bottom),d=dx*dx+dy*dy;if(d<distance){distance=d;closest=figure;}}
   if(closest)showDrop(event,closest);
  });
  viewport.addEventListener('dragleave',event=>{if(!viewport.contains(event.relatedTarget)){placeholder?.remove();placeholder=null;dropIndex=null;}});
  viewport.addEventListener('drop',event=>{
   if(dragFrom===null)return;event.preventDefault();event.stopPropagation();
   const raw=event.dataTransfer.getData('application/x-pigeon-combine-index'),from=Number(raw),to=dropIndex;
   if(!busy&&raw!==''&&Number.isInteger(from)&&from===dragFrom&&from>=0&&from<items.length&&to!==null){const visual=plan.cells.map(cell=>items[cell.index]),position=plan.cells.findIndex(cell=>cell.index===from),[item]=visual.splice(position,1);visual.splice(to,0,item);const next=[...items];plan.cells.forEach((cell,index)=>{next[cell.index]=visual[index];});items=next;clearDrag();preview();}else clearDrag();
  });
  dialog.querySelector('form').addEventListener('submit',async event=>{
   event.preventDefault();if(busy)return;clearDrag();const token=generation;busy=true;
   dialog.querySelector('fieldset').disabled=true;dialog.querySelector('[type=submit]').disabled=true;status('Combining images…');
   try{const result=await window.pigeon.combineImages({ids:items.map(a=>a.id),options:options()});if(token===generation)status(result?`Saved ${result.width} × ${result.height}: ${result.path}`:'Cancelled — no image saved');}
   catch(error){if(token===generation)status(error.message);}
   finally{busy=false;dialog.querySelector('fieldset').disabled=false;dialog.querySelector('[type=submit]').disabled=false;}
  });
 }
 function options(){const f=dialog.querySelector('form').elements;return{layout:f.layout.value,n:Number(f.n.value),maxWidth:Number(f.maxWidth.value),maxHeight:Number(f.maxHeight.value),filenames:f.filenames.checked,background:f.background.value,seed};}
 function status(text){dialog.querySelector('[data-combine-status]').textContent=text;}
 function fitPreview(){
  if(!plan||!dialog.open)return;
  const viewport=dialog.querySelector('.combine-preview-viewport'),host=dialog.querySelector('[data-combine-preview]'),width=Math.max(1,Math.min(viewport.clientWidth,viewport.clientHeight*plan.width/plan.height));
  host.style.width=`${width}px`;host.style.height=`${width*plan.height/plan.width}px`;
 }
 function clearDrag(){dragFrom=null;dropIndex=null;placeholder?.remove();placeholder=null;dialog?.querySelectorAll('.combine-drag-source').forEach(figure=>figure.classList.remove('combine-drag-source'));}
 function showDrop(event,figure){
  if(dragFrom===null||busy)return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';
  const index=Number(figure.dataset.combineIndex),vertical=['vertical','columns'].includes(options().layout),rect=figure.getBoundingClientRect(),after=vertical?event.clientY>rect.top+rect.height/2:event.clientX>rect.left+rect.width/2,targetPosition=plan.cells.findIndex(cell=>cell.index===index),fromPosition=plan.cells.findIndex(cell=>cell.index===dragFrom),boundary=targetPosition+(after?1:0);
  dropIndex=boundary-(fromPosition<boundary?1:0);
  if(dropIndex===fromPosition){placeholder?.remove();placeholder=null;return;}
  const host=dialog.querySelector('[data-combine-preview]'),cell=plan.cells[targetPosition];
  if(!placeholder){placeholder=document.createElement('div');placeholder.className='combine-drop-placeholder';placeholder.innerHTML='<span></span>';host.append(placeholder);}
  placeholder.classList.toggle('vertical-insertion',vertical);placeholder.classList.toggle('after',after);
  Object.assign(placeholder.style,{left:100*cell.x/plan.width+'%',top:100*cell.y/plan.height+'%',width:100*cell.width/plan.width+'%',height:100*cell.height/plan.height+'%'});
  placeholder.querySelector('span').textContent=`${after?'After':'Before'} · position ${dropIndex+1}`;
  placeholder.dataset.dropIndex=String(dropIndex);
 }
 function preview(){
  clearDrag();
  try{
   plan=root.PigeonImageComposition.layout(items.map(a=>{let width=Number(a.width)||4,height=Number(a.height)||3;if(Math.abs(Number(a.rotation)||0)%180===90)[width,height]=[height,width];return{width,height};}),options());
   const host=dialog.querySelector('[data-combine-preview]');host.replaceChildren();host.style.background=options().background;
   for(const cell of plan.cells){
    const asset=items[cell.index],figure=document.createElement('figure'),image=document.createElement('img');figure.draggable=true;figure.dataset.combineIndex=String(cell.index);figure.dataset.assetId=asset.id;
    Object.assign(figure.style,{left:100*cell.x/plan.width+'%',top:100*cell.y/plan.height+'%',width:100*cell.width/plan.width+'%',height:100*cell.height/plan.height+'%'});
    image.src=asset.previewUrl||'';image.alt=asset.filename||asset.name;image.draggable=false;
    const rotation=Number(asset.rotation)||0,quarter=Math.abs(rotation)%180===90;
    Object.assign(image.style,{position:'absolute',left:'50%',top:50*cell.imageHeight/cell.height+'%',width:quarter?100*cell.imageHeight/cell.width+'%':'100%',height:100*(quarter?cell.width:cell.imageHeight)/cell.height+'%',transform:`translate(-50%,-50%) rotate(${rotation}deg)`});figure.append(image);
    if(cell.labelHeight){const caption=document.createElement('figcaption');caption.textContent=asset.filename||asset.name;const color=parseInt(options().background.slice(1),16);caption.style.color=((color>>16)*.299+((color>>8)&255)*.587+(color&255)*.114)>128?'#222222':'#f5f5f5';Object.assign(caption.style,{position:'absolute',bottom:'0',width:'100%',height:100*cell.labelHeight/cell.height+'%'});figure.append(caption);}
    figure.ondragstart=event=>{if(busy){event.preventDefault();return;}clearDrag();dragFrom=cell.index;event.stopPropagation();event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-pigeon-combine-index',String(cell.index));figure.classList.add('combine-drag-source');};
    figure.ondragend=clearDrag;
    host.append(figure);
   }
   fitPreview();status(`${items.length} images · preview ${plan.width} × ${plan.height}. Export uses source dimensions.`);
  }catch(error){plan=null;dialog.querySelector('[data-combine-preview]').replaceChildren();status(error.message);}
 }
 root.PigeonCombineImages={open(assets){create();if(busy)return;clearDrag();items=assets.filter(a=>a.kind==='image'&&!a.locked&&!a.deletedAt);generation++;if(items.length<2||items.length>64){plan=null;dialog.querySelector('[data-combine-preview]').replaceChildren();status('Select 2–64 unlocked images');if(!dialog.open)dialog.showModal();return;}preview();if(!dialog.open)dialog.showModal();fitPreview();}};
})(globalThis);
