(function(root){
  function create({maxEntries=80,maxBytes=8*1024*1024}={}){
    let entries=[],index=-1,bytes=0;
    const encode=value=>({json:JSON.stringify({edits:value.edits,layers:value.layers}),selected:value.selected});
    const size=entry=>entry.json.length*2;
    function reset(value){entries=[];index=-1;bytes=0;if(value)commit(value);}
    function commit(value){const entry=encode(value);if(entries[index]?.json===entry.json){entries[index].selected=entry.selected;return false;}if(size(entry)>maxBytes){reset();return false;}entries=entries.slice(0,index+1);entries.push(entry);bytes=entries.reduce((sum,item)=>sum+size(item),0);while(entries.length>maxEntries||bytes>maxBytes)bytes-=size(entries.shift());index=entries.length-1;return true;}
    function move(delta){const next=index+delta;if(next<0||next>=entries.length)return null;index=next;return{...JSON.parse(entries[index].json),selected:entries[index].selected};}
    return{reset,commit,undo:()=>move(-1),redo:()=>move(1),get canUndo(){return index>0;},get canRedo(){return index>=0&&index<entries.length-1;}};
  }
  if(typeof module==='object'&&module.exports)module.exports={create};else root.PigeonEditorHistory={create};
})(typeof window==='object'?window:globalThis);
