'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {describe}=require('../src/semantic-analysis-status');

test('Analyze now is acknowledged before its IPC request completes, without masking errors',()=>{
  const result=describe({state:'idle',total:12,completed:12,detail:'Up to date'},true);
  assert.equal(result.title,'Starting analysis…');assert.equal(result.busy,true);assert.equal(result.indeterminate,true);
  assert.match(result.detail,/request was received/i);
  assert.equal(describe({state:'error',error:'Install uv'},true).kind,'error');
});
test('engine preparation and model downloads show activity rather than a fabricated percentage',()=>{
  for(const detail of ['Checking local dependencies','Downloading the local embedding model.']){
    const result=describe({state:'setup',detail,total:80,completed:12});
    assert.equal(result.indeterminate,true);assert.equal(result.busy,true);assert.equal(result.detail,detail);
    assert.doesNotMatch(result.barLabel,/%/);assert.match(result.hint,/internet/);
  }
  assert.match(describe({state:'setup',detail:'Downloading the local embedding model.'}).title,/Downloading/);
});
test('a ready engine waiting to start is not mislabeled as a resource shortage',()=>{
  const result=describe({state:'waiting',detail:'Selected scope first',mode:'manual'});
  assert.equal(result.kind,'preparing');assert.equal(result.indeterminate,true);assert.match(result.title,/Preparing/);
});
test('analysis displays the current files, scope, queued work and completed-file progress',()=>{
  const result=describe({state:'indexing',total:100,completed:12,activeFiles:['video.mp4','photo.jpg'],currentScope:'References',analysisPhase:'subfolders',queuedScopes:['Drawings','Remaining'],limited:2});
  assert.equal(result.title,'Analyzing files');assert.equal(result.percent,12);assert.equal(result.indeterminate,false);
  assert.equal(result.current,'Current: video.mp4 · photo.jpg');assert.equal(result.scope,'Scope: References (subfolders)');
  assert.equal(result.queue,'Queued next: Drawings → Remaining');assert.match(result.countLabel,/12 \/ 100 files analyzed/);assert.match(result.countLabel,/2 with content limits/);
  assert.match(result.hint,/when a file finishes/);
});
test('manual work is never labeled as waiting for free RAM or inactivity',()=>{
  for(const status of [{state:'waiting',waitReason:'memory'},{state:'indexing',waitReason:'activity',resources:{memoryPressure:true,activityBlocked:true}}]){
    const result=describe({...status,mode:'manual',total:10,completed:3,current:'large.pdf'});
    assert.doesNotMatch(result.title,/waiting|idle|memory/i);assert.equal(result.current,'Current: large.pdf');
    assert.doesNotMatch(result.hint,/does not bypass memory safeguards/);
  }
});
test('activity waits and manual pauses have separate explanations and saved progress',()=>{
  assert.equal(describe({state:'waiting',waitReason:'activity'}).kind,'activity');
  assert.equal(describe({state:'indexing',resources:{activityBlocked:true}}).kind,'activity');
  assert.match(describe({state:'indexing',activityPaused:true}).hint,/Continue/);
  const paused=describe({state:'idle',paused:true,total:4,completed:4});
  assert.equal(paused.title,'Analysis paused');assert.match(paused.barLabel,/100% saved/);
});
test('completion is distinct from an idle portfolio that still has pending files or metadata',()=>{
  assert.equal(describe({state:'idle',total:4,completed:4}).title,'Analysis complete');
  assert.equal(describe({state:'idle',total:4,completed:0}).title,'Ready to analyze');
  assert.equal(describe({state:'idle',total:4,completed:4,changedItems:1}).title,'Changes waiting for analysis');
  const done=describe({state:'idle',total:4,completed:4,current:'old-file.jpg'});assert.equal(done.current,'');assert.equal(done.busy,false);
});
test('errors remain explicit and processing filenames remain plain text',()=>{
  const error='Automatic preparation needs uv';const result=describe({state:'error',error,detail:'Preparation failed',current:'<img src=x onerror=alert(1)>.png'});
  assert.equal(result.error,error);assert.equal(result.busy,false);assert.match(result.hint,/retry/);assert.equal(result.current,'Current: <img src=x onerror=alert(1)>.png');
});
test('unknown totals and invalid counters never produce misleading progress',()=>{
  const unknown=describe({state:'indexing',total:0,current:'file.txt'});assert.equal(unknown.indeterminate,true);assert.doesNotMatch(unknown.barLabel,/%/);
  assert.match(describe({state:'idle',total:0}).hint,/no eligible files/i);
  assert.equal(describe({state:'indexing',total:10,completed:99}).percent,100);
  assert.equal(describe({state:'indexing',total:10,completed:-1}).percent,0);
  assert.equal(describe({state:'indexing',total:'invalid',completed:Infinity}).percent,0);
});
test('the current file remains visible while a new scope waits for its segment to finish',()=>{
  const result=describe({state:'waiting',mode:'manual',current:'previous-scope.mp4',currentScope:'New scope',detail:'Current segments commit safely before switching.'});
  assert.equal(result.kind,'preparing');assert.equal(result.current,'Current: previous-scope.mp4');assert.equal(result.scope,'Scope: New scope');
});
test('the resource-policy explanation is a question-mark tooltip rather than an inline paragraph',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/semantic-search.js'),'utf8');
  assert.match(source,/<summary>Activities &amp; technical details <button[^>]+id="semantic-resource-help"/);
  assert.match(source,/aria-describedby="semantic-resource-help-description"/);
  assert.match(source,/title="Automatic analysis waits for the idle period[^\"]+">\?<\/button>/);
  assert.doesNotMatch(source,/<p>Automatic analysis waits for the idle period/);
});
test('activity rendering module is loaded before the panel and covered by packaged integrity checks',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
  assert(html.indexOf('src="semantic-analysis-status.js"')<html.indexOf('src="semantic-search.js"'));
  assert(require('../scripts/verify-packaged-app').criticalFiles.includes('src/semantic-analysis-status.js'));
});
