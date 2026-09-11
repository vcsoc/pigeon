(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonPortfolioNavigation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function resolve(saved,library,visibleViews,sections={}){
    const fallback=()=>{const result={view:visibleViews[0]||'all'};if(visibleViews.length)return result;for(const [kind,key]of [['smartFolders','smartFolderId'],['collections','collectionId'],['locations','locationId']]){if(sections[kind]===false)continue;const roots=(library[kind]||[]).filter(item=>!item.parentId),item=(sections.orderRoots?sections.orderRoots(roots,kind):roots)[0];if(item)return {...result,[key]:item.id};}return result;};
    if(!saved||typeof saved!=='object')return fallback();
    for(const [key,kind]of [['locationId','locations'],['collectionId','collections'],['smartFolderId','smartFolders']]){
      if(!saved[key])continue;if(!(library[kind]||[]).some(item=>item.id===saved[key]))return fallback();
      return {...saved,view:'all',locationId:null,locationSubfolder:'',collectionId:null,smartFolderId:null,[key]:saved[key],...(key==='locationId'?{locationSubfolder:String(saved.locationSubfolder||'')}:{})};
    }
    return visibleViews.includes(saved.view)?saved:fallback();
  }
  return {resolve};
});
