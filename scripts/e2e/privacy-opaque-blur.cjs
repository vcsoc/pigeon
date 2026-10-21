'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),sharp=require('sharp');
const {createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs');process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-opaque-blur-')),fixture=await createFixtures(root,{count:4,coldCount:0}),report=path.join(root,'report');await fs.mkdir(report);await fs.writeFile(path.join(fixture.profile,'library.db.semantic-settings.json'),JSON.stringify({automatic:false}));let app;const samples=[];
 try{
  app=await launch(fixture.profile,report);await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')");
  await app.evaluate(`document.body.dataset.thumbnailEffectMode='blur';document.body.classList.remove('privacy-effects-disabled','thumbnail-effect-reveal');const host=document.createElement('div');host.id='opaque-test';host.style.cssText='position:fixed;z-index:999999;left:400px;top:200px;width:180px;height:180px;background:rgb(255,0,255)';host.innerHTML='<article class="asset-card thumbnail-effect-applied" style="position:absolute;left:20px;top:20px;width:140px!important;height:140px;padding:0;border:0;border-radius:0;content-visibility:visible"><div class="asset-preview" style="width:140px;height:140px;border-radius:0;aspect-ratio:auto"><img class="thumbnail-loaded" style="width:140px;height:140px;object-fit:fill"></div></article>';document.body.append(host);host.querySelector('img').src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><rect width="140" height="140" fill="rgb(32,200,238)"/></svg>');`);
  await app.wait("document.querySelector('#opaque-test img').complete&&document.querySelector('#opaque-test img').naturalWidth>0");
  for(const background of ['transparent','dark','light','checkerboard'])for(const strength of [8,24,40,80]){
   await app.evaluate(`document.body.dataset.thumbnailBackground=${JSON.stringify(background)};document.documentElement.style.setProperty('--thumbnail-effect-strength',${JSON.stringify(String(strength))})`);
   await new Promise(resolve=>setTimeout(resolve,25));const shot=await app.send('Page.captureScreenshot',{format:'png',clip:{x:400,y:200,width:180,height:180,scale:1}}),png=Buffer.from(shot.data,'base64');
   const {data,info}=await sharp(png).resize(180,180).ensureAlpha().raw().toBuffer({resolveWithObject:true});const pixel=(x,y)=>[...data.subarray((y*info.width+x)*4,(y*info.width+x)*4+4)];
   const edges=[[21,90],[158,90],[90,21],[90,158]].map(([x,y])=>pixel(x,y));for(const edge of edges)assert(edge.every((value,index)=>Math.abs(value-[32,200,238,255][index])<=3),`${background}/${strength}: blur must preserve opaque edge colors, got ${edge}`);
   assert.deepEqual(pixel(5,90),[255,0,255,255]);samples.push({background,strength,edges});if(background==='transparent'&&strength===40)await fs.writeFile(path.join(report,'opaque-edges.png'),png);
  }
  await app.evaluate("document.body.classList.add('privacy-effects-disabled')");assert.equal(await app.evaluate("getComputedStyle(document.querySelector('#opaque-test img')).filter"),'none');assert.deepEqual(app.errors,[]);
  await fs.writeFile(path.join(report,'result.json'),JSON.stringify({samples,backgroundUnaffected:true,disableRestoresOriginal:true},null,2));console.log('Blur edges remain fully opaque without color fading in all backgrounds and strengths:',report);
 }finally{await app?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
