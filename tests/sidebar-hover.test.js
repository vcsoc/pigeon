const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const renderer=fs.readFileSync(path.join(__dirname,'..','src','renderer.js'),'utf8');
const start=renderer.indexOf('const sidebarTreeSignatures=');
const end=renderer.indexOf('function renderSidebar',start);
const context={};
vm.runInNewContext(`${renderer.slice(start,end)};this.sidebarApi={reconcileSidebarTree,sidebarTreeStructure};`,context);
const {reconcileSidebarTree,sidebarTreeStructure}=context.sidebarApi;

function fakeTree(markup,countValues){
  const counts=countValues.map((textContent)=>({textContent})),tree={querySelectorAll(selector){assert.equal(selector,'small');return counts;}};
  let writes=0,currentMarkup=markup;
  Object.defineProperty(tree,'innerHTML',{get(){return currentMarkup;},set(value){writes+=1;currentMarkup=value;}});
  return {tree,counts,get writes(){return writes;}};
}

test('count-only sidebar refresh preserves row identity and continuous nested hover ownership',()=>{
  const before='<button class="nav-item collection-item" data-collection-id="parent"><span class="folder-tree-toggle">▾</span><span>Parent</span><small>7</small></button><button class="nav-item collection-item" data-collection-id="child"><span class="nav-icon">◆</span><span>Child</span><small>3</small></button>';
  const after=before.replace('<small>7</small>','<small>8</small>').replace('<small>3</small>','<small>4</small>');
  const fixture=fakeTree(before,['7','3']),rowIdentity={id:'child'},nestedTargets=['toggle','icon','text','count','action'];
  assert.equal(reconcileSidebarTree(fixture.tree,before),true);
  const writesAfterInitialRender=fixture.writes;
  for(const target of nestedTargets){assert.equal(reconcileSidebarTree(fixture.tree,after),false,`moving across ${target} must not replace the row`);assert.equal(rowIdentity.id,'child');}
  assert.equal(fixture.writes,writesAfterInitialRender);
  assert.deepEqual(fixture.counts.map((node)=>node.textContent),['8','4']);
});

test('Smart Folder and physical Folder count updates share stable structure while real changes rebuild',()=>{
  const smart='<button class="nav-item smart-folder-item active" data-smart-folder-id="s"><span>Unrated</span><small>5198</small></button>';
  const folder='<div class="location-item"><button class="nav-item location-folder-item" data-subfolder="photos"><span>Photos</span><small>100</small></button></div>';
  assert.equal(sidebarTreeStructure(smart),sidebarTreeStructure(smart.replace('5198','5197')));
  assert.equal(sidebarTreeStructure(folder),sidebarTreeStructure(folder.replace('100','101')));
  const fixture=fakeTree(smart,['5198']);reconcileSidebarTree(fixture.tree,smart);
  assert.equal(reconcileSidebarTree(fixture.tree,smart.replace('5198','5197')),false);
  assert.equal(reconcileSidebarTree(fixture.tree,smart.replace('active','')),true,'selection/class changes still rebuild');
});

test('sidebar event wiring runs only after a structural replacement',()=>{
  const sidebar=renderer.slice(renderer.indexOf('function renderSidebar'),renderer.indexOf('let selectedTagNames'));
  assert.match(sidebar,/if\(collectionsRebuilt\) \$\$\('\.collection-item'\)\.forEach/);
  assert.match(sidebar,/if\(smartFoldersRebuilt\) \$\$\('#smart-folder-list \[data-smart-folder-id\]'\)\.forEach/);
  assert.match(sidebar,/if\(locationsRebuilt\) \$\$\('\.location-item'\)\.forEach/);
  assert.doesNotMatch(sidebar,/pointer(?:enter|leave|move|over|out)/i);
});
