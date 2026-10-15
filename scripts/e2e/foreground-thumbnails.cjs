'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs'),{createLibraryStore}=require('../../electron/database');
process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-foreground-thumbnails-')),fixture=await createFixtures(root,{count:24,coldCount:8}),report=path.join(root,'report'),appRoot=path.join(root,'test-app');await fs.mkdir(report);await fs.mkdir(path.join(appRoot,'electron'),{recursive:true});
 const store=createLibraryStore(path.join(fixture.profile,'library.db')),library=store.load();for(const asset of library.assets)if(asset.locationId==='cached-root'){asset.thumbnailPath=null;asset.width=null;asset.height=null;}store.save(library);store.close();
 await fs.writeFile(path.join(fixture.profile,'library.db.semantic-settings.json'),JSON.stringify({automatic:false}));
 await fs.copyFile(path.resolve('package.json'),path.join(appRoot,'package.json'));
 await fs.writeFile(path.join(appRoot,'electron/main.js'),`const {app}=require('electron');app.getAppMetrics=()=>[{pid:process.pid,type:'Browser',cpu:{percentCPUUsage:95},memory:{workingSetSize:0}}];require(${JSON.stringify(path.resolve('electron/main.js'))});`);
 const previousRoot=process.env.PIGEON_E2E_APP_ROOT;process.env.PIGEON_E2E_APP_ROOT=appRoot;let app;
 try{
  app=await launch(fixture.profile,report);await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending",10000);
  const started=Date.now();await app.evaluate("state.includeSubfolderContent=true;selectLocation('cached-root')");
  await app.wait("[...document.querySelectorAll('#asset-grid .asset-card')].filter(card=>card.querySelector('img.thumbnail-loaded')).length>=12",6000);
  const elapsed=Date.now()-started;assert(elapsed<6000,'visible thumbnails must not wait for the 8% CPU gate');
  await app.evaluate("selectLocation('cold-root');void window.pigeon.rescan('cold-root')");
  await app.wait("state.library.assets.filter(asset=>asset.locationId==='cold-root').length===8",8000);
  await app.wait("[...document.querySelectorAll('#asset-grid .asset-card')].filter(card=>card.querySelector('img.thumbnail-loaded')).length===8",8000);
  assert.deepEqual(app.errors,[]);await app.screenshot('foreground-at-95-percent-cpu');
  await fs.writeFile(path.join(report,'result.json'),JSON.stringify({simulatedAppCpuPercent:95,visibleThumbnailCount:12,visibleThumbnailElapsedMs:elapsed,manualRescanAssets:8,manualRescanThumbnails:8},null,2));console.log('Foreground thumbnails and manual rescan pass at 95% aggregate CPU:',elapsed+'ms',report);
 }finally{await app?.close();if(previousRoot===undefined)delete process.env.PIGEON_E2E_APP_ROOT;else process.env.PIGEON_E2E_APP_ROOT=previousRoot;}
})().catch(error=>{console.error(error);process.exitCode=1;});
