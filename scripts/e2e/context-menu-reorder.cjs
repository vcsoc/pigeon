'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs');
process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-context-reorder-')),fixture=await createFixtures(root,{count:4,coldCount:0}),report=path.join(root,'report');await fs.mkdir(report);let app;
  try{
    app=await launch(fixture.profile,report);await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending");
    await app.click('#settings-button');await app.click('[data-preference-page="context-menus"]');
    const result=await app.evaluate(`(()=>{
      const editor=document.querySelector('.menu-studio-editor');
      const button=document.querySelector('[data-studio-up="collection"]');
      editor.scrollTop=button.offsetTop-100;
      const before=button.getBoundingClientRect().top,scrollBefore=editor.scrollTop,previous=button.closest('[data-studio-row]').previousElementSibling?.dataset.studioRow;
      button.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));
      const moved=document.querySelector('[data-studio-up="collection"]');
      return {before,after:moved.getBoundingClientRect().top,scrollBefore,scrollAfter:editor.scrollTop,previous,following:moved.closest('[data-studio-row]').nextElementSibling?.dataset.studioRow,style:getComputedStyle(moved).fontSize};
    })()`);
    assert.ok(result.previous,JSON.stringify(result));
    assert.equal(result.following,result.previous,JSON.stringify(result));
    assert.ok(result.scrollBefore>0,JSON.stringify(result));
    assert.ok(Math.abs(result.before-result.after)<1,JSON.stringify(result));
    assert.ok(result.scrollAfter<result.scrollBefore,JSON.stringify(result));
    assert.ok(parseFloat(result.style)>=18,JSON.stringify(result));
    console.log('Context Menu Studio pointer reorder and arrow visibility pass',JSON.stringify(result));
  }finally{if(app)await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
