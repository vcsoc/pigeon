(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonBuiltinSmartFolders=api;})(globalThis,function(){
 const ALL_ID='pigeon-builtin-all';
 function all(library){const saved=library?.settings?.builtinSmartFolders?.all;return{id:ALL_ID,name:'All',parentId:null,builtin:true,filters:saved?.filters||{},updatedAt:saved?.updatedAt||0};}
 function isBuiltin(id){return id===ALL_ID;}
 function update(library,filters){if(!filters||typeof filters!=='object'||Array.isArray(filters))throw new Error('Smart Folder conditions must be an object');library.settings||={};library.settings.builtinSmartFolders={...library.settings.builtinSmartFolders,all:{filters:JSON.parse(JSON.stringify(filters)),updatedAt:Date.now()}};return all(library);}
 function protect(id){if(isBuiltin(id))throw new Error('All is a built-in Smart Folder. Edit its conditions or hide it using the categories checklist.');}
 return{ALL_ID,all,isBuiltin,update,protect};
});
