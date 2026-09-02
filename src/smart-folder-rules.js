(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonSmartFolderRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function resolve(folders=[],folderOrId){
    const list=Array.isArray(folders)?folders:[],byId=new Map(list.filter((folder)=>folder?.id).map((folder)=>[folder.id,folder])),target=typeof folderOrId==='object'?folderOrId:byId.get(folderOrId);
    if(!target)return{folder:null,chain:[],inherited:[],valid:false,cycle:false,missing:true,missingParentId:null};
    const chain=[],seen=new Set();let current=target,cycle=false,missingParentId=null;
    while(current){if(seen.has(current.id)){cycle=true;break;}seen.add(current.id);chain.unshift(current);if(!current.parentId)break;const parent=byId.get(current.parentId);if(!parent){missingParentId=current.parentId;break;}current=parent;}
    return{folder:target,chain,inherited:chain.slice(0,-1),valid:!cycle,cycle,missing:false,missingParentId};
  }
  function matchesResolved(asset,resolution,evaluator){return Boolean(resolution?.folder&&resolution.valid&&typeof evaluator==='function'&&resolution.chain.every((folder)=>evaluator(asset,folder.filters||{})));}
  function matches(asset,folders,folderOrId,evaluator){return matchesResolved(asset,resolve(folders,folderOrId),evaluator);}
  function dependsOnField(folders,folderOrId,field){const resolution=resolve(folders,folderOrId);return resolution.valid&&resolution.chain.some((folder)=>(folder.filters?.rules||[]).some((rule)=>rule.field===field));}
  return{resolve,matches,matchesResolved,dependsOnField};
});
