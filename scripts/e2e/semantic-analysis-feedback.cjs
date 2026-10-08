'use strict';
// Real Electron renderer/IPC, deterministic engine statuses: no model or runtime downloads.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs');
process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-semantic-feedback-'));
  const fixture=await createFixtures(root,{count:4,coldCount:0}),report=path.join(root,'report'),appRoot=path.join(root,'test-app');
  await fs.mkdir(report);await fs.mkdir(path.join(appRoot,'electron'),{recursive:true});
  const sourceRoot=path.resolve(__dirname,'../..');
  await fs.copyFile(path.join(sourceRoot,'package.json'),path.join(appRoot,'package.json'));
  await fs.writeFile(path.join(appRoot,'electron/main.js'),`
    const {ipcMain,BrowserWindow}=require('electron');
    let status={portfolioId:'default',state:'idle',total:4,completed:0,indexed:0,limited:0,automatic:false,pauseOnActivity:true,idleMinutes:10,resourcePercent:15,resources:{},detail:'Ready to analyze'},pending=null,startCalls=0;
    const emit=()=>{for(const window of BrowserWindow.getAllWindows())window.webContents.send('semantic:status',status)};
    const handle=ipcMain.handle.bind(ipcMain);
    ipcMain.handle=(channel,handler)=>{
      if(channel==='preferences:update'){const original=handler;handler=async(...args)=>{const prefs=await original(...args);status={...status,idleMinutes:prefs.semanticIdleMinutes};emit();return prefs;};}
      if(channel==='semantic:status')handler=()=>status;
      if(channel==='semantic:start')handler=(_event,input)=>{startCalls++;return new Promise((resolve,reject)=>{pending={resolve,reject,input}})};
      if(channel==='semantic:configure')handler=(_event,input)=>{
        if(input.fixtureStatus){status={...status,...input.fixtureStatus};emit()}
        if(input.releaseStart&&pending){const job=pending;pending=null;job.resolve({...status,portfolioId:job.input.portfolioId})}
        if(input.rejectStart&&pending){const job=pending;pending=null;job.reject(Error('Automatic preparation needs uv'))}
        return {...status,startCalls,startInput:pending?.input};
      };
      if(channel==='semantic:pause')handler=()=>{status={...status,state:'paused',paused:true,detail:'Completed work is saved.'};emit();return status};
      if(channel==='semantic:continue')handler=()=>{status={...status,state:'indexing',paused:false,activityPaused:false,pauseOnActivity:false,waitReason:null,resources:{},detail:'Resuming local analysis'};emit();return status};
      return handle(channel,handler);
    };
    require(${JSON.stringify(path.join(sourceRoot,'electron/main.js'))});
  `);
  const previousRoot=process.env.PIGEON_E2E_APP_ROOT;process.env.PIGEON_E2E_APP_ROOT=appRoot;
  let app;
  try{
    app=await launch(fixture.profile,report);
    await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending");
    await app.evaluate('openSettings()');await app.click('[data-preference-page="ai-search"]');
    assert.equal(await app.evaluate("document.querySelector('#semantic-idle-minutes').value"),'10');
    await app.evaluate("document.querySelector('#semantic-idle-minutes').value='7';document.querySelector('#save-preferences').click()");
    assert.equal(await app.evaluate("window.pigeon.getLibrary().then(l=>l.settings.preferences.semanticIdleMinutes)"),7);
    await app.click('#semantic-search-button');
    await app.wait("document.querySelector('#semantic-state').textContent.includes('Ready to analyze')");
    const configure=async input=>app.evaluate(`window.pigeon.semanticConfigure(${JSON.stringify(input)})`);
    const status=async patch=>{await configure({fixtureStatus:patch});};
    const visible=async selector=>app.evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});return !node.hidden&&getComputedStyle(node).display!=='none'&&!node.closest('details:not([open])')})()`);
    const start=async()=>app.evaluate("document.querySelector('[data-semantic=start]').click()");
    await start();
    await app.wait("document.querySelector('#semantic-state').textContent.includes('Starting analysis')");
    assert.equal(await app.evaluate("document.querySelector('[data-semantic=start]').disabled"),true);
    assert.equal(await app.evaluate("document.querySelector('#semantic-progress').hasAttribute('aria-valuenow')"),false);
    assert.equal(await visible('#semantic-detail'),true);
    await start();assert.equal((await configure({})).startCalls,1,'duplicate clicks cannot send a second request');
    // A poll returning idle while start is pending must not erase the acknowledgement.
    await status({state:'idle'});await app.wait("document.querySelector('#semantic-state').textContent.includes('Starting analysis')");
    await status({state:'setup',detail:'Downloading the local embedding model. Portfolio files are never uploaded.'});
    await app.wait("document.querySelector('#semantic-state').textContent.includes('Downloading')");
    assert.equal(await visible('#semantic-detail'),true);assert.match(await app.evaluate("document.querySelector('#semantic-analysis-hint').textContent"),/internet/);
    await app.screenshot('preparing-model');
    await status({state:'indexing',detail:'Analyzing local files',total:4,completed:1,indexed:1,current:'video.mp4',activeFiles:['video.mp4'],currentScope:'Reference videos',analysisPhase:'subfolders',queuedScopes:['Drawings']});
    await configure({releaseStart:true});await app.wait("!document.querySelector('[data-semantic=start]').disabled");
    assert.equal(await visible('#semantic-analysis-current'),true);assert.equal(await visible('#semantic-analysis-scope'),true);assert.equal(await visible('#semantic-analysis-queue'),true);
    assert.match(await app.evaluate("document.querySelector('#semantic-analysis-current').textContent"),/video\.mp4/);
    assert.equal(await app.evaluate("document.querySelector('#semantic-progress').getAttribute('aria-valuenow')"),'25');
    await app.screenshot('analyzing-file');
    await status({state:'indexing',mode:'manual',waitReason:'memory',resources:{memoryPressure:true},detail:'Starting immediately within your resource cap.'});
    await app.wait("document.querySelector('#semantic-state').textContent.includes('Analyzing files')");
    assert.doesNotMatch(await app.evaluate("document.querySelector('#semantic-state').textContent"),/waiting|memory/i);
    await app.screenshot('manual-immediate');
    await status({state:'indexing',mode:'automatic',idleMinutes:7,waitReason:'activity',resources:{activityBlocked:true},activityPaused:true,detail:'Waiting for seven minutes of inactivity.'});
    await app.wait("document.querySelector('[data-semantic=pause]').textContent.includes('Continue')");
    assert.match(await app.evaluate("document.querySelector('#semantic-state').textContent"),/computer to be idle/);
    await app.evaluate("document.querySelector('[data-semantic=pause]').click()");
    await app.wait("document.querySelector('#semantic-state').textContent.includes('Analyzing files')");
    assert.equal((await configure({})).resourcePercent,15,'Continue must preserve the resource ceiling');
    await app.evaluate("document.querySelector('[data-semantic=pause]').click()");
    await app.wait("document.querySelector('#semantic-state').textContent.includes('Analysis paused')");
    await status({state:'error',paused:false,error:'Automatic preparation needs uv',detail:'Preparation could not finish.'});
    await app.wait("document.querySelector('#semantic-analysis-error').textContent.includes('needs uv')");
    assert.equal(await visible('#semantic-analysis-error'),true);await app.screenshot('analysis-error');
    await status({state:'idle',error:'',detail:'Portfolio analysis complete.',completed:4,indexed:4,current:'',activeFiles:[],queuedScopes:[],currentScope:''});
    await app.wait("document.querySelector('#semantic-state').textContent.includes('Analysis complete')");
    assert.equal(await app.evaluate("document.querySelector('#semantic-progress').getAttribute('aria-valuenow')"),'100');
    assert.equal(await app.evaluate("document.querySelector('#semantic-analysis-error').hidden"),true);
    assert.equal(await app.evaluate("document.querySelector('#semantic-analysis-current').hidden"),true);
    // A failed start request must show its error in the analysis card, not just the search summary.
    await start();await configure({rejectStart:true});
    await app.wait("document.querySelector('#semantic-analysis-error').textContent.includes('needs uv')&&!document.querySelector('[data-semantic=start]').disabled");
    assert.equal(await visible('#semantic-analysis-error'),true);
    // Late status events and request responses from the previous portfolio are ignored.
    await start();await app.evaluate("state.library.activePortfolioId='second'");
    await status({portfolioId:'second',state:'idle',paused:false,total:2,completed:0,indexed:0,error:'',current:'',activeFiles:[],currentScope:'',queuedScopes:[],detail:'Second portfolio ready'});
    await app.wait("document.querySelector('#semantic-detail').textContent==='Second portfolio ready'");
    await configure({releaseStart:true});
    await status({portfolioId:'default',state:'error',error:'Old portfolio error',detail:'Old portfolio error'});
    assert.equal(await app.evaluate("document.querySelector('#semantic-detail').textContent"),'Second portfolio ready');
    await status({portfolioId:'second',state:'indexing',total:2,completed:0,error:'',current:'<img id="feedback-injection" src=x>.png',activeFiles:[],detail:'Working locally'});
    assert.equal(await app.evaluate("Boolean(document.querySelector('#feedback-injection'))"),false);
    assert.match(await app.evaluate("document.querySelector('#semantic-analysis-current').textContent"),/feedback-injection/);
    const help=await app.evaluate("(()=>{const button=document.querySelector('#semantic-resource-help'),details=button.closest('details');return {label:button.closest('summary').textContent,title:button.title,description:document.getElementById(button.getAttribute('aria-describedby')).textContent,open:details.open,paragraphs:details.querySelectorAll('p').length}})()");
    assert.match(help.label,/Activities & technical details/);assert.match(help.title,/Linux applies kernel CPU and memory caps/);assert.equal(help.description,help.title);assert.equal(help.paragraphs,0);assert.equal(help.open,false);
    await app.click('#semantic-resource-help');
    assert.equal(await app.evaluate("document.querySelector('#semantic-technical-details').open"),false,'help button must not toggle the disclosure');
    await app.evaluate("document.querySelector('#semantic-resource-help').focus()");
    assert.equal(await app.evaluate("document.activeElement.id"),'semantic-resource-help');
    assert.deepEqual(app.errors,[]);
    await fs.writeFile(path.join(report,'result.json'),JSON.stringify({immediateFeedback:true,duplicateStartGuard:true,visibleSetup:true,currentFileAndScope:true,queuedScopes:true,noManualMemoryWait:true,configurableIdlePreference:true,activityWait:true,pauseContinue:true,visibleErrors:true,completion:true,portfolioIsolation:true,plainTextFilenames:true},null,2));
    console.log('Semantic analysis feedback Electron checks passed:',report);
  }finally{
    await app?.close();
    if(previousRoot===undefined)delete process.env.PIGEON_E2E_APP_ROOT;else process.env.PIGEON_E2E_APP_ROOT=previousRoot;
  }
})().catch(error=>{console.error(error);process.exitCode=1});
