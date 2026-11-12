'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
test('completed cooperative view does not repaint a queued stale preview',()=>{
  const frames=[];let callbacks,renders=0;
  const context=vm.createContext({cooperativeAssetView:null,state:{library:{assets:[],assetStreamPending:false,totalAssets:0}},captureAssetViewCriteria:()=>({expandedStacks:new Set()}),performance:{now:()=>0},VIRTUAL_ASSET_WINDOW:120,requestAnimationFrame:fn=>frames.push(fn),scheduleAssetViewTask(){},assetMatchesViewCriteria:()=>true,compareAssetsForView:()=>0,renderGrid:()=>renders++,completeCooperativeAssetView:view=>{view.ready=true;},window:{PigeonCooperativeView:{build:options=>{callbacks=options;return{cancel(){}};}}}});
  vm.runInContext(source.slice(source.indexOf('function startCooperativeAssetView('),source.indexOf('let semanticIndexCache=')),context);
  const view=context.startCooperativeAssetView('test');callbacks.onPreview([0],{scanned:1});callbacks.onDone([0]);assert.equal(view.ready,true);frames.forEach(fn=>fn());assert.equal(renders,0);
});
