const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../electron/library-core');

function library() {
  return core.migrateLibrary({ assets: [
    { id: 'a', filename: 'red-mountain.jpg', extension: 'JPG', kind: 'image', size: 20, contentHash: 'same', width: 1600, height: 900, dominantColor: '#bf4545', tags: ['travel'], rating: 5, collectionIds: ['collection-a'], locationId: 'l1' },
    { id: 'b', filename: 'copy.jpg', extension: 'JPG', kind: 'image', size: 20, contentHash: 'same', width: 1590, height: 900, dominantColor: '#c44848', tags: [], locationId: 'l1' },
    { id: 'c', filename: 'notes.txt', extension: 'TXT', kind: 'file', size: 2, tags: [], locationId: 'l2' }
  ], locations: [{ id: 'l1' }, { id: 'l2' }] });
}

test('repairs legacy PNJ records as renderable images',()=>{const library=core.migrateLibrary({assets:[{id:'pnj',extension:'PNJ',kind:'file',tags:[]}]});assert.equal(library.assets[0].kind,'image');});

test('migrates legacy libraries without losing assets', () => {
  const result = core.migrateLibrary({ version: 1, assets: [{ id: 'x', rating: 9 }], locations: [] });
  assert.equal(result.version, core.SCHEMA_VERSION);
  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0].rating, 5);
  assert.deepEqual(result.assets[0].collectionIds, []);
  assert.equal(result.assets[0].quickChecked, false);
  assert.equal(core.migrateLibrary({assets:[{id:'checked',quickChecked:true}]}).assets[0].quickChecked, true);
  assert.deepEqual(result.settings.pluginPermissions, {});
});

test('preserves custom collection icons through migrations', () => {
  const data = core.migrateLibrary({ collections: [{ id: 'icons', name: 'Icons', icon: 'camera' }] });
  assert.equal(data.collections[0].icon, 'camera');
  assert.equal(JSON.parse(core.serializeLibrary(data)).collections[0].icon, 'camera');
});

test('creates nested collections and rejects invalid or duplicate parents', () => {
  const data = library();
  const requestedId = '12345678-abcd-4abc-8abc-1234567890ab';
  const parent = core.createCollection(data, 'Moodboard', null, requestedId);
  const child = core.createCollection(data, 'Winter', parent.id);
  assert.equal(parent.id, requestedId);
  assert.equal(child.parentId, parent.id);
  assert.throws(() => core.createCollection(data, 'Duplicate ID', null, requestedId), /identifier/);
  assert.throws(() => core.createCollection(data, 'Winter', parent.id), /already exists/);
  assert.throws(() => core.createCollection(data, 'Orphan', 'missing'), /does not exist/);
  core.renameCollection(data, child.id, 'Spring');
  assert.equal(child.name, 'Spring');
  core.moveCollection(data, child.id, null);
  assert.equal(child.parentId, null);
  core.moveCollection(data, child.id, parent.id);
  assert.throws(() => core.moveCollection(data, parent.id, child.id), /descendant/);
});

test('creates, moves, and recursively removes nested smart folders', () => {
  const data = library(), parent = core.createSmartFolder(data, 'People', { tags: ['people'] }), child = core.createSmartFolder(data, 'Family', { tags: ['family'] }, parent.id);
  assert.equal(child.parentId, parent.id);
  assert.equal(core.migrateLibrary({ smartFolders: [{ id: 'legacy', name: 'Legacy' }] }).smartFolders[0].parentId, null);
  assert.throws(() => core.createSmartFolder(data, 'Family', { tags: [] }, parent.id), /already exists/);
  core.renameSmartFolder(data, child.id, 'Friends'); assert.equal(child.name, 'Friends');
  core.moveSmartFolder(data, child.id, null); assert.equal(child.parentId, null);
  core.moveSmartFolder(data, child.id, parent.id); assert.throws(() => core.moveSmartFolder(data, parent.id, child.id), /descendant/);
  assert.equal(core.removeSmartFolder(data, parent.id), 2);
});

test('removing a collection recursively removes memberships but not assets', () => {
  const data = library();
  const parent = core.createCollection(data, 'Parent');
  const child = core.createCollection(data, 'Child', parent.id);
  data.assets[0].collectionIds = [child.id];
  assert.equal(core.removeCollection(data, parent.id), 2);
  assert.equal(data.assets.length, 3);
  assert.deepEqual(data.assets[0].collectionIds, []);
});

test('batch operations update only selected references and support trash restore', () => {
  const data = library();
  assert.equal(core.batchUpdateAssets(data, ['a', 'b'], { addTags: ['picked'], rating: 4, favorite: true, trash: true }), 2);
  assert.equal(data.assets[0].rating, 4);
  assert(data.assets[1].tags.includes('picked'));
  assert(data.assets[0].deletedAt);
  assert.equal(data.assets[2].favorite, false);
  core.batchUpdateAssets(data, ['a'], { restore: true, removeTags: ['picked'] });
  assert.equal(data.assets[0].deletedAt, null);
  assert(!data.assets[0].tags.includes('picked'));
});

test('batch geolocation applies one map point to every selected image', () => {
  const data = library();
  assert.equal(core.batchUpdateAssets(data, ['a', 'b'], { geo: { lat: 51.5074, lon: -0.1278, address: 'London' } }), 2);
  assert.deepEqual({ lat: data.assets[0].geo.lat, lon: data.assets[0].geo.lon, address: data.assets[0].geo.address }, { lat: 51.5074, lon: -0.1278, address: 'London' });
  assert.equal(data.assets[1].geo.address, 'London');
});

test('batch rotation metadata is normalized without changing source files', () => {
  const data = library();
  assert.equal(core.batchUpdateAssets(data, ['a', 'b'], { rotation: -90 }), 2);
  assert.equal(data.assets[0].rotation, 270);
  assert.equal(data.assets[1].rotation, 270);
  assert.equal(core.batchUpdateAssets(data, ['a', 'b'], { rotateBy: 90 }), 2);
  assert.equal(data.assets[0].rotation, 0);
  assert.equal(data.assets[1].rotation, 0);
});

test('stacks selected assets and unstacks the complete group', () => {
  const data = library();
  const result = core.stackAssets(data, ['a', 'b']);
  assert.equal(result.count, 2);
  assert.equal(data.assets[0].stackId, data.assets[1].stackId);
  assert.equal(core.unstackAssets(data, ['a']), 2);
  assert.equal(data.assets[0].stackId, null);
  assert.equal(data.assets[1].stackId, null);
});

test('finds exact hash duplicates and visually similar images', () => {
  const data = library();
  assert.deepEqual(core.exactDuplicateGroups(data.assets).map((group) => group.map((asset) => asset.id)), [['a', 'b']]);
  assert.deepEqual(core.similarAssets(data.assets, data.assets[0]).map((asset) => asset.id), ['b']);
  assert.equal(core.hashDistance('0000000000000000', '000000000000000f'), 4);
});

test('groups visually similar images at configurable accuracy and around a source', () => {
  const assets = [
    { id: 'source', kind: 'image', width: 100, height: 100, perceptualHash: '0000000000000000' },
    { id: 'close', kind: 'image', width: 101, height: 100, perceptualHash: '0000000000000001' },
    { id: 'far', kind: 'image', width: 200, height: 100, perceptualHash: 'ffffffffffffffff' }
  ];
  assert.deepEqual(core.similarImageGroups(assets, 90).map((group) => group.map((asset) => asset.id)), [['source', 'close']]);
  assert.deepEqual(core.similarImageGroups(assets, 90, 'source').map((group) => group.map((asset) => asset.id)), [['source', 'close']]);
  assert.ok(core.visualSimilarityScore(assets[0], assets[1]) > core.visualSimilarityScore(assets[0], assets[2]));
});

test('evaluates serialized smart-folder filters', () => {
  const data = library();
  assert.deepEqual(core.evaluateSmartFolder(data, { filters: { extensions: ['jpg'], ratings: [5], tags: ['travel'] } }).map((asset) => asset.id), ['a']);
  assert.deepEqual(core.evaluateSmartFolder(data, { filters: { ruleMatch: 'all', rules: [{ field: 'name', operator: 'begins', value: 'red' }, { field: 'tags', operator: 'contains', value: 'travel' }] } }).map((asset) => asset.id), ['a']);
  assert.deepEqual(core.evaluateSmartFolder(data, { filters: { ruleMatch: 'any', rules: [{ field: 'tags', operator: 'contains', value: 'missing' }, { field: 'rating', operator: 'equals', value: '5' }] } }).map((asset) => asset.id), ['a']);
  assert.deepEqual(core.evaluateSmartFolder(data, { filters: { rules: [{ field: 'collection', operator: 'not-null', value: '' }] } }).map((asset) => asset.id), ['a']);
  assert.deepEqual(core.evaluateSmartFolder(data, { filters: { rules: [{ field: 'collection', operator: 'null', value: '' }] } }).map((asset) => asset.id), ['b', 'c']);
  assert.deepEqual(core.evaluateSmartFolder(data, { filters: { rules: [{ field: 'rating', operator: 'greater-than-equal', value: '5' }] } }).map((asset) => asset.id), ['a']);
  assert.deepEqual(core.evaluateSmartFolder(data, { filters: { rules: [{ field: 'rating', operator: 'less-than', value: '5' }] } }).map((asset) => asset.id), ['b', 'c']);
});

test('renaming a tag to an existing tag merges memberships case-insensitively', () => {
  const data = library();
  data.assets[0].tags = ['Travel', 'Landscape'];
  data.assets[1].tags = ['landscape'];
  const replacement = core.renameTag(data, 'travel', 'LANDSCAPE');
  assert.equal(replacement, 'Landscape');
  assert.deepEqual(data.assets[0].tags, ['Landscape']);
  assert.deepEqual(data.assets[1].tags, ['landscape']);
});

test('tag deletion removes asset tags and automatic-tag regeneration rules', () => {
  const data = library(); data.assets[1].tags = ['Travel', 'keep'];
  data.settings.folderAutoTags = { folder: { tags: ['travel', 'folder-only'] } };
  data.settings.collectionAutoTags = { collection: { tags: ['TRAVEL', 'collection-only'] } };
  const result = core.deleteTags(data, ['travel']);
  assert.deepEqual(result.deletedTags, ['travel']);
  assert.equal(result.updatedAssets, 2);
  assert.deepEqual(data.assets[0].tags, []);
  assert.deepEqual(data.assets[1].tags, ['keep']);
  assert.deepEqual(data.settings.folderAutoTags.folder.tags, ['folder-only']);
  assert.deepEqual(data.settings.collectionAutoTags.collection.tags, ['collection-only']);
});

test('local tag suggestions are deterministic and metadata based', () => {
  const suggestions = core.suggestTags(library().assets[0]);
  assert(suggestions.includes('mountain'));
  assert(suggestions.includes('landscape'));
  assert(suggestions.includes('image'));
  assert(suggestions.includes('red'));
});

test('serialization always emits migrated schema', () => {
  const parsed = JSON.parse(core.serializeLibrary({ version: 1, assets: [], locations: [] }));
  assert.equal(parsed.version, core.SCHEMA_VERSION);
  assert.deepEqual(parsed.smartFolders, []);
});
