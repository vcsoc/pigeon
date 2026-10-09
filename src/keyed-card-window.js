(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonKeyedCardWindow=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 // Keep retained cards connected: changing a virtual row must not rebuild every
 // image, magnifier or hover-media node in the viewport.
 function reconcile(host,ids,html){const wanted=new Set(ids),cards=new Map();for(const card of [...host.children]){const id=card.dataset.assetId;if(!wanted.has(id))card.remove();else cards.set(id,card);}if(html){const template=host.ownerDocument.createElement('template');template.innerHTML=html;for(const card of [...template.content.children])cards.set(card.dataset.assetId,card);}let cursor=host.firstElementChild,moved=0;for(const id of ids){const card=cards.get(id);if(!card)throw Error('Missing virtual card '+id);if(card===cursor)cursor=cursor.nextElementSibling;else{host.insertBefore(card,cursor);moved++;}}return{moved,count:ids.length};}
 return{reconcile};
});
