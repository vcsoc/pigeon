const core=require('./library-core');
function createSidebarGroup(library,type,name,parentId=null){
 if(!['collections','smartFolders'].includes(type))throw new Error('Invalid sidebar group type');
 const group=type==='collections'?core.createCollection(library,name,parentId):core.createSmartFolder(library,name,{},parentId);
 group.isGroup=true;group.icon='folder';return group;
}
module.exports={createSidebarGroup};
