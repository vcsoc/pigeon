const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
for(const scope of [{type:'folder',id:'l',subfolder:'a'},{type:'collection',id:'c'},{type:'smart-folder',id:'s'}])test(`manual rules capture only the ${scope.type} scope across media types`,async()=>{
 let selected;
 const assets=[{id:'yes',kind:'video',locationId:'l',path:'/root/a/video.mp4',collectionIds:['c'],match:true},{id:'nested',kind:'document',locationId:'l',path:'/root/a/child/doc.pdf',collectionIds:['child'],match:true},{id:'no',locationId:'l',path:'/root/ab/file.jpg',collectionIds:['other']},{id:'locked',locationId:'l',path:'/root/a/secret',collectionIds:['c'],match:true,locked:true}];
 const context={state:{library:{activePortfolioId:'p',assets,locations:[{id:'l',path:'/root'}]}},collectionBranchIds:()=>new Set(['c','child']),resolveSmartFolder:()=>({}),matchesSmartFolderResolution:asset=>asset.match,window:{pigeon:{platform:'linux'}},scheduleAssetViewTask:fn=>fn(),requestConfirmation:async()=>true,runAutoTagOptimistically:ids=>{selected=[...ids];},showToast(){}};
 vm.createContext(context);vm.runInContext(renderer.slice(renderer.indexOf('async function runScopedTagRules'),renderer.indexOf('function addScopedTagRuleActions')),context);await context.runScopedTagRules(scope);assert.deepEqual(selected,['yes','nested']);
});
test('manual tagging and automatic indexing use the same configurable engine',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../electron/main.js'),'utf8');assert.match(main,/suggestTags\(asset,library.settings\?\.preferences\|\|\{\}\)/);assert.match(main,/suggestTags\(asset,library.settings\?\.preferences\|\|\{\},false\)/);assert.match(renderer,/PigeonAutoTagRules.generate\(asset,preferences,false\)/);
 const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');assert.match(html,/data-pref="autoTagEnabled"/);assert.match(html,/data-pref="autoTagRulesJson"/);
});
