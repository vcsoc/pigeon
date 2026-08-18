(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonVirtualWindow=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function bounded({total,start=0,size=480,columns=1}={}){
    total=Math.max(0,Number(total)||0);size=Math.max(1,Number(size)||480);columns=Math.max(1,Number(columns)||1);
    const maxStart=Math.max(0,total-size),lastStart=Math.min(total,Math.ceil(maxStart/columns)*columns),requested=Math.max(0,Number(start)||0),aligned=requested>=maxStart?lastStart:Math.floor(requested/columns)*columns,end=Math.min(total,aligned+size);
    return{start:aligned,end,count:end-aligned,virtual:total>size};
  }
  function layout({total,start,count,columns=1,rowHeight=1}={}){
    total=Math.max(0,Number(total)||0);start=Math.max(0,Math.min(total,Number(start)||0));count=Math.max(0,Math.min(total-start,Number(count)||0));columns=Math.max(1,Number(columns)||1);rowHeight=Math.max(1,Number(rowHeight)||1);
    const totalRows=Math.ceil(total/columns),startRow=Math.floor(start/columns),endRow=Math.min(totalRows,Math.ceil((start+count)/columns));
    return{topPx:startRow*rowHeight,bottomPx:Math.max(0,(totalRows-endRow)*rowHeight),extentPx:totalRows*rowHeight,windowRows:Math.max(0,endRow-startRow)};
  }
  function createScrollRestorer({getIdentity=()=>'',getInteraction=()=>0,write=()=>{}}={}){
    let pending=null,sequence=0;
    const schedule=(scrollTop,{waitUntilReady=false,interaction=getInteraction()}={})=>(pending={sequence:++sequence,identity:getIdentity(),interaction,scrollTop:Math.max(0,Number(scrollTop)||0),waitUntilReady},pending.sequence);
    const cancel=()=>{pending=null;sequence+=1;};
    const commit=({ready=true}={})=>{
      if(!pending)return false;
      if(pending.identity!==getIdentity()||pending.interaction!==getInteraction()){pending=null;return false;}
      if(pending.waitUntilReady&&!ready)return false;
      const value=pending.scrollTop;pending=null;write(value);return true;
    };
    return{schedule,cancel,commit,pending:()=>pending&&{...pending}};
  }
  return{bounded,layout,createScrollRestorer};
});
