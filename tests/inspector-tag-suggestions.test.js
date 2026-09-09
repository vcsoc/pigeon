const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
function setup(){const storage=new Map();const context={state:{library:{activePortfolioId:'one'}},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}};vm.createContext(context);vm.runInContext(renderer.slice(renderer.indexOf('function recentInspectorTags'),renderer.indexOf('function renderTagAutocomplete')),context);return context;}
test('recommendations prioritize recent tags then popular tags without duplicates',()=>{
 const c=setup(),groups=c.inspectorTagGroups(['Zoo','Apple','Banana','2D','apricot'],['zoo','removed'],[{name:'Apple',count:10}]);
 assert.deepEqual(JSON.parse(JSON.stringify(groups)),[['Recommended & recent',['Zoo','Apple']],['0–9',['2D']],['A',['apricot']],['B',['Banana']]]);
});
test('recommendations are bounded and the remainder stays alphabetically grouped',()=>{
 const c=setup(),tags=Array.from({length:30},(_,i)=>`A${i}`),groups=c.inspectorTagGroups(tags,tags,[]);
 assert.equal(groups[0][1].length,8);assert.equal(groups[1][0],'A');assert.equal(groups[1][1].length,22);
});
test('recent tags persist per portfolio, deduplicate, and tolerate corrupt storage',()=>{
 const c=setup();c.rememberInspectorTags(['Bird','Travel']);c.rememberInspectorTags(['travel','Sky']);
 assert.deepEqual([...c.recentInspectorTags()].map(tag=>tag.toLowerCase()),['travel','sky','bird']);
 c.state.library.activePortfolioId='two';assert.equal(c.recentInspectorTags().length,0);
 c.localStorage.setItem('pigeon.recentTags:two','broken');assert.equal(c.recentInspectorTags().length,0);
});
test('pill dropdown is inspector-only and retains click-to-apply and search',()=>{
 assert.match(renderer,/input===elements.tags\?Infinity:40/);
 assert.match(renderer,/inspectorTagAutocompleteHtml\(options,token.query\)/);
 assert.match(renderer,/data-tag-suggestion/);
 assert.match(renderer,/addTagsToAssets\(targets,\[tag\]\)/);
});
