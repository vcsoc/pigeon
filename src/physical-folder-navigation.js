(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.physicalFolderNavigation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function normalizedPath(value){let result=String(value||'').replace(/\\/g,'/');while(result.length>1&&result.endsWith('/')&&!/^[a-z]:\/$/i.test(result))result=result.slice(0,-1);return result;}
  function assetFolderTarget(asset,location,platform='win32'){
    if(!asset||!location||location.type!=='folder'||!asset.path||!location.path)return null;
    const source=normalizedPath(asset.path),rootPath=normalizedPath(location.path),separator=source.lastIndexOf('/');
    if(separator<0)return null;
    const folder=normalizedPath(source.slice(0,separator)||'/'),caseSensitive=platform==='linux',comparable=(value)=>caseSensitive?value:value.toLowerCase(),rootKey=comparable(rootPath),folderKey=comparable(folder);
    if(folderKey===rootKey)return{locationId:location.id,subfolder:''};
    const rootPrefix=rootPath==='/'?'/':`${rootPath}/`;
    if(!folderKey.startsWith(comparable(rootPrefix)))return null;
    const subfolder=folder.slice(rootPrefix.length).split('/').filter(Boolean);
    if(!subfolder.length||subfolder.some((part)=>part==='.'||part==='..'))return null;
    return{locationId:location.id,subfolder:subfolder.join('/')};
  }
  return{assetFolderTarget};
});
