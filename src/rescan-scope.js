(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonRescanScope=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  // Virtual collections own membership, not directories. Never create locations or
  // automatically add neighbours to a collection while discovering source files.
  function plan({locations=[],assets=[],scope,collectionIds=[],smartResolution,platform='linux'}={}){
    if(!scope)return[];
    const sources=locations.filter(location=>!location.autoImportLegacyRoot),byId=new Map(sources.map(location=>[location.id,location]));
    if(scope.type==='folder')return byId.has(scope.id)?[{id:scope.id,subfolder:scope.subfolder||''}]:[];
    let members;
    if(scope.type==='collection'){const ids=new Set(collectionIds);members=assets.filter(asset=>(asset.collectionIds||[]).some(id=>ids.has(id)));}
    else if(scope.type==='smart-folder'){
      if(!smartResolution?.valid)return[];
      const filters=smartResolution.chain.map(folder=>folder.filters||{}),allowed=sources.filter(location=>filters.every(filter=>!filter.locationIds?.length||filter.locationIds.includes(location.id)));
      const constraints=filters.filter(filter=>filter.collectionIds?.length);
      if(!constraints.length)return allowed.map(location=>({id:location.id,subfolder:''}));
      const ids=new Set(allowed.map(location=>location.id));members=assets.filter(asset=>ids.has(asset.locationId)&&constraints.every(filter=>filter.collectionIds.some(id=>(asset.collectionIds||[]).includes(id))));
    }else return[];
    const normalize=value=>{const text=String(value||'').replace(/\\/g,'/').replace(/\/+$/,'');return platform==='win32'?text.toLowerCase():text;},requests=[];
    for(const asset of members){if(asset.deletedAt||asset.locked)continue;const location=byId.get(asset.locationId);if(!location)continue;
      let subfolder='';if(location.type!=='file'){const root=normalize(location.path),file=normalize(asset.path);if(!file.startsWith(root+'/'))continue;const relative=String(asset.path).replace(/\\/g,'/').slice(root.length+1);subfolder=relative.includes('/')?relative.slice(0,relative.lastIndexOf('/')):'';}
      const key=normalize(subfolder),same=requests.filter(request=>request.id===location.id);
      if(same.some(request=>!request.subfolder||key===normalize(request.subfolder)||key.startsWith(normalize(request.subfolder)+'/')))continue;
      for(let i=requests.length-1;i>=0;i--)if(requests[i].id===location.id&&(!key||normalize(requests[i].subfolder).startsWith(key+'/')))requests.splice(i,1);
      requests.push({id:location.id,subfolder});
    }
    return requests;
  }
  return{plan};
});
