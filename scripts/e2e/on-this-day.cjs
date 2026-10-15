'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),sharp=require('sharp');
const {createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs'),{createLibraryStore}=require('../../electron/database');
const {dayKey}=require('../../src/on-this-day');
process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
  for(const count of [32,1200]){
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-on-this-day-')),fixture=await createFixtures(root,{count,coldCount:0}),report=path.join(root,'report');await fs.mkdir(report);
    const now=new Date(),tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,12),pastYear=now.getFullYear()-4;
    const pastDate=(date)=>`${pastYear}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const past=pastDate(now),other=pastDate(tomorrow),created=new Date(pastYear,now.getMonth(),now.getDate(),12).getTime();
    const store=createLibraryStore(path.join(fixture.profile,'library.db')),library=store.load(),a=library.assets;
    for(const asset of a)Object.assign(asset,{created:null,exif:null,stackId:null,deletedAt:null});
    a[0].exif={Photo:{DateTimeOriginal:past+'T23:30:00+14:00'}};a[0].created=Date.now();
    a[1].created=created;
    a[2].created=created;a[2].exif={Photo:{DateTimeOriginal:other+'T12:00:00Z'}};
    a[3].created=Date.now();
    a[4].created=null;
    a[5].created=created;a[5].deletedAt=1;
    a[6].created=new Date(pastYear,tomorrow.getMonth(),tomorrow.getDate(),12).getTime();
    a[7].created=Date.now();
    for(const asset of a.filter(asset=>asset.kind==='video'))asset.created=created;
    // A cached image whose capture date is not known until a real rebuild.
    const updated=await sharp(a[7].path).withExif({IFD2:{DateTimeOriginal:past.replaceAll('-',':')+' 12:00:00'}}).jpeg().toBuffer();
    const replacement=a[7].path+'.tmp';await fs.writeFile(replacement,updated);await fs.rename(replacement,a[7].path);const stat=await fs.stat(a[7].path);a[7].size=stat.size;a[7].modified=stat.mtimeMs;
    const expected=[a[0].id,a[1].id],rebuildId=a[7].id,trashId=a[5].id;store.save(library);store.close();
    await fs.writeFile(path.join(fixture.profile,'library.db.semantic-settings.json'),JSON.stringify({automatic:false}));
    let app;
    try{
      app=await launch(fixture.profile,report);await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending",12000);
      await app.wait("document.querySelector('#on-this-day-count').textContent==='2'",10000);
      await app.evaluate("state.kind='video';state.query='no-match';elements.search.value=state.query;state.filters.tags.add('no-match');state.showCheckedOnly=true");
      await app.click('[data-view="on-this-day"]');await app.wait('currentAssetViewSnapshot().ready');
      assert.deepEqual((await app.evaluate('currentViewIndices().map(index=>state.library.assets[index].id)')).sort(),[...expected].sort());
      assert.deepEqual((await app.evaluate('filteredAssets().map(asset=>asset.id)')).sort(),[...expected].sort());
      assert.equal(await app.evaluate(`assetById(${JSON.stringify(expected[0])}).exif===undefined`),true,'capture date must work without full EXIF in renderer');
      await app.wait("document.querySelectorAll('#asset-grid img.thumbnail-loaded').length===2",8000);
      await app.click('[data-view="on-this-day"]',{button:'right'});await app.click('[data-toggle-sidebar-item="on-this-day"]');
      assert(await app.evaluate("document.querySelector('[data-view=\"on-this-day\"]').classList.contains('preference-hidden')"));
      await app.click('[data-toggle-sidebar-item="on-this-day"]');await app.key('Escape','Escape');
      await app.evaluate(`window.pigeon.rebuildThumbnails([${JSON.stringify(rebuildId)}])`);
      await app.wait(`document.querySelector('#on-this-day-count').textContent==='3'&&currentAssetViewSnapshot().ready&&currentViewIndices().some(index=>state.library.assets[index].id===${JSON.stringify(rebuildId)})`,12000);
      await app.evaluate(`setAssetTrashWithoutGridRefresh([${JSON.stringify(trashId)}],false)`);
      await app.wait("document.querySelector('#on-this-day-count').textContent==='4'&&currentAssetViewSnapshot().ready&&currentViewIndices().length===4",10000);
      await app.evaluate(`globalThis.__realDateNow=Date.now;Date.now=()=>${tomorrow.getTime()};refreshOnThisDay()`);
      await app.wait("document.querySelector('#on-this-day-count').textContent==='2'&&currentAssetViewSnapshot().ready&&currentViewIndices().length===2",10000);
      await app.evaluate('Date.now=globalThis.__realDateNow;refreshOnThisDay()');
      await app.wait("document.querySelector('#on-this-day-count').textContent==='4'&&currentAssetViewSnapshot().ready&&currentViewIndices().length===4",10000);
      await app.screenshot('on-this-day-memories');assert.deepEqual(app.errors,[]);
      await app.close();app=await launch(fixture.profile,report);
      await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending",12000);
      await app.wait("state.view==='on-this-day'&&elements.title.textContent==='On this day'&&currentAssetViewSnapshot().ready&&currentViewIndices().length===4&&document.querySelector('#on-this-day-count').textContent==='4'",10000);
      // A different month/day with no matching memories has a friendly empty state.
      await app.evaluate(`Date.now=()=>${new Date(now.getFullYear(),now.getMonth(),now.getDate()+2,12).getTime()};refreshOnThisDay()`);
      await app.wait("currentAssetViewSnapshot().ready&&currentViewIndices().length===0&&!elements.empty.classList.contains('hidden')&&elements.emptyTitle.textContent==='No memories for today'",10000);
      assert.deepEqual(app.errors,[]);
      await fs.writeFile(path.join(report,'result.json'),JSON.stringify({fixtureAssets:library.assets.length,date:dayKey(now),imagesOnly:true,captureDatePrecedence:true,sourceCreationFallback:true,previousYearsOnly:true,trashExcluded:true,lightweightMetadata:true,realMetadataRebuild:true,liveCounts:true,hideShow:true,dayRollover:true,navigationPersistence:true,emptyState:true},null,2));
      console.log('On this day passed:',library.assets.length,report);
    }finally{await app?.close();}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
