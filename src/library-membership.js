(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonLibraryMembership=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const untagged=asset=>!(asset.tags||[]).some(tag=>String(tag).trim());
  function classifier({collections=[],smartFolders=[],resolve,matches}){
    const collectionIds=new Set(collections.map(c=>c.id)),resolutions=smartFolders.filter(folder=>!folder.isGroup).map(folder=>resolve(folder)).filter(resolution=>resolution.valid);
    return asset=>!(asset.collectionIds||[]).some(id=>collectionIds.has(id))&&!resolutions.some(resolution=>matches(asset,resolution));
  }
  return{untagged,classifier};
});
