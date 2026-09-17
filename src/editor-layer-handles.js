(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonEditorLayerHandles=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const supports=item=>item?.type==='arrow'||item?.type==='rect';
  const rotate=(point,degrees)=>{const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:point.x*c-point.y*s,y:point.x*s+point.y*c};};
  function point(item,u,v){const w=Number(item.width)||1,h=Number(item.height)||1,d=rotate({x:(u-.5)*w,y:(v-.5)*h},Number(item.rotation)||0);return{x:item.x+w/2+d.x,y:item.y+h/2+d.y};}
  function endpoints(item){return{tail:point(item,item.reverseX?1:0,item.reverseY?1:0),tip:point(item,item.reverseX?0:1,item.reverseY?0:1)};}
  function handles(item){if(!supports(item))return'';const values=item.type==='arrow'?[['tail',item.reverseX?100:0,item.reverseY?100:0,'Arrow tail'],['tip',item.reverseX?0:100,item.reverseY?0:100,'Arrow tip']]:[['nw',0,0,'Top left corner'],['ne',100,0,'Top right corner'],['se',100,100,'Bottom right corner'],['sw',0,100,'Bottom left corner']];return values.map(([key,x,y,label])=>`<i class="annotation-point-handle" data-layer-handle="${key}" style="left:${x}%;top:${y}%" title="${label}: drag to reshape" aria-label="${label}"></i>`).join('');}
  function drag(original,handle,delta){
    if(original.type==='arrow'&&['tail','tip'].includes(handle)){const ends=endpoints(original);ends[handle]={x:ends[handle].x+delta.x,y:ends[handle].y+delta.y};const{tail,tip}=ends,w=Math.max(1,Math.abs(tip.x-tail.x)),h=Math.max(1,Math.abs(tip.y-tail.y));return{x:(tail.x+tip.x-w)/2,y:(tail.y+tip.y-h)/2,width:w,height:h,reverseX:tip.x<tail.x,reverseY:tip.y<tail.y,rotation:0};}
    if(original.type!=='rect'||!['nw','ne','se','sw'].includes(handle))return null;
    const w=original.width,h=original.height,rotation=Number(original.rotation)||0,d=rotate(delta,-rotation),left=handle.includes('w'),top=handle.includes('n'),moving={x:(left?0:w)+d.x,y:(top?0:h)+d.y},fixed={x:left?w:0,y:top?h:0},width=Math.max(1,Math.abs(moving.x-fixed.x)),height=Math.max(1,Math.abs(moving.y-fixed.y)),shift=rotate({x:(moving.x+fixed.x-w)/2,y:(moving.y+fixed.y-h)/2},rotation);
    return{x:original.x+w/2+shift.x-width/2,y:original.y+h/2+shift.y-height/2,width,height};
  }
  return{supports,point,endpoints,handles,drag};
});
