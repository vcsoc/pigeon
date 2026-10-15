'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createFixtures } = require('./fixtures.cjs');
const { launch } = require('./driver.cjs');
const { createLibraryStore } = require('../../electron/database');
process.env.PIGEON_E2E_HEADLESS = '1';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const sourceRoot = process.env.PIGEON_E2E_SOURCE_ROOT || path.resolve(__dirname, '../..');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pigeon-navigation-unlock-'));
  const fixture = await createFixtures(root, { count: 24, coldCount: 0 });
  const report = path.join(root, 'report'), appRoot = path.join(root, 'test-app'), trace = path.join(root, 'workers.jsonl');
  await fs.mkdir(report);
  await fs.mkdir(path.join(appRoot, 'electron'), { recursive: true });
  await fs.mkdir(path.join(fixture.cached, 'known-empty'));
  await fs.writeFile(trace, '');
  const store = createLibraryStore(path.join(fixture.profile, 'library.db'));
  const library = store.load(), collectionId = library.collections[0].id;
  library.assets = library.assets.filter(asset => asset.locationId === 'cached-root');
  library.locations = library.locations.filter(location => location.id === 'cached-root');
  store.save(library);
  store.close();
  await fs.writeFile(path.join(fixture.profile, 'library.db.semantic-settings.json'), JSON.stringify({ automatic: false }));
  await fs.copyFile(path.join(sourceRoot, 'package.json'), path.join(appRoot, 'package.json'));
  await fs.writeFile(path.join(appRoot, 'electron/main.js'), `
const fs=require('node:fs'),path=require('node:path'),threads=require('node:worker_threads'),Worker=threads.Worker;
threads.Worker=class extends Worker{constructor(filename,options){fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify({filename:path.basename(String(filename)),metadataOnly:options?.workerData?.metadataOnly===true})+'\\n');super(filename,options);}};
require(${JSON.stringify(path.join(sourceRoot, 'electron/main.js'))});
`);
  const previousRoot = process.env.PIGEON_E2E_APP_ROOT;
  process.env.PIGEON_E2E_APP_ROOT = appRoot;
  let app;
  const workerEvents = async () => (await fs.readFile(trace, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const settle = async () => {
    await app.wait("!state.library.assetStreamPending&&folderTreeCache.get('cached-root')?.folders.some(folder=>folder.path==='known-empty')");
    await sleep(400);
  };
  const unlockInline = async () => {
    await app.wait("!document.querySelector('#locked-content').classList.contains('hidden')");
    await app.evaluate("document.querySelector('#inline-unlock-password').value='fixture-secret';document.querySelector('#inline-unlock-form').requestSubmit()");
    await app.wait("state.library.assets.length===24&&document.querySelector('#locked-content').classList.contains('hidden')");
    await sleep(180);
  };
  try {
    app = await launch(fixture.profile, report);
    await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending");
    await settle();
    await app.evaluate("window.pigeon.setFolderPassword('cached-root','section-0','fixture-secret')");
    await app.wait('state.library.assets.length===22&&!state.library.assetStreamPending');
    await settle();
    await fs.writeFile(trace, '');
    for (let n = 0; n < 4; n++) {
      await app.evaluate("state.includeSubfolderContent=true;selectLocation('cached-root','section-1')");
      await app.evaluate("selectLocation('cached-root')");
    }
    await app.evaluate("selectLocation('cached-root','section-0')");
    await unlockInline();
    await app.wait("document.querySelectorAll('#asset-grid .asset-card img.thumbnail-loaded').length===2");
    for (let n = 0; n < 2; n++) {
      await app.evaluate("(async()=>{applyLockVisibilityResult(await window.pigeon.lockFolderNow('cached-root','section-0'),false);await selectLocation('cached-root','section-0');})()");
      await unlockInline();
    }
    const folderEvents = await workerEvents();
    const disallowed = events => events.filter(event => event.filename === 'scan-worker.js' || event.filename === 'folder-tree-worker.js' && !event.metadataOnly);
    assert.deepEqual(disallowed(folderEvents), [], 'folder selection/unlock must not scan sources or recursively discover the tree');
    assert(folderEvents.some(event => event.filename === 'folder-tree-worker.js' && event.metadataOnly));
    assert.equal(await app.evaluate("folderTreeCache.get('cached-root').folders.some(folder=>folder.path==='known-empty')"), true);

    await app.evaluate(`window.pigeon.setCollectionPassword(${JSON.stringify(collectionId)},'fixture-secret',false)`);
    await app.wait('state.library.assets.length===4&&!state.library.assetStreamPending');
    await settle();
    await fs.writeFile(trace, '');
    await app.evaluate(`selectCollection(${JSON.stringify(collectionId)})`);
    await unlockInline();
    await app.wait("document.querySelectorAll('#asset-grid .asset-card img.thumbnail-loaded').length===20");
    const collectionEvents = await workerEvents();
    assert.deepEqual(disallowed(collectionEvents), [], 'collection unlock must not recursively rediscover sources');
    assert.deepEqual(app.errors, []);
    await app.screenshot('cached-collection-after-unlock');
    const result = { selections: 8, folderUnlocks: 3, collectionUnlocks: 1, sourceScansAfterSelectionOrUnlock: 0, physicalTreeWalksAfterSelectionOrUnlock: 0, cachedEmptyFolderPreserved: true, cachedFolderThumbnails: 2, cachedCollectionThumbnails: 20, folderEvents, collectionEvents };
    await fs.writeFile(path.join(report, 'result.json'), JSON.stringify(result, null, 2));
    console.log('Navigation and password unlock reuse cached assets without source scans or directory walks:', report);
  } finally {
    await app?.close();
    if (previousRoot === undefined) delete process.env.PIGEON_E2E_APP_ROOT;
    else process.env.PIGEON_E2E_APP_ROOT = previousRoot;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
