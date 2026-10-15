'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createFixtures } = require('./fixtures.cjs');
const { launch } = require('./driver.cjs');
const { createLibraryStore } = require('../../electron/database');
process.env.PIGEON_E2E_HEADLESS = '1';

(async () => {
  const results = [];
  for (const count of [32, 1200]) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pigeon-primary-counts-'));
    const fixture = await createFixtures(root, { count, coldCount: 0 });
    const report = path.join(root, 'report');
    await fs.mkdir(report);
    const store = createLibraryStore(path.join(fixture.profile, 'library.db'));
    const library = store.load();
    library.collections = [{ id: 'assigned', name: 'Assigned' }];
    library.smartFolders = [{ id: 'assigned-smart', name: 'Assigned smart', filters: { tags: ['assigned'] } }];
    // Reproduce a persisted placeholder, not just an unsaved dialog row.
    library.settings.builtinSmartFolders = { all: { filters: { ruleMatch: 'any', rules: [{ field: 'tags', operator: 'contains', value: '', values: [] }] } } };
    for (const asset of library.assets) Object.assign(asset, { tags: ['general'], collectionIds: [], favorite: false, deletedAt: null, stackId: null });
    Object.assign(library.assets[0], { tags: [], favorite: true });
    Object.assign(library.assets[1], { tags: ['assigned'], collectionIds: ['assigned'] });
    library.assets[2].deletedAt = 1;
    const firstId = library.assets[0].id;
    const total = library.assets.length;
    store.save(library);
    store.close();
    await fs.writeFile(path.join(fixture.profile, 'library.db.semantic-settings.json'), JSON.stringify({ automatic: false }));
    let app;
    try {
      app = await launch(fixture.profile, report);
      await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending", 12000);
      const expected = { all: total - 1, uncategorized: total - 2, untagged: 1, favorites: 1, tags: 2, trash: 1 };
      for (const [view, value] of Object.entries(expected)) {
        await app.wait(`document.querySelector('#${view}-count').textContent===${JSON.stringify(String(value))}`, 10000);
      }
      // Counts stay portfolio-wide while browsing an indexed folder.
      await app.evaluate("state.includeSubfolderContent=true;selectLocation('cached-root')");
      await app.wait('currentAssetViewSnapshot().ready');
      assert.equal(Number(await app.evaluate("document.querySelector('#all-count').textContent")), expected.all);
      await app.evaluate("state.filters.tags.add('no-match');state.query='no-match';elements.search.value=state.query;state.showCheckedOnly=true");
      await app.click('[data-view="all"]');
      await app.wait('currentAssetViewSnapshot().ready');
      await app.wait("document.querySelectorAll('#asset-grid img.thumbnail-loaded').length>0", 8000);
      for (const view of ['all', 'uncategorized', 'untagged', 'favorites', 'trash']) {
        await app.click(`[data-view="${view}"]`);
        await app.wait('currentAssetViewSnapshot().ready');
        assert.equal(await app.evaluate('currentViewIndices().length'), expected[view], `${count}: ${view} count agrees with results`);
        assert(await app.evaluate("document.querySelectorAll('#asset-grid .asset-card').length>0"));
      }
      // Updates arriving while another view is selected must refresh the counters.
      await app.evaluate("selectLocation('cached-root')");
      await app.evaluate(`window.pigeon.updateAsset(${JSON.stringify(firstId)},{favorite:false,tags:['general']})`);
      await app.wait("document.querySelector('#favorites-count').textContent==='0'&&document.querySelector('#untagged-count').textContent==='0'", 10000);
      await app.evaluate(`window.pigeon.updateAsset(${JSON.stringify(firstId)},{favorite:true,tags:[]})`);
      await app.wait("document.querySelector('#favorites-count').textContent==='1'&&document.querySelector('#untagged-count').textContent==='1'", 10000);
      await app.click('[data-view="all"]');
      await app.wait('currentAssetViewSnapshot().ready');
      await app.wait("document.querySelectorAll('#asset-grid img.thumbnail-loaded').length>0", 8000);
      assert.deepEqual(app.errors, []);
      await app.screenshot('all-with-correct-count');
      await app.close();
      app = await launch(fixture.profile, report);
      await app.wait("document.querySelector('#startup-splash').classList.contains('hidden')&&!state.library.assetStreamPending", 12000);
      await app.click('[data-view="all"]');
      await app.wait(`currentAssetViewSnapshot().ready&&currentViewIndices().length===${expected.all}`, 10000);
      await app.wait(`document.querySelector('#all-count').textContent==='${expected.all}'&&document.querySelectorAll('#asset-grid img.thumbnail-loaded').length>0`, 10000);
      assert.deepEqual(app.errors, []);
      const result = { fixtureAssets: total, expected, ordinaryAndCooperative: true, loadedThumbnails: true, staleFiltersCleared: true, liveCounters: true, restartPersistence: true };
      await fs.writeFile(path.join(report, 'result.json'), JSON.stringify(result, null, 2));
      results.push(result);
      console.log('Primary sidebar counts and All thumbnails passed:', total, report);
    } finally {
      await app?.close();
    }
  }
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
