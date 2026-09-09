const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
test('large tag catalog initially mounts at most 120 pills and can reveal more',()=>{
 const context={state:{library:{activePortfolioId:'p'}},localStorage:{getItem:()=>null},escapeHtml:value=>value,tagCatalog:()=>[]};
 vm.createContext(context);
 vm.runInContext(renderer.slice(renderer.indexOf('function recentInspectorTags'),renderer.indexOf('function renderTagAutocomplete')),context);
 context.options=Array.from({length:1000},(_,i)=>({tag:`Tag ${i}`,create:false}));
 const html=vm.runInContext('inspectorTagAutocompleteHtml(options)',context);
 assert.equal((html.match(/data-tag-suggestion=/g)||[]).length,120);assert.match(html,/data-tag-show-more/);
 const more=vm.runInContext('inspectorTagSuggestionLimit+=120;inspectorTagAutocompleteHtml(options)',context);
 assert.equal((more.match(/data-tag-suggestion=/g)||[]).length,240);
});
test('dropdown skips duplicate render and respects right panel width',()=>{
 assert.match(renderer,/inspectorTagRenderCache\.catalog===catalog/);
 assert.match(renderer,/popup\.innerHTML = input===elements.tags\?inspectorTagAutocompleteHtml/);
 assert.match(renderer,/Math\.min\(rect.width,elements.inspectorDetailsPanel.clientWidth-24/);
 const css=fs.readFileSync(path.join(__dirname,'../src/styles.css'),'utf8');
 assert.match(css,/minmax\(min\(100%,90px\),1fr\)/);
 assert.match(css,/border:1px solid rgba\(170,180,200,.09\)/);
});
