const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createScrollRestorer}=require('../src/virtual-window');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');

for(const interrupted of [false,true])test(`return scroll waits for full destination extent${interrupted?' and yields to user scrolling':''}`,()=>{
  let interaction=0,extent=200,scrollTop=0;
  const restorer=createScrollRestorer({getIdentity:()=> 'original-folder',getInteraction:()=>interaction,write:value=>{scrollTop=Math.min(value,extent);}});
  const classes={add(){},remove(){},toggle(){}};
  const frames=[];
  const context={state:{gridScrollTop:12500},elements:{annotationView:{classList:classes},grid:{classList:classes},gridWrap:{classList:classes}},navigationRenderGeneration:0,navigationPaintFrame:null,cooperativeAssetView:{ready:false},paintActiveNavigation(){},updateSubfolderContentToggle(){},restoreScopedThumbnailSize(){return false;},scheduleGridScrollRestore:(value,options)=>restorer.schedule(value,options),requestAnimationFrame:fn=>frames.push(fn),cancelAnimationFrame(){},renderInspector(){},renderGrid(){restorer.commit({ready:false});}};
  vm.createContext(context);
  const start=renderer.indexOf('function renderNavigationDestination'),end=renderer.indexOf('function clearInlinePasswordDraft',start);
  vm.runInContext(renderer.slice(start,end)+'\nrenderNavigationDestination({waitUntilReady:true});',context);
  while(frames.length)frames.shift()();
  assert.equal(scrollTop,0);
  assert.equal(restorer.pending().scrollTop,12500);
  if(interrupted){interaction++;scrollTop=75;}
  extent=30000;
  assert.equal(restorer.commit({ready:true}),!interrupted);
  assert.equal(scrollTop,interrupted?75:12500);
});

test('Pigeon-tag return opts into readiness-gated restoration',()=>{
  const start=renderer.indexOf('let pigeonTaggedReturnState=');
  const toggle=renderer.slice(start,renderer.indexOf('pigeonTaggedReturnState={',start));
  assert.match(toggle,/renderNavigationDestination\(\{waitUntilReady:true\}\)/);
});
