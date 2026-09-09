const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
const start=renderer.indexOf("  if (!editing && !commandKey && !event.altKey && event.key === '0')");
const end=renderer.indexOf('  if (!editing && !commandKey && !event.altKey && /^[1-5]',start);
const handler=renderer.slice(start,end);
for(const scenario of [
  {name:'multiple selected assets',ids:['a','b'],expected:['a','b']},
  {name:'primary selection fallback',ids:[],primary:'a',expected:['a']},
  {name:'empty selection',ids:[],expected:null},
  {name:'text editing',ids:['a'],editing:true,expected:null},
  {name:'zoom modifier',ids:['a'],commandKey:true,expected:null},
  {name:'Alt modifier',ids:['a'],altKey:true,expected:null},
  {name:'key repeat',ids:['a'],repeat:true,expected:null}
])test(`zero rating shortcut: ${scenario.name}`,()=>{
  assert.ok(start>=0&&end>start);
  let result=null;
  const context={editing:!!scenario.editing,commandKey:!!scenario.commandKey,event:{key:'0',altKey:!!scenario.altKey,repeat:!!scenario.repeat,preventDefault(){}},state:{selectedIds:new Set(scenario.ids),selectedId:scenario.primary||null},updateAssetsWithoutGridRefresh(ids,patch){result={ids:[...ids],rating:patch.rating};return Promise.resolve();},showToast(){}};
  vm.runInNewContext(`(function(){${handler}})()`,context);
  assert.deepEqual(result,scenario.expected?{ids:scenario.expected,rating:0}:null);
});
