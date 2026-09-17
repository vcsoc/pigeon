const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');const{createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs');process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-layout-bounds-')),fixture=await createFixtures(root,{count:529,coldCount:0}),report=path.join(root,'report');await fs.mkdir(report);let app;try{app=await launch(fixture.profile,report);await app.wait(`document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending`);
await app.evaluate(`state.library.assets.forEach((a,i)=>{a.width=[35,56,75,350,350,132][i%6];a.height=100;});invalidateVirtualLayoutGeometry();`);
const results=[];
for(const mode of ['justified','grid'])for(const width of [620,1218])for(const zoom of [80,240,550]){
 await app.evaluate(`elements.grid.style.width='${width}px';state.layout='${mode}';setThumbnailZoom(${zoom},{persist:false,render:false});invalidateVirtualLayoutGeometry();relayoutVirtualGrid({index:0,offset:0});`);
 await app.evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
 const result=await app.evaluate(`(()=>{const cards=[...elements.grid.querySelectorAll('.asset-card')],bounds=elements.grid.getBoundingClientRect(),errors=[];for(const card of cards){const r=card.getBoundingClientRect(),p=state.virtualMetrics.items[Number(card.dataset.viewIndex)];if(Math.abs(r.width-p.width)>.1||r.right>bounds.right+.1)errors.push({id:card.dataset.assetId,width:r.width,expected:p.width,right:r.right,edge:bounds.right});}for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){const a=cards[i].getBoundingClientRect(),b=cards[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>.1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.1)errors.push({overlap:[i,j]});}return{count:cards.length,errors};})()`);
 assert.deepEqual(result.errors,[],JSON.stringify({mode,width,zoom,...result}));results.push({mode,width,zoom,count:result.count});
}
await fs.writeFile(path.join(report,'result.json'),JSON.stringify(results,null,2));console.log(report);
}finally{if(app)await app.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
