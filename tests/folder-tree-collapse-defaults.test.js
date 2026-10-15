'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/renderer.js'),'utf8');
function harness(){
  const storage=new Map(),cache=new Map([['root',{folders:[{path:'parent',hasChildren:true},{path:'parent/child',hasChildren:true},{path:'parent/child/leaf',hasChildren:false},{path:'other',hasChildren:true}]}]]);
  const context=vm.createContext({state:{library:{activePortfolioId:'A',locations:[{id:'root'}]}},folderTreeCache:cache,folderTreeCachePortfolioId:'A',localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},locationCollapseKey:(id,path='')=>path?`subfolder:${id}:${path.toLowerCase()}`:`location:${id}`,renderSidebar(){},collectionCollapseKey:id=>`collection:${id}`,smartFolderCollapseKey:id=>`smart-folder:${id}`});
  vm.runInContext(source.slice(source.indexOf('function collapsedFolderStorageKey()'),source.indexOf('function hierarchyCollapseKeys(')),context);
  for(const name of ['setFolderCollapseStates','hierarchyBranchCollapseKeys','toggleHierarchyBranch'])vm.runInContext(source.split('\n').find(line=>line.startsWith(`function ${name}(`)),context);
  return{context,storage,cache,collapsed:()=>vm.runInContext('collapsedFolders()',context),set:(key,value)=>{context.key=key;context.value=value;vm.runInContext('setFolderCollapsed(key,value)',context);}};
}
test('physical roots and newly discovered branches default to collapsed without undoing explicit expansion',()=>{
  const h=harness();assert(h.collapsed().has('location:root'));assert(h.collapsed().has('subfolder:root:parent/child'));
  h.set('location:root',false);h.set('subfolder:root:parent',false);assert(!h.collapsed().has('location:root'));assert(!h.collapsed().has('subfolder:root:parent'));
  h.cache.get('root').folders.push({path:'new',hasChildren:true});assert(h.collapsed().has('subfolder:root:new'));assert(!h.collapsed().has('location:root'));
  h.context.state.library.activePortfolioId='B';h.context.folderTreeCachePortfolioId='B';assert(h.collapsed().has('location:root'));
  h.context.state.library.activePortfolioId='A';h.context.folderTreeCachePortfolioId='A';assert(!h.collapsed().has('location:root'));
});
test('double-click toggles physical branches and expands only one level',()=>{
  const h=harness();h.collapsed();for(const key of ['location:root','subfolder:root:parent','subfolder:root:parent/child','subfolder:root:other'])h.set(key,false);
  h.context.row={dataset:{locationId:'root',subfolder:'parent'},matches:selector=>selector.split(',').includes('.location-folder-item')};
  vm.runInContext('toggleHierarchyBranch(row)',h.context);assert(h.collapsed().has('subfolder:root:parent'));assert(h.collapsed().has('subfolder:root:parent/child'));assert(!h.collapsed().has('subfolder:root:other'));
  vm.runInContext('toggleHierarchyBranch(row)',h.context);assert(!h.collapsed().has('subfolder:root:parent'),'double-click opens the selected collapsed folder');assert(h.collapsed().has('subfolder:root:parent/child'),'deeper descendants must stay collapsed');
  h.context.row={dataset:{locationId:'root'},matches:selector=>selector.split(',').includes('.location-root-button')};vm.runInContext('toggleHierarchyBranch(row)',h.context);
  for(const key of ['location:root','subfolder:root:parent','subfolder:root:parent/child','subfolder:root:other'])assert(h.collapsed().has(key));
  h.context.row={dataset:{},matches:selector=>selector.split(',').includes('.location-root-button'),closest:()=>({dataset:{locationId:'root'}})};vm.runInContext('toggleHierarchyBranch(row)',h.context);
  assert(!h.collapsed().has('location:root'));for(const key of ['subfolder:root:parent','subfolder:root:parent/child','subfolder:root:other'])assert(h.collapsed().has(key));
});
for(const [group,selector,attribute,prefix]of [['collections','.collection-item','collectionId','collection'],['smartFolders','.smart-folder-item','smartFolderId','smart-folder']])test(`double-click ${group} toggles the selected state and never restores deeper expansion`,()=>{
  const h=harness();h.context.state.library[group]=[{id:'r'},{id:'c',parentId:'r'},{id:'g',parentId:'c'},{id:'leaf',parentId:'g'},{id:'unrelated'},{id:'unrelated-child',parentId:'unrelated'}];h.set(`${prefix}:r`,false);h.set(`${prefix}:c`,true);h.set(`${prefix}:g`,false);h.set(`${prefix}:unrelated`,false);
  h.context.row={dataset:{[attribute]:'r'},matches:value=>value.split(',').includes(selector)};vm.runInContext('toggleHierarchyBranch(row)',h.context);assert(h.collapsed().has(`${prefix}:r`),'an expanded parent collapses even when a child was already collapsed');
  vm.runInContext('toggleHierarchyBranch(row)',h.context);assert(!h.collapsed().has(`${prefix}:r`));assert(h.collapsed().has(`${prefix}:c`));assert(h.collapsed().has(`${prefix}:g`));assert(!h.collapsed().has(`${prefix}:unrelated`));
  h.context.row.dataset[attribute]='c';vm.runInContext('toggleHierarchyBranch(row)',h.context);assert(!h.collapsed().has(`${prefix}:c`));assert(h.collapsed().has(`${prefix}:g`));
});
test('folder metadata is not paginated and collapsed descendants are not rendered',()=>{
  assert.match(source,/\[location.id,Number.MAX_SAFE_INTEGER\]/);assert.doesNotMatch(source,/data-load-location-tree|Show \$\{Math.min\(500/);
  assert.match(source,/if\(child.hasChildren&&!collapsedKeys.has\(locationCollapseKey\(location.id,child.path\)\)\)appendFolderLevel/);
});
