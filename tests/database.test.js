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

test('incremental scan batches persist without cloning a full library', () => { const file=temporary('batch.db'),store=createLibraryStore(file); store.save(core.migrateLibrary({locations:[{id:'l',path:'/root'}]})); store.saveBatch({location:{id:'l',path:'/root',scanCheckpoint:{nextIndex:2,discovered:4}},assets:[{id:'a',locationId:'l',path:'/root/a.jpg'},{id:'b',locationId:'l',path:'/root/b.jpg'}]}); const loaded=store.load(); assert.equal(loaded.assets.length,2); assert.equal(loaded.locations[0].scanCheckpoint.nextIndex,2); store.close(); });

test('separate portfolio databases can receive transferred records', () => {
  const firstFile = temporary('first.db'), secondFile = path.join(path.dirname(firstFile), 'second.db'), first = createLibraryStore(firstFile), second = createLibraryStore(secondFile);
  first.save(core.migrateLibrary({ assets: [{ id: 'shared', path: '/shared.jpg', collectionIds: ['c'] }], collections: [{ id: 'c', name: 'Shared' }] }));
  const source = first.load(), destination = second.load() || core.migrateLibrary({}); destination.assets.push(source.assets[0]); destination.collections.push(source.collections[0]); second.save(destination);
  assert.equal(second.load().assets[0].collectionIds[0], 'c'); first.close(); second.close();
});

test('legacy library.json imports once and is archived', () => {
  const databaseFile = temporary('library.db'), legacyFile = path.join(path.dirname(databaseFile), 'library.json');
  fs.writeFileSync(legacyFile, core.serializeLibrary(core.migrateLibrary({ assets: [{ id: 'legacy', path: 'legacy.jpg' }] })));
  const store = createLibraryStore(databaseFile), imported = importLegacyJson(store, legacyFile);
  assert.equal(imported.assets[0].id, 'legacy'); assert.equal(store.load().assets[0].id, 'legacy'); assert.equal(fs.existsSync(`${legacyFile}.migrated`), true); store.close();
});
