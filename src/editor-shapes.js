(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonEditorShapes=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const isShape=item=>item?.type==='arrow'||item?.type==='marker';
  function svg(item){
    if(!isShape(item))return'';
    const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Math.max(-32768,Math.min(32768,Number(value))):fallback;
    const x=finite(item.x),y=finite(item.y),w=Math.max(1,finite(item.width,1)),h=Math.max(1,finite(item.height,1)),stroke=Math.max(1,Math.min(300,finite(item.stroke,4))),rotation=finite(item.rotation),color=/^#[0-9a-f]{6}$/i.test(item.color||'')?item.color:'#ff3b30';
    let shape;
    if(item.type==='marker')shape=`<ellipse cx="${w/2}" cy="${h/2}" rx="${Math.max(.5,(w-stroke)/2)}" ry="${Math.max(.5,(h-stroke)/2)}"/>`;
    else{const ax=item.reverseX?w:0,ay=item.reverseY?h:0,bx=item.reverseX?0:w,by=item.reverseY?0:h,angle=Math.atan2(by-ay,bx-ax),head=Math.min(Math.hypot(w,h)*.4,Math.max(10,stroke*4)),backX=bx-Math.cos(angle)*head,backY=by-Math.sin(angle)*head,side=head*.5;shape=`<path d="M ${ax} ${ay} L ${bx} ${by} M ${backX-Math.sin(angle)*side} ${backY+Math.cos(angle)*side} L ${bx} ${by} L ${backX+Math.sin(angle)*side} ${backY-Math.cos(angle)*side}"/>`;}
    return`<g transform="translate(${x} ${y}) rotate(${rotation} ${w/2} ${h/2})" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${shape}</g>`;
  }
  function preview(item){const width=Math.max(1,Number(item.width)||1),height=Math.max(1,Number(item.height)||1);return`<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">${svg({...item,x:0,y:0,rotation:0})}</svg>`;}
  return{isShape,svg,preview};
});
