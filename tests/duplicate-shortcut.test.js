'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),start=source.indexOf("  if (!editing && commandKey && event.key.toLowerCase() === 'd')"),end=source.indexOf("  if (commandKey && event.shiftKey",start);assert(start>=0&&end>start);
function run({ids=[],selectedId=null,viewerId=null,editing=false,commandKey=true,key='d',error=null}={}){
 const calls=[],toasts=[];let prevented=false;const sandbox={editing,commandKey,event:{key,preventDefault(){prevented=true;}},state:{selectedIds:new Set(ids),selectedId,viewerAssetId:viewerId},isInternalViewerOpen:()=>Boolean(viewerId),duplicateAssetsWithoutGridRefresh(selected){calls.push([...selected]);return error?Promise.reject(new Error(error)):Promise.resolve([]);},showToast:message=>toasts.push(message)};vm.createContext(sandbox);vm.runInContext('(function(){'+source.slice(start,end)+'})()',sandbox);return{calls,toasts,prevented};
}
for(const kind of ['video','image','audio','document','font','model','other'])test(`Ctrl+D sends selected ${kind} files for duplication`,()=>{const result=run({ids:[kind]});assert.deepEqual(result.calls,[[kind]]);assert.equal(result.prevented,true);});
test('Ctrl+D duplicates the complete mixed selection',()=>assert.deepEqual(run({ids:['video','image','audio','document','other']}).calls,[['video','image','audio','document','other']]));
test('Ctrl+D falls back to the primary selected file',()=>assert.deepEqual(run({selectedId:'video'}).calls,[['video']]));
test('Ctrl+D in the viewer duplicates the viewed file rather than the grid selection',()=>assert.deepEqual(run({ids:['image'],viewerId:'video'}).calls,[['video']]));
test('Ctrl+D does not invoke duplication when there is no selected file',()=>assert.deepEqual(run().calls,[]));
test('Ctrl+D does not intercept typing or unmodified D',()=>{for(const options of [{editing:true,ids:['video']},{commandKey:false,ids:['video']},{key:'x',ids:['video']}]){const result=run(options);assert.deepEqual(result.calls,[]);assert.equal(result.prevented,false);}});
test('Ctrl+D reports copy errors',async()=>{const result=run({ids:['video'],error:'Permission denied'});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(result.toasts,['Permission denied']);});
