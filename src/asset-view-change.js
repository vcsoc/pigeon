(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonAssetViewChange=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const flags=['favorite','quickChecked','thumbnailEffect','sourceMissing','sourcePending','permissionDenied','locked'],numbers=['width','height','rotation','rating','size','modified','indexedAt','editedAt','proxyVersion','duration','thumbnailFailedAt'],text=['name','filename','path','locationId','kind','extension','note','dominantColor','editedPath','proxyPath','permissionError','thumbnailError'];
  const url=value=>String(value||'').replace(/([?&])s=[^&]*/g,'');
  function changed(before,after,compare=()=>0){
    if(!before||!after)return true;
    if(flags.some(key=>Boolean(before[key])!==Boolean(after[key]))||numbers.some(key=>(Number(before[key])||0)!==(Number(after[key])||0))||text.some(key=>String(before[key]||'')!==String(after[key]||'')))return true;
    if(['tags','collectionIds'].some(key=>JSON.stringify(before[key]||[])!==JSON.stringify(after[key]||[])))return true;
    return url(before.previewUrl)!==url(after.previewUrl)||url(before.mediaUrl)!==url(after.mediaUrl)||Boolean(before.thumbnailPath)!==Boolean(after.thumbnailPath)||Boolean(before.deletedAt)!==Boolean(after.deletedAt)||compare(before,after)!==0;
  }
  return {changed};
});
