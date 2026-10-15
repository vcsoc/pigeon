'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs'),{createLibraryStore}=require('../../electron/database');
process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-folder-collapse-')),fixture=await createFixtures(root,{count:4,coldCount:0}),report=path.join(root,'report');await fs.mkdir(report);
  await fs.mkdir(path.join(fixture.cached,'parent','child','grandchild'),{recursive:true});
  await Promise.all(Array.from({length:350},(_,i)=>fs.mkdir(path.join(fixture.cached,'branch-'+i))));
  const store=createLibraryStore(path.join(fixture.profile,'library.db')),library=store.load();for(const group of ['collections','smartFolders'])library[group]=[{id:group+'-root',name:group+' root'},{id:group+'-child',name:group+' child',parentId:group+'-root'},{id:group+'-grand',name:group+' grand',parentId:group+'-child'},{id:group+'-leaf',name:group+' leaf',parentId:group+'-grand'}];store.save(library);store.close();
  let app;
  const doubleClick=async selector=>{const point=await app.point(selector);await app.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});for(const clickCount of [1,2]){await app.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount});await app.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount});}};
  const visible=async selector=>app.evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)})?.offsetParent)`);
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
    await doubleClick(row('parent'));
    assert.equal(await app.evaluate(`Boolean(document.querySelector(${JSON.stringify(row('parent/child'))}))`),false);
    await expand('parent');assert.equal(await app.evaluate(`document.querySelector(${JSON.stringify(row('parent/child')+' [data-collapse-key]')}).getAttribute('aria-expanded')`),'false');
    await doubleClick(rootRow);
    await app.click(toggle);
    assert.equal(await app.evaluate(`document.querySelector(${JSON.stringify(row('parent')+' [data-collapse-key]')}).getAttribute('aria-expanded')`),'false');
    assert.equal(await app.evaluate("folderTreeCache.get('cached-root').folders.length>=353"),true);
    await doubleClick(row('parent'));assert.equal(await visible(row('parent/child')),true);assert.equal(await visible(row('parent/child/grandchild')),false);await doubleClick(row('parent'));assert.equal(await visible(row('parent/child')),false);
    await doubleClick(rootRow);await doubleClick(rootRow);assert.equal(await visible(row('parent')),true);assert.equal(await visible(row('parent/child')),false);
    for(const [group,attribute,prefix]of [['collections','collection','collection'],['smartFolders','smart-folder','smart-folder']]){
      const selector=level=>`[data-${attribute}-id="${group}-${level}"]`;
      await app.evaluate(`setFolderCollapseStates(${JSON.stringify(['root','child','grand'].map(level=>prefix+':'+group+'-'+level))},false);setFolderCollapsed(${JSON.stringify(prefix+':'+group+'-root')},true);renderSidebar(false)`);
      assert.equal(await visible(selector('child')),false);await doubleClick(selector('root'));assert.equal(await visible(selector('child')),true);assert.equal(await visible(selector('grand')),false);assert.equal(await visible(selector('leaf')),false);
      await doubleClick(selector('child'));assert.equal(await visible(selector('grand')),true);assert.equal(await visible(selector('leaf')),false);
      await doubleClick(selector('root'));assert.equal(await visible(selector('child')),false);await doubleClick(selector('root'));assert.equal(await visible(selector('child')),true);assert.equal(await visible(selector('grand')),false);
    }
    assert.deepEqual(app.errors,[]);await app.screenshot('one-level-double-click');console.log('One-level folder, collection and smart-folder double-click checks passed:',report);
  }finally{await app?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
