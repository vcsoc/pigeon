'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
test('privacy mutations reconcile all views and restore membership on failure',async()=>{
  const asset={id:'one',thumbnailEffect:false},calls=[];let reject;const pending=new Promise((_resolve,fail)=>{reject=fail;});
  const context=vm.createContext({state:{library:{activePortfolioId:'p'},selectedId:'one',selectedIds:new Set(['one'])},thumbnailEffectMutationRevision:0,isInternalViewerOpen:()=>false,assetById:()=>asset,currentViewIndices:()=>[0],snapshotAssetForMetadataDelta:value=>({...value}),rendererAssetIndexes:new Map([['one',0]]),paintThumbnailEffectImmediately(assets,enabled){if(typeof enabled==='boolean')for(const item of assets)item.thumbnailEffect=enabled;},applyMetadataViewDelta(changes,options){calls.push({before:changes[0].before.thumbnailEffect,after:changes[0].after.thumbnailEffect,all:options.reconcileAnyView});return false;},invalidateAssetViewCache:()=>calls.push('invalidate'),renderGrid:()=>calls.push('render'),showToast(){},window:{pigeon:{batchUpdateAssets:()=>pending}}});
  vm.runInContext(source.slice(source.indexOf('async function toggleThumbnailEffect('),source.indexOf('async function toggleQuickCheck(')),context);
  const work=context.toggleThumbnailEffect();assert.equal(asset.thumbnailEffect,true);assert.equal(calls[0].all,true);assert.deepEqual(calls.slice(1,3),['invalidate','render']);reject(Error('failed'));await work;
  assert.equal(asset.thumbnailEffect,false);assert.equal(calls[3].all,true);assert.equal(calls[3].before,true);assert.equal(calls[3].after,false);assert.deepEqual(calls.slice(4),['invalidate','render']);
});
