(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonProgressivePreview=api;})(globalThis,function(){
 function load({image,cached,original,isCurrent=()=>true,createImage=()=>new Image()}){let cancelled=false,full=null;image.src=cached||original;if(cached&&original&&cached!==original){full=createImage();full.decoding='async';full.onload=()=>{if(!cancelled&&isCurrent()&&full.naturalWidth)image.src=original;};full.onerror=()=>{};full.src=original;}return()=>{cancelled=true;if(full){full.onload=null;full.onerror=null;full.src='';}};}
 return{load};
});
