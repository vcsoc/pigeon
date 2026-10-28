(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonThumbnailMemoryCache=api;})(globalThis,()=>{
  'use strict';
  function create({maxBytes=24*1024*1024,maxEntries=96,onEvict=null}={}){
    const entries=new Map();let bytes=0;
    function remove(key,dispose=true){const entry=entries.get(key);if(!entry)return;bytes-=entry.bytes;entries.delete(key);if(dispose)onEvict?.(entry.value,key);}
    return {
      get(key){const entry=entries.get(key);if(!entry)return null;entries.delete(key);entries.set(key,entry);return entry.value;},
      set(key,value,size){remove(key,entries.get(key)?.value!==value);if(!Number.isFinite(size)||size<=0||size>maxBytes||maxEntries<1)return false;entries.set(key,{value,bytes:size});bytes+=size;while(bytes>maxBytes||entries.size>maxEntries)remove(entries.keys().next().value);return true;},
      deleteWhere(predicate){for(const [key,entry] of entries)if(predicate(entry.value,key))remove(key);},
      clear(){for(const key of entries.keys())remove(key);bytes=0;},
      get bytes(){return bytes;},get size(){return entries.size;}
    };
  }
  return {create};
});
