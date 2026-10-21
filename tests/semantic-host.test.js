'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createSemanticHost}=require('../electron/semantic-host');
const wait=async predicate=>{const until=Date.now()+8000;while(!(await predicate())){if(Date.now()>until)throw Error('Background coordinator timed out');await new Promise(resolve=>setTimeout(resolve,15));}};
async function fixture(t,count=20){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-semantic-host-')),python=path.join(root,'python');await fs.writeFile(python,'');await fs.writeFile(path.join(root,'semantic-runtime.json'),JSON.stringify({python}));
 let context={portfolioId:'p',databaseFile:path.join(root,'library.db'),loading:false};await fs.writeFile(context.databaseFile+'.semantic-settings.json',JSON.stringify({automatic:false}));
 let assets=Array.from({length:count},(_,i)=>({id:String(i),path:'/fixture/'+i+'.jpg',name:'Reference '+i,kind:'image',size:10,modified:1,tags:['safe'],note:'Background-only coordination '.repeat(5),locationId:'root'}));let index=new Map(assets.map(a=>[a.id,a]));
 const statuses=[],diagnostics=[];const host=createSemanticHost({userData:root,getContext:()=>context,getAssets:()=>assets,getAsset:id=>index.get(id),isAvailable:asset=>!asset.locked,getMetadata:()=>({locations:[{id:'root',path:'/fixture',type:'folder',name:'Fixture'}],collections:[],smartFolders:[]}),getIdleSeconds:()=>600,workerFile:path.join(__dirname,'fixtures/semantic-host-worker.cjs'),emit:status=>statuses.push(status),diagnostic:(...args)=>diagnostics.push(args)});
 t.after(async()=>{await host.close();await fs.rm(root,{recursive:true,force:true});});
 return{host,root,statuses,diagnostics,get assets(){return assets;},switchPortfolio(){host.stop();context={portfolioId:'other',databaseFile:path.join(root,'other.db'),loading:false};assets=[{id:'new',path:'/new.jpg',kind:'image',size:1,modified:1}];index=new Map(assets.map(a=>[a.id,a]));},remove(id){assets=assets.filter(a=>a.id!==id);index.delete(id);}};
}
test('semantic preparation and deliberately CPU-heavy analysis run off the calling event loop',async t=>{
 const f=await fixture(t,50000);let last=performance.now(),maxGap=0,ticks=0;const timer=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;ticks++;},10);t.after(()=>clearInterval(timer));
 assert.equal((await f.host.getStatus()).total,50000);await f.host.start({scope:{type:'folder',id:'root'}});
 await wait(()=>f.statuses.some(s=>s.state==='idle'&&s.indexed===50000));
 assert(f.host.peekStatus().coordinatorThreadId>0,'Coordinator must execute in a worker thread');assert(ticks>20);assert(maxGap<200,`Main-loop stall ${maxGap.toFixed(1)}ms`);
});
test('worker mirror filters locks, keeps current metadata, and rejects stale search results',async t=>{
 const f=await fixture(t);f.assets[1].locked=true;f.host.refreshVisibility();assert.equal((await f.host.getStatus()).total,19);
 await f.host.start({});await wait(()=>f.statuses.some(s=>s.state==='idle'&&s.indexed===19));
 let result=await f.host.search({query:'fixture',all:true});assert(!result.results.some(r=>r.id==='1'));assert(result.results.some(r=>r.id==='0'));
 const search=f.host.search({query:'fixture',all:true});await new Promise(resolve=>setTimeout(resolve,20));f.assets[0].tags=['changed'];f.assets[3].sourceMissing=true;f.host.assetsChanged([f.assets[0]]);result=await search;assert(!result.results.some(r=>r.id==='0'||r.id==='3'));
 f.assets[2].locked=true;f.host.refreshVisibility();assert.equal((await f.host.getStatus()).total,17);
});
test('portfolio switches cancel old work and shutdown acknowledges worker cleanup',async t=>{
 const f=await fixture(t);await f.host.getStatus();await f.host.start({});f.switchPortfolio();const status=await f.host.getStatus();assert.equal(status.portfolioId,'other');assert.equal(status.total,1);await f.host.close();await assert.rejects(f.host.getStatus(),/closing/);
});
