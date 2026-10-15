'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs');
process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-about-menu-')),fixture=await createFixtures(root,{count:12,coldCount:0}),report=path.join(root,'report');await fs.mkdir(report);
  let app;
  try{
    app=await launch(fixture.profile,report);
    await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending",12000);
    await app.click('#app-menu-button');
    assert.equal(await app.evaluate("document.querySelector('#app-menu > [data-menu-action=\"about\"]').previousElementSibling.dataset.menuGroup"),'help');
    await app.click('#app-menu [data-menu-group="help"]');
    assert.equal(await app.evaluate("document.querySelectorAll('#app-submenu [data-menu-action=\"about\"]').length"),0);
    assert.equal(await app.evaluate("document.querySelectorAll('#app-submenu [data-menu-action]').length"),3);
    await app.screenshot('about-below-help');
    await app.click('#app-menu > [data-menu-action="about"]');
    await app.wait("!document.querySelector('#about-dialog').classList.contains('hidden')&&document.querySelector('#app-menu').classList.contains('hidden')&&document.querySelector('#app-submenu').classList.contains('hidden')");
    await app.key('Escape','Escape');
    await app.wait("document.querySelector('#about-dialog').classList.contains('hidden')");
    assert.deepEqual(app.errors,[]);
    await fs.writeFile(path.join(report,'result.json'),JSON.stringify({directlyBelowHelp:true,removedFromHelpSubmenu:true,existingAboutOpens:true,menusClose:true,escapeDismisses:true},null,2));
    console.log('Direct About Pigeon menu passed:',report);
  }finally{await app?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
