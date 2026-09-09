const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
for(const fail of [false,true])test(`tag replacement paints before backend completion and ${fail?'rolls back errors':'finalizes counts'}`,async()=>{
 const order=[],catalog=[{name:'one',count:1},{name:'two',count:1}],assets=[{tags:['one','two']}];
 const c={rendererAssetDerivatives:{upsert(){}},scheduleAssetViewTask:fn=>fn(),gridScrollInteractionVersion:1,pendingTagReplacement:null,selectedTagNames:new Set(['one','two']),state:{library:{activePortfolioId:'p',assets}},elements:{gridWrap:{scrollTop:500}},allTagsViewActive:()=>true,$$:()=>catalog.map(tag=>({dataset:{tag:tag.name}})),requestText:async()=> 'merged',tagCatalog:()=>catalog,renderTagBrowser(){order.push('paint');},revealSelectedTag(){order.push('reveal');},showToast(){},requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn(),invalidateTagCache(){},renderInspector(){},window:{pigeon:{replaceTags:async()=>{order.push('save');if(fail)throw Error('disk error');return{replacement:'merged',updatedAssets:1};}}}};
 vm.createContext(c);const start=renderer.indexOf('async function replaceSelectedTags'),end=renderer.indexOf("elements.tagBrowser.addEventListener('click'",start);
 vm.runInContext(renderer.slice(start,end),c);
 assert.equal(await c.replaceSelectedTags(),!fail);
 assert.ok(order.indexOf('paint')<order.indexOf('save'));assert.ok(order.indexOf('reveal')<order.indexOf('save'));
 assert.equal(c.pendingTagReplacement,null);
 assert.deepEqual([...c.selectedTagNames],fail?['one','two']:['merged']);
 if(!fail)assert.equal(c.cachedTagCatalog[0].count,1);
});
test('tag catalog refresh reuses rows rather than clearing the list',()=>{
 const body=renderer.slice(renderer.indexOf('function reconcileTagBrowserRows'),renderer.indexOf('function renderTagBrowser'));
 assert.doesNotMatch(body,/host\.innerHTML\s*=/);
 assert.match(body,/rows\.get\(key\)\|\|template\.cloneNode\(true\)/);
 assert.match(body,/if\(row!==cursor\)grid\.insertBefore/);
 assert.match(body,/scrollTop\+anchor\.getBoundingClientRect\(\)\.top-anchorTop/);
});
