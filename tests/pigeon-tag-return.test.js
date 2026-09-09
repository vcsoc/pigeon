const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/renderer.js'),'utf8');
test('double Escape round trip restores folder, filters, selection and scroll',()=>{
  const state={library:{activePortfolioId:'portfolio'},view:'all',locationId:'usb',locationSubfolder:'pictures/travel',collectionId:null,smartFolderId:null,selectedId:'photo',selectedIds:new Set(['photo','other']),selectionAnchorId:'photo',similarIds:null,showCheckedOnly:false,includeSubfolderContent:false,kind:'image',query:'trip',filters:{tags:new Set(['travel']),ratings:new Set([5])},gridScrollTop:1234};
  const elements={search:{value:'trip'},title:{textContent:'Travel'},gridWrap:{scrollTop:1234}};
  const context={state,elements,Set,hideInternalViewer(){},clearInlinePasswordDraft(){},resetRenderLimit(){},updateFilterChips(){},renderNavigationDestination(){},clearSelection(){state.selectedIds.clear();state.selectionAnchorId=null;},captureNavigationSnapshot:undefined};
  const start=source.indexOf('let pigeonTaggedReturnState=');
  // The original compact final line terminates the toggle.
  const match=source.slice(start).match(/^[\s\S]*?renderNavigationDestination\(\);\}/);
  vm.createContext(context);const capture=source.slice(source.indexOf('function captureNavigationSnapshot'),source.indexOf('function applyNavigationSnapshot'));vm.runInContext(capture+match[0]+'\nopenPigeonTaggedView();',context);
  assert.equal(state.view,'pigeon-tag');assert.deepEqual([...state.filters.tags],['pigeon']);
  vm.runInContext('openPigeonTaggedView()',context);
  assert.equal(state.locationSubfolder,'pictures/travel');assert.equal(state.locationId,'usb');assert.equal(state.gridScrollTop,1234);
  assert.equal(state.query,'trip');assert.equal(state.selectedId,'photo');assert.deepEqual([...state.selectedIds],['photo','other']);assert.deepEqual([...state.filters.tags],['travel']);assert.equal(elements.title.textContent,'Travel');
});
