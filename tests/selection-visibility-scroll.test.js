const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
for(const top of [0,100,400,800])test(`visible successor at ${top}px is focused without scrolling or remounting`,()=>{
  let scrolls=0,mounts=0,focuses=0;
  const rect={top,bottom:top+100,left:0,right:100,width:100,height:100};
  const card={getBoundingClientRect:()=>rect,focus(options){assert.equal(options.preventScroll,true);focuses++;},scrollIntoView(){scrolls++;}};
  const context={state:{selectedId:'a'},gridScrollInteractionVersion:1,CSS:{escape:id=>id},elements:{grid:{querySelector:()=>card},gridWrap:{scrollTop:600,getBoundingClientRect:()=>({top:0,bottom:1000,left:0,right:1000})}},requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn(),saveNavigationState(){}};
  vm.createContext(context);
  const helper=source.slice(source.indexOf('function selectedCardFullyVisible'),source.indexOf('function ensureVirtualSelectedAssetWindow'));
  const focus=source.slice(source.indexOf('function focusSelectedAsset'),source.indexOf('function navigateAssets'));
  context.ensureVirtualSelectedAssetWindow=()=>{mounts++;};
  vm.runInContext(helper+focus+"\nfocusSelectedAsset({lockScroll:true,block:'center'});",context);
  assert.ok(focuses>0);assert.equal(scrolls,0);assert.equal(mounts,0);
  assert.equal(context.elements.gridWrap.scrollTop,600);
});
test('visibility check rejects missing and clipped cards',()=>{
  const context={elements:{gridWrap:{getBoundingClientRect:()=>({top:0,bottom:500,left:0,right:500})}}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function selectedCardFullyVisible'),source.indexOf('function ensureVirtualSelectedAssetWindow')),context);
  assert.equal(context.selectedCardFullyVisible(null),false);
  for(const top of [-25,450])assert.equal(context.selectedCardFullyVisible({getBoundingClientRect:()=>({top,bottom:top+100,left:0,right:100,width:100,height:100})}),false);
});
