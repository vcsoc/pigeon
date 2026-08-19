const test = require('node:test');
const assert = require('node:assert/strict');
const { orderedNativeDragSelection, collisionSafeBasename, prepareCollisionSafeDragFiles } = require('../electron/native-drag');

test('native drag preserves selection order and removes duplicate IDs', () => {
  const assets = [{ id: 'a', path: 'A.jpg' }, { id: 'b', path: 'B.jpg' }, { id: 'c', path: 'C.jpg' }];
  const result = orderedNativeDragSelection(assets, ['c', 'a', 'c', 'b']);
  assert.deepEqual(result.files, ['C.jpg', 'A.jpg', 'B.jpg']);
  assert.deepEqual(result.assets.map((asset) => asset.id), ['c', 'a', 'b']);
  assert.deepEqual(result.excluded, []);
});

test('native drag safely excludes unavailable, cloud-placeholder, trashed, and locked assets', () => {
  const assets = [
    { id: 'ok', path: 'ready.jpg' }, { id: 'cloud', path: 'cloud.jpg', sourcePending: true },
    { id: 'gone', path: 'gone.jpg', sourceMissing: true }, { id: 'trash', path: 'trash.jpg', deletedAt: 1 },
    { id: 'locked', path: 'locked.jpg', protected: true }, { id: 'absent', path: 'absent.jpg' }
  ];
  const result = orderedNativeDragSelection(assets, ['cloud', 'ok', 'gone', 'trash', 'locked', 'absent', 'unknown'], {
    isLocked: (asset) => asset.protected === true, pathExists: (filePath) => filePath !== 'absent.jpg'
  });
  assert.deepEqual(result.files, ['ready.jpg']);
  assert.deepEqual(result.excluded, [
    { id: 'cloud', reason: 'cloud-placeholder' }, { id: 'gone', reason: 'unavailable' },
    { id: 'trash', reason: 'trashed' }, { id: 'locked', reason: 'locked' },
    { id: 'absent', reason: 'unavailable' }, { id: 'unknown', reason: 'missing' }
  ]);
});

test('collision-safe drag names are case-insensitive and never reused', () => {
  const used = new Set();
  assert.equal(collisionSafeBasename('one/photo.jpg', used), 'photo.jpg');
  assert.equal(collisionSafeBasename('two/PHOTO.JPG', used), 'PHOTO (2).JPG');
  assert.equal(collisionSafeBasename('three/photo (2).jpg', used), 'photo (2) (2).jpg');
  assert.equal(collisionSafeBasename('four/photo.jpg', used), 'photo (3).jpg');
});

test('native drag stages same-name files without overwriting and preserves order', async () => {
  const operations = [];
  const result = await prepareCollisionSafeDragFiles(['one/photo.jpg', 'two/photo.jpg', 'three/cover.png', 'four/PHOTO.JPG'], {
    stagingRoot: 'drag-root', sessionId: () => 'session', makeDirectory: async (directory) => operations.push(['mkdir', directory]),
    linkFile: async (source, target) => operations.push(['link', source, target]), copyFile: async () => assert.fail('hard-link path should not copy'), pathApi: require('node:path').win32
  });
  assert.deepEqual(result.files, ['one/photo.jpg', 'drag-root\\session\\photo (2).jpg', 'three/cover.png', 'drag-root\\session\\PHOTO (3).JPG']);
  assert.deepEqual(result.renamed.map((item) => item.name), ['photo (2).jpg', 'PHOTO (3).JPG']);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(operations, [['mkdir', 'drag-root\\session'], ['link', 'two/photo.jpg', 'drag-root\\session\\photo (2).jpg'], ['link', 'four/PHOTO.JPG', 'drag-root\\session\\PHOTO (3).JPG']]);
});

test('native drag copies across volumes and skips staging failures clearly', async () => {
  let copies = 0;
  const result = await prepareCollisionSafeDragFiles(['one/file.mov', 'two/file.mov', 'three/file.mov'], {
    stagingRoot: 'drag-root', sessionId: () => 'session', makeDirectory: async () => {}, linkFile: async () => { throw new Error('cross-device'); },
    copyFile: async (source) => { copies += 1; if (source.startsWith('three/')) throw new Error('denied'); }, pathApi: require('node:path').win32
  });
  assert.equal(copies, 2);
  assert.deepEqual(result.files, ['one/file.mov', 'drag-root\\session\\file (2).mov']);
  assert.deepEqual(result.renamed.map((item) => item.name), ['file (2).mov']);
  assert.deepEqual(result.failed.map((item) => item.reason), ['collision-staging-failed']);
});
