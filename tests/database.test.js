const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLibraryStore, importLegacyJson } = require('../electron/database');
const core = require('../electron/library-core');

function temporary(name) { return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pigeon-db-')), name); }

test('SQLite store round-trips and incrementally deletes library records', () => {
  const file = temporary('library.db'), store = createLibraryStore(file);
  const library = core.migrateLibrary({ settings: { autoTag: false }, locations: [{ id: 'l1', path: '/images', name: 'Images' }], assets: [{ id: 'a1', locationId: 'l1', path: '/images/a.jpg', kind: 'image', tags: ['one'] }], collections: [{ id: 'c1', name: 'Collection' }], smartFolders: [{ id: 's1', name: 'Smart', filters: { tags: ['one'] } }] });
  store.save(library); let loaded = store.load();
  assert.equal(loaded.assets[0].path, '/images/a.jpg'); assert.deepEqual(loaded.assets[0].tags, ['one']); assert.equal(loaded.smartFolders.length, 1);
  library.assets = []; library.collections = []; store.save(library); loaded = store.load();
  assert.equal(loaded.assets.length, 0); assert.equal(loaded.collections.length, 0); store.close();
});

test('legacy library.json imports once and is archived', () => {
  const databaseFile = temporary('library.db'), legacyFile = path.join(path.dirname(databaseFile), 'library.json');
  fs.writeFileSync(legacyFile, core.serializeLibrary(core.migrateLibrary({ assets: [{ id: 'legacy', path: 'legacy.jpg' }] })));
  const store = createLibraryStore(databaseFile), imported = importLegacyJson(store, legacyFile);
  assert.equal(imported.assets[0].id, 'legacy'); assert.equal(store.load().assets[0].id, 'legacy'); assert.equal(fs.existsSync(`${legacyFile}.migrated`), true); store.close();
});
