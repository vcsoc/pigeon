'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs');process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-search-')),fixture=await createFixtures(root,{count:1100,coldCount:0}),report=path.join(root,'report');await fs.mkdir(report);let app;
  try{
    app=await launch(fixture.profile,report);await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending",20000);
    await app.evaluate("selectView('all','All')");await app.wait('cooperativeAssetView?.ready',15000);
    const initial=await app.evaluate(`(()=>{const input=document.querySelector('#search-input'),box=input.closest('.search-box'),bar=document.querySelector('.toolbar'),semantic=document.querySelector('#semantic-search-button');return {width:box.getBoundingClientRect().width,center:box.getBoundingClientRect().left+box.getBoundingClientRect().width/2,barCenter:bar.getBoundingClientRect().left+bar.getBoundingClientRect().width/2,sameGroup:semantic.parentElement===box.parentElement,groupCenter:box.parentElement.getBoundingClientRect().left+box.parentElement.getBoundingClientRect().width/2,rightStart:document.querySelector('.toolbar-right').getBoundingClientRect().left,groupRight:box.parentElement.getBoundingClientRect().right,windowWidth:innerWidth};})()`);
    await app.evaluate("document.querySelector('#search-input').focus()");await app.wait("document.querySelector('.search-box').getBoundingClientRect().width>200");
    await app.evaluate('elements.gridWrap.scrollTop=elements.gridWrap.scrollHeight');await app.fill('#search-input','reference-00123');
    await app.wait("cooperativeAssetView?.ready&&cooperativeAssetView.criteria.query==='reference-00123'",15000);
    const result=await app.evaluate(`(()=>{const box=document.querySelector('.search-box');return {query:state.query,total:cooperativeAssetView.total,names:cooperativeAssetView.indices.map(i=>state.library.assets[i].filename),scrollTop:elements.gridWrap.scrollTop,width:box.getBoundingClientRect().width};})()`);
    assert.ok(result.total>0,JSON.stringify(result));assert.ok(result.names.every(n=>n.toLowerCase().includes('reference-00123')),JSON.stringify(result));assert.equal(result.scrollTop,0);assert.ok(result.width>initial.width);assert.equal(initial.sameGroup,true);if(initial.windowWidth>=1800)assert.ok(Math.abs(initial.groupCenter-initial.barCenter)<2,JSON.stringify(initial));assert.ok(initial.groupRight<=initial.rightStart,JSON.stringify(initial));
    await app.evaluate("document.querySelector('#search-input').blur()");assert.ok(await app.evaluate("document.querySelector('.search-box').getBoundingClientRect().width>200"));
    await app.fill('#search-input','does-not-match-any-reference');await app.wait("cooperativeAssetView?.ready&&cooperativeAssetView.criteria.query==='does-not-match-any-reference'",15000);assert.equal(await app.evaluate('cooperativeAssetView.total'),0);
    await app.fill('#search-input','');await app.wait("cooperativeAssetView?.ready&&cooperativeAssetView.criteria.query===''",15000);assert.ok(await app.evaluate('cooperativeAssetView.total')>0);
    await app.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    await app.evaluate("document.querySelector('#search-input').focus()");await app.wait("innerWidth===1920&&document.querySelector('.search-box').getBoundingClientRect().width>250");
    const wide=await app.evaluate(`(()=>{const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};};return {toolbar:rect('.toolbar'),left:rect('.semantic-view-tabs'),search:rect('.toolbar-center'),right:rect('.toolbar-zoom-group'),close:rect('#window-close')};})()`);
    assert.ok(Math.abs((wide.search.left+wide.search.right-wide.toolbar.left-wide.toolbar.right)/2)<5,JSON.stringify(wide));
    assert.ok(wide.left.right<=wide.search.left&&wide.search.right<=wide.right.left,JSON.stringify(wide));
    assert.ok(Math.abs(wide.close.right-wide.toolbar.right)<3,JSON.stringify(wide));
    console.log('Topbar search/filter/scroll/expansion pass',JSON.stringify({initial,result,wide}));
  }finally{if(app)await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
