'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs');
process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-folder-collapse-')),fixture=await createFixtures(root,{count:4,coldCount:0}),report=path.join(root,'report');await fs.mkdir(report);
  await fs.mkdir(path.join(fixture.cached,'parent','child','grandchild'),{recursive:true});
  await Promise.all(Array.from({length:350},(_,i)=>fs.mkdir(path.join(fixture.cached,'branch-'+i))));
  let app;
  try{
    app=await launch(fixture.profile,report);
    await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending");
    await app.wait("folderTreeCache.get('cached-root')?.folders.some(folder=>folder.path==='parent/child/grandchild')");
    const rootRow='.location-item[data-location-id="cached-root"] .location-root-button',toggle=rootRow+' [data-collapse-key]';
    assert.equal(await app.evaluate(`document.querySelector(${JSON.stringify(toggle)}).getAttribute('aria-expanded')`),'false');
    await app.click(toggle);
    await app.wait("document.querySelectorAll('.location-item[data-location-id=\"cached-root\"] .location-folder-item').length>=351");
    assert.equal(await app.evaluate("Boolean(document.querySelector('[data-load-location-tree]'))"),false);
    const row=p=>`.location-folder-item[data-location-id="cached-root"][data-subfolder="${encodeURIComponent(p)}"]`,expand=async p=>app.click(row(p)+' [data-collapse-key]');
    assert.equal(await app.evaluate(`Boolean(document.querySelector(${JSON.stringify(row('parent/child'))}))`),false);
    await expand('parent');await expand('parent/child');
    assert.equal(await app.evaluate(`Boolean(document.querySelector(${JSON.stringify(row('parent/child/grandchild'))}))`),true);
    await app.evaluate(`document.querySelector(${JSON.stringify(row('parent'))}).dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`);
    assert.equal(await app.evaluate(`Boolean(document.querySelector(${JSON.stringify(row('parent/child'))}))`),false);
    await expand('parent');assert.equal(await app.evaluate(`document.querySelector(${JSON.stringify(row('parent/child')+' [data-collapse-key]')}).getAttribute('aria-expanded')`),'false');
    await app.evaluate(`document.querySelector(${JSON.stringify(rootRow)}).dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`);
    await app.click(toggle);
    assert.equal(await app.evaluate(`document.querySelector(${JSON.stringify(row('parent')+' [data-collapse-key]')}).getAttribute('aria-expanded')`),'false');
    assert.equal(await app.evaluate("folderTreeCache.get('cached-root').folders.length>=353"),true);
    assert.deepEqual(app.errors,[]);console.log('Folder collapse Electron checks passed:',report);
  }finally{await app?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
