const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
test('All Tags batches update the data index without per-asset DOM reconciliation',()=>{
 const asset={id:'a',tags:['old']},timers=new Map();let next=0,patches=0,refreshes=0;
 const context={state:{library:{activePortfolioId:'p'}},allTagsViewActive:()=>true,assetById:()=>asset,assetStreamState:{patch(id,patch){Object.assign(asset,patch);patches++;}},clearTimeout:id=>timers.delete(id),setTimeout:fn=>{timers.set(++next,fn);return next;},invalidateTagCache(){refreshes++;},invalidateAssetViewCache(){}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('let allTagsPatchRefreshTimer='),source.indexOf('window.pigeon.onAssetsPatched')),context);
 assert.equal(context.applyAllTagsAssetPatches('p',[{id:'a',tags:['new']}]),true);
 assert.equal(context.applyAllTagsAssetPatches('p',[{id:'a',tags:['newer']}]),true);
 assert.equal(context.applyAllTagsAssetPatches('p',[{id:'a',tags:['newer']}]),true);
 assert.equal(patches,2);assert.equal(timers.size,1);[...timers.values()][0]();assert.equal(refreshes,1);
 assert.equal(context.applyAllTagsAssetPatches('p',[{id:'a',rating:5}]),false);
 context.allTagsViewActive=()=>false;assert.equal(context.applyAllTagsAssetPatches('p',[{id:'a',tags:[]}]),false);
});
