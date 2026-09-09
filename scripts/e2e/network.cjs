// Opt-in, read-only source verification. Only the isolated profile/cache is written.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createFixtures}=require('./fixtures.cjs'),{launch,sleep}=require('./driver.cjs'),{shouldIndexFile}=require('../../electron/file-types');
process.env.PIGEON_E2E_HEADLESS='1';
(async()=>{
 const source=process.env.PIGEON_NETWORK_ROOT;if(!source||!path.isAbsolute(source))throw Error('Set PIGEON_NETWORK_ROOT to the mounted SMB folder to verify');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'pigeon-e2e-network-')),out=path.join(root,'report');await fs.mkdir(out);console.log('REPORT',out);
 const report={status:'running',source,thumbnailCacheInitiallyEmpty:true,sourceOSCache:'uncontrolled; may be warm',samples:[],startedAt:new Date().toISOString()};let app;
 const save=()=>fs.writeFile(path.join(out,'network-results.json'),JSON.stringify(report,null,2));await save();
 try{
  const listingStarted=Date.now(),files=[];
  async function walk(folder){for(const e of await fs.readdir(folder,{withFileTypes:true})){const p=path.join(folder,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&shouldIndexFile(p))files.push(p);}}
  let timer;await Promise.race([walk(source),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Source enumeration exceeded 30s')),30000))]).finally(()=>clearTimeout(timer));
  assert.ok(files.length>0&&files.length<=2000,'Select a nonempty subtree with at most 2,000 indexable files');report.expected=files.length;report.enumerationMs=Date.now()-listingStarted;await save();
  const fixture=await createFixtures(root,{count:3000,coldCount:0,networkRoot:source});app=await launch(fixture.profile,out);
  await app.wait(`document.querySelector('#startup-splash').classList.contains('hidden')&&document.querySelectorAll('.asset-card img.thumbnail-loaded').length>=4`,15000);
  report.cachedStartupMs=Date.now()-app.started;assert.ok(report.cachedStartupMs<3000,'Cached local viewport waited too long with the SMB source configured');
  await app.click('[data-location-id="network-root"] .location-root-button');
  await app.click('[data-location-id="network-root"] .location-root-button',{button:'right'});await app.move('.context-action-group:nth-of-type(3)>button');
  await app.wait(`document.querySelector('[data-location-action="rescan"]').getBoundingClientRect().width>0`);
  await app.click('[data-location-action="rescan"]');const started=app.lastActionAt;
  await app.wait(`backgroundTasks.has('default:scan:network-root')`,2000);report.feedbackMs=Date.now()-started;assert.ok(report.feedbackMs<=250,`Feedback ${report.feedbackMs}ms`);
  const first=await app.wait(`(()=>{const card=[...document.querySelectorAll('.asset-card')].find(c=>c.querySelector('img.thumbnail-loaded')?.naturalWidth>0&&state.library.assets.find(a=>a.id===c.dataset.assetId)?.locationId==='network-root');if(!card)return false;const t=backgroundTasks.get('default:scan:network-root');return{id:card.dataset.assetId,magnifier:!!card.querySelector('.thumbnail-fit-preview'),indexing:{completed:t?.completed,total:t?.total,done:t?.done}};})()`,30000);
  report.firstVisibleMs=Date.now()-started;report.first=first.value;await save();assert.ok(report.firstVisibleMs<15000,'First visible network thumbnail exceeded 15s');assert.ok(first.value.indexing.completed<files.length&&!first.value.indexing.done,'No visible preview while indexing was incomplete');assert.ok(first.value.magnifier);
  const until=Date.now()+480000;let finished=false;
  while(Date.now()<until){const state=await app.evaluate(`(()=>{const a=state.library.assets.filter(a=>a.locationId==='network-root');return{indexed:a.length,previews:a.filter(a=>a.thumbnailPath).length,failed:a.filter(a=>a.thumbnailFailedAt).length,done:state.library.locations.find(l=>l.id==='network-root')?.scanProgress?.done};})()`);report.samples.push({ms:Date.now()-started,...state});await save();console.log(JSON.stringify(report.samples.at(-1)));assert.equal(state.failed,0,'Network previews failed');if(state.done&&state.indexed===files.length&&state.previews===files.length){finished=true;break;}await sleep(1000);}
  assert.ok(finished,'Network scan did not fully complete within eight minutes');report.completeMs=Date.now()-started;report.previewsPerSecond=files.length/(report.completeMs/1000);
  const {DatabaseSync}=require('node:sqlite');let assets=[];for(let i=0;i<100;i++){const db=new DatabaseSync(path.join(fixture.profile,'library.db'),{readOnly:true});try{assets=db.prepare('SELECT payload FROM assets').all().map(r=>JSON.parse(r.payload)).filter(a=>a.locationId==='network-root');}finally{db.close();}if(assets.length===files.length&&assets.every(a=>a.thumbnailPath))break;await sleep(50);}
  assert.equal(assets.length,files.length);const sharp=require('sharp');for(let i=0;i<assets.length;i+=8)await Promise.all(assets.slice(i,i+8).map(async a=>{assert.ok(a.thumbnailPath&&path.resolve(a.thumbnailPath).startsWith(fixture.profile+path.sep));await sharp(a.thumbnailPath,{limitInputPixels:16000000}).stats();}));
  assert.deepEqual(app.errors,[]);report.persistedAndDecoded=assets.length;report.status='passed';
 }catch(e){report.status='failed';report.error=e.stack;console.error(e);if(app)try{await app.screenshot('failure');}catch{}}
 finally{if(app)await app.close();report.finishedAt=new Date().toISOString();await save();console.log('RESULT',report.status,out);process.exitCode=report.status==='passed'?0:1;}
})().catch(e=>{console.error(e);process.exitCode=1;});
