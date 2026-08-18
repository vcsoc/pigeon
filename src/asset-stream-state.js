(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonAssetStreamState=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create({minimumViewport=120,onReset=()=>{},onUpsert=()=>{},onPatch=()=>{}}={}){
    let library={locations:[],assets:[]},generation=0,indexes=new Map(),complete=true,firstUsable=false;
    const begin=(shell={})=>{generation=Number(shell.streamGeneration)||0;library={locations:[],collections:[],smartFolders:[],settings:{},...shell,assets:[]};complete=!shell.assetStreamPending;firstUsable=false;indexes=new Map();onReset(library);return library;};
    const upsertMany=(assets=[])=>{let added=0,updated=0;for(const asset of assets){if(!asset||asset.locked||!asset.id)continue;const index=indexes.get(asset.id);if(index===undefined){indexes.set(asset.id,library.assets.length);library.assets.push(asset);onUpsert(asset,null);added+=1;}else{const previous=library.assets[index];library.assets[index]=asset;onUpsert(asset,previous);updated+=1;}}library.totalAssets=Math.max(Number(library.totalAssets)||0,library.assets.length);if(!firstUsable&&library.assets.length>0)firstUsable=true;return{added,updated,firstUsable};};
    const applyChunk=(message={})=>Number(message.generation)!==generation?{accepted:false,stale:true}:{accepted:true,...upsertMany(message.assets||[])};
    const finish=(message={})=>{if(Number(message.generation)!==generation)return{accepted:false,stale:true};complete=true;library.assetStreamPending=false;library.totalAssets=library.assets.length;return{accepted:true,complete:true};};
    const patch=(id,value={})=>{const index=indexes.get(id);if(index===undefined)return false;const previous=library.assets[index],next={...previous,...value};library.assets[index]=next;onPatch(next,previous);return true;};
    return{begin,applyChunk,finish,upsertMany,patch,get library(){return library;},get generation(){return generation;},get indexes(){return indexes;},get complete(){return complete;},get firstUsable(){return firstUsable;}};
  }
  return{create};
});
