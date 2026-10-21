'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),sharp=require('sharp');
const {createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs'),{createLibraryStore}=require('../../electron/database');
process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-privacy-alt-')),fixture=await createFixtures(root,{count:6,coldCount:0}),report=path.join(root,'report');await fs.mkdir(report);
 const store=createLibraryStore(path.join(fixture.profile,'library.db')),library=store.load();library.assets=library.assets.filter(a=>a.locationId==='cached-root');library.locations=library.locations.filter(l=>l.id==='cached-root');
 for(const asset of library.assets){const target=asset.path.replace(/\.jpg$/,'.gif');await sharp(asset.path).gif().toFile(target);const stat=await fs.stat(target);Object.assign(asset,{path:target,filename:path.basename(target),extension:'GIF',thumbnailEffect:true,size:stat.size,modified:stat.mtimeMs,contentHash:crypto.createHash('sha256').update(await fs.readFile(target)).digest('hex')});}
 library.settings.preferences={...library.settings.preferences,videoHoverPreview:true,hoverPreviewDelay:0};store.save(library);store.close();
 await fs.writeFile(path.join(fixture.profile,'library.db.semantic-settings.json'),JSON.stringify({automatic:false}));
 let app;const key=async down=>app.send('Input.dispatchKeyEvent',{type:down?'rawKeyDown':'keyUp',key:'Alt',code:'AltLeft',windowsVirtualKeyCode:18,nativeVirtualKeyCode:18,modifiers:down?1:0});
 const move=async selector=>app.send('Input.dispatchMouseEvent',{type:'mouseMoved',...await app.point(selector)});
 const staleEnters=()=>app.evaluate("for(const card of document.querySelectorAll('#asset-grid .asset-card')){if(!card._hoverMediaWired)attachHoverMediaPreview(card,assetById(card.dataset.assetId));const preview=card.querySelector('.asset-preview'),r=preview.getBoundingClientRect();preview.dispatchEvent(new PointerEvent('pointerenter',{clientX:r.left+r.width/2,clientY:r.top+r.height/2}));}");
 try{
  app=await launch(fixture.profile,report);await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending");
  await app.evaluate("state.includeSubfolderContent=true;state.kind='all';preferences.videoHoverPreview=true;preferences.hoverPreviewDelay=0;selectLocation('cached-root')");
  await app.wait("document.querySelectorAll('#asset-grid .asset-card.thumbnail-effect-applied img.thumbnail-loaded').length===6");
  const modes=[];
  for(const mode of ['blur','pixelate','spoiler','glitch','hidden']){
   await key(false);await move('#settings-button');
   await app.evaluate(`preferences.thumbnailEffectMode=${JSON.stringify(mode)};document.body.dataset.thumbnailEffectMode=${JSON.stringify(mode)};renderGrid()`);
   await app.wait("document.querySelectorAll('#asset-grid .asset-card.thumbnail-effect-applied').length===6");
   await staleEnters();assert.equal(await app.evaluate('activeProtectedHoverReveals.size'),6);await key(true);
   assert.equal(await app.evaluate("document.querySelectorAll('#asset-grid .thumbnail-hover-media').length"),0,mode+': stale thumbnails must not reveal with pointer over toolbar');
   assert.equal(await app.evaluate('activeProtectedHoverReveals.size'),0,mode+': stale reveal registrations must be removed');
   await key(false);await move('#asset-grid .asset-card:nth-child(2) .asset-preview');await key(true);
   await app.wait("document.querySelectorAll('#asset-grid .thumbnail-hover-media.hover-media-ready').length===1");
   assert.equal(await app.evaluate("Boolean(document.querySelector('#asset-grid .asset-card:nth-child(2) .thumbnail-hover-media.hover-media-ready'))"),true);
   assert.equal(await app.evaluate("document.querySelectorAll('#asset-grid .thumbnail-hover-media').length"),1);
   if(mode==='glitch'){assert.equal(await app.evaluate("getComputedStyle(document.querySelector('#asset-grid .asset-card:nth-child(2) .asset-preview'),'::after').display"),'none');assert.equal(await app.evaluate("getComputedStyle(document.querySelector('#asset-grid .asset-card:nth-child(2) img.thumbnail-loaded')).filter"),'none');}
   await key(false);await app.wait("document.querySelectorAll('#asset-grid .thumbnail-hover-media').length===0");
   await key(true);await app.wait("document.querySelectorAll('#asset-grid .thumbnail-hover-media.hover-media-ready').length===1");
   await move('#settings-button');await staleEnters();await key(true);
   assert.equal(await app.evaluate("document.querySelectorAll('#asset-grid .thumbnail-hover-media').length"),0,mode+': key repeat must not reveal old hovered cards');
   await key(false);modes.push(mode);
  }
  assert.deepEqual(app.errors,[]);await app.screenshot('alt-outside-private-thumbnails');
  await fs.writeFile(path.join(report,'result.json'),JSON.stringify({privateThumbnails:6,modes,unhoveredReveals:0,maximumHoveredReveals:1,staleRegistrationsRemoved:true,keyReleaseHides:true,keyRepeatOutsideHides:true},null,2));
  console.log('Alt privacy reveal targets only the current thumbnail in all five modes:',report);
 }finally{await app?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
