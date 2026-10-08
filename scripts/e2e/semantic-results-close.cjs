'use strict';
// Deterministic search IPC with the actual Electron renderer; no model downloads.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs');
process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-results-close-')),fixture=await createFixtures(root,{count:50,coldCount:0}),report=path.join(root,'report'),appRoot=path.join(root,'test-app'),sourceRoot=process.env.PIGEON_CLOSE_APP_ROOT||path.resolve(__dirname,'../..');
 await fs.mkdir(report);await fs.mkdir(path.join(appRoot,'electron'),{recursive:true});await fs.writeFile(path.join(appRoot,'package.json'),sourceRoot.endsWith('.asar')?require('@electron/asar').extractFile(sourceRoot,'package.json'):await fs.readFile(path.join(sourceRoot,'package.json')));
 await fs.writeFile(path.join(appRoot,'electron/main.js'),`
 const {ipcMain}=require('electron');const handle=ipcMain.handle.bind(ipcMain);let hold=false,pending=null;
 const response={results:[{id:${JSON.stringify(fixture.firstId)},score:.9,match:{label:'Fixture match',snippet:'Local test result'}}],totalMatches:1,indexed:50};
 ipcMain.handle=(channel,handler)=>{if(channel==='semantic:status')handler=()=>({portfolioId:'default',state:'idle',automatic:false,total:50,indexed:50,completed:50,resourcePercent:15,resources:{}});
 if(channel==='semantic:search')handler=()=>hold?new Promise(resolve=>{pending=resolve}):response;
 if(channel==='semantic:configure')handler=(_event,input)=>{hold=Boolean(input.holdSearch);if(input.releaseSearch&&pending){pending(response);pending=null;}return{state:'idle',portfolioId:'default'};};return handle(channel,handler);};
 require(${JSON.stringify(path.join(sourceRoot,'electron/main.js'))});`);
 process.env.PIGEON_E2E_APP_ROOT=appRoot;let app;
 try{
  app=await launch(fixture.profile,report);await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending");await app.click('#semantic-search-button');
  assert.equal(await app.evaluate("document.querySelector('[data-semantic-results-close]').hidden"),true);
  await app.evaluate(`state.selectedIds=new Set([${JSON.stringify(fixture.firstId)}]);selectAsset(${JSON.stringify(fixture.firstId)});elements.gridWrap.scrollTop=120;window.__savedFiles={view:state.view,selectedId:state.selectedId,scrollTop:elements.gridWrap.scrollTop};`);
  const search=async()=>{await app.fill('#semantic-query','fixture');await app.click('#semantic-run');await app.wait("state.view==='semantic'&&!document.querySelector('#semantic-run').disabled");};
  await search();assert.equal(await app.evaluate("document.querySelector('[data-semantic-results-close]').hidden"),false);await app.screenshot('semantic-tab-close');
  await app.click('[data-semantic-results-close]');await app.wait("state.view===window.__savedFiles.view");assert.equal(await app.evaluate('state.selectedId===window.__savedFiles.selectedId'),true);await app.wait('Math.abs(elements.gridWrap.scrollTop-window.__savedFiles.scrollTop)<2');
  assert.equal(await app.evaluate("document.querySelector('[data-thumbnail-tab=semantic]').hidden&&document.querySelector('#semantic-results-bar').classList.contains('hidden')"),true);assert.equal(await app.evaluate("window.pigeonSemanticSearch.assets().length"),0);assert.equal(await app.evaluate("document.querySelectorAll('.semantic-match-badge').length"),0);
  await search();await app.click('[data-thumbnail-tab=files]');await app.evaluate("document.querySelector('[data-semantic-results-close]').focus()");await app.key('Enter');await app.wait("document.querySelector('[data-thumbnail-tab=semantic]').hidden");assert.notEqual(await app.evaluate('state.view'),'semantic');
  await search();await app.evaluate('window.pigeon.semanticConfigure({holdSearch:true})');await app.click('#semantic-run');await app.wait("document.querySelector('#semantic-run').disabled");await app.click('[data-semantic-results-close]');await app.evaluate('window.pigeon.semanticConfigure({releaseSearch:true})');await app.wait("!document.querySelector('#semantic-run').disabled");assert.notEqual(await app.evaluate('state.view'),'semantic');assert.equal(await app.evaluate("document.querySelector('[data-thumbnail-tab=semantic]').hidden"),true);
  await search();assert.equal(await app.evaluate("document.querySelector('[data-semantic-results-close]').hidden"),false);assert.deepEqual(app.errors,[]);await app.screenshot('reopened-semantic-tab');
  console.log('Semantic results close checks passed:',report);
 }finally{await app?.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
