(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonDuplicatePlacement=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function place(items,assetFor=item=>item,{collections=[],platform='linux'}={}){
    const duplicateCollections=new Set(collections.filter(c=>String(c.name||'').trim().toLowerCase()==='duplicates').map(c=>c.id)),byId=new Map(),byPath=new Map(),parents=new Map(),children=new Map();
    const pathKey=value=>{const p=String(value||'').replace(/\\/g,'/');return platform==='win32'?p.toLowerCase():p;};
    for(const item of items){const asset=assetFor(item);if(!asset)continue;byId.set(asset.id,{item,asset});if(asset.path)byPath.set(pathKey(asset.path),asset);}
    for(const {asset}of byId.values()){
      let sourceId=asset.duplicateOf;
      // Older Pigeon copies lacked a source link. Recover only copies in the
      // Duplicates collection with the exact timestamped sibling filename.
      if(!sourceId&&(asset.collectionIds||[]).some(id=>duplicateCollections.has(id))){const p=pathKey(asset.path),match=p.match(/^(.*)-\d{8}(?:-\d+)?(\.[^/.]+)$/);if(match){const source=byPath.get(match[1]+match[2]);if(source&&(!source.contentHash||!asset.contentHash||source.contentHash===asset.contentHash))sourceId=source.id;}}
      if(sourceId&&sourceId!==asset.id&&byId.has(sourceId)){parents.set(asset.id,sourceId);if(!children.has(sourceId))children.set(sourceId,[]);children.get(sourceId).push(asset.id);}
    }
    const result=[],seen=new Set(),emit=id=>{const pending=[id];while(pending.length){const next=pending.pop();if(seen.has(next))continue;seen.add(next);result.push(byId.get(next).item);const copies=children.get(next)||[];for(let i=copies.length-1;i>=0;i--)pending.push(copies[i]);}};
    for(const id of byId.keys())if(!parents.has(id))emit(id);
    // Malformed/cyclic imported relationships must not lose or duplicate cards.
    for(const id of byId.keys())if(!seen.has(id))emit(id);
    return result;
  }
  return{place};
});
