'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createFixtures}=require('./fixtures.cjs'),{launch}=require('./driver.cjs');process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-semantic-runtime-')),fixture=await createFixtures(root,{count:8,coldCount:0}),report=path.join(root,'report'),python=path.join(fixture.profile,'python');await fs.mkdir(report);
 const monitorPython=path.resolve('.semantic-runtime/bin/python');
 await fs.writeFile(python,`#!/usr/bin/env python3
import os,sys,json
args=sys.argv[1:]
if any(a.endswith('semantic-resource-monitor.py') for a in args):os.execv(${JSON.stringify(monitorPython)},[${JSON.stringify(monitorPython)}]+args)
engine=next((a for a in args if a.endswith('semantic-engine.py')),None)
if not engine:sys.exit(0)
assert os.path.isfile(engine),engine
assets={};done=False
print(json.dumps({'ready':True}),flush=True)
for line in sys.stdin:
 r=json.loads(line);action=r['action']
 if action=='prune':assets=r['assets']
 info={'indexed':len(assets) if done else max(0,len(assets)-1),'limited':0,'vectors':len(assets)}
 if action=='plan':value={'pending':list(assets)[:1] if not done else []}
 elif action=='index_batch':
  done=True;info['indexed']=len(assets);value={'results':[{'id':j['asset']['id'],'done':True} for j in r['jobs']],'info':info}
 elif action=='search':value={'results':[{'id':i,'score':1,'match':{'label':'Protocol test'}} for i in list(r['assets'])[:1]],'indexed':len(assets)}
 else:value=info
 print(json.dumps({'id':r['id'],'result':value}),flush=True)
`,{mode:0o755});
 await fs.writeFile(path.join(fixture.profile,'semantic-runtime.json'),JSON.stringify({python}));await fs.writeFile(path.join(fixture.profile,'library.db.semantic-settings.json'),JSON.stringify({automatic:false}));let app;
 try{
  app=await launch(fixture.profile,report);await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending");
  const initial=await app.evaluate('window.pigeon.semanticStatus()');assert.equal(initial.total,10);
  await app.evaluate("window.pigeon.semanticStart({scope:{type:'folder',id:'cached-root'}})");await app.wait("window.pigeon.semanticStatus().then(s=>s.indexed===10&&s.state==='idle')",10000);
  const result=await app.evaluate("window.pigeon.semanticSearch({query:'protocol',all:true})");assert.equal(result.results.length,1);assert(result.results[0].id);assert.deepEqual(app.errors,[]);
  await fs.writeFile(path.join(report,'result.json'),JSON.stringify({assets:10,workerRuntimeLoaded:true,externalEngineProtocolPassed:true,unpackedPythonPathVerified:true,searchResultCount:result.results.length,modelInference:'stub external Python engine; no model download'},null,2));console.log('Semantic worker, external-engine protocol, search and shutdown passed:',report);
 }finally{await app?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
