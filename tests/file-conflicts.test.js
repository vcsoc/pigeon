const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');
const { filesAreIdentical, uniqueConflictPath, replaceFileSafely, resolveFileConflict } = require('../electron/file-conflicts');

test('file comparison detects identical bytes and rejects same-size differing content', async (t) => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'pigeon-conflict-')); t.after(() => fsp.rm(directory, { recursive: true, force: true }));
  const first = path.join(directory, 'first.bin'), same = path.join(directory, 'same.bin'), different = path.join(directory, 'different.bin');
  await Promise.all([fsp.writeFile(first, 'PIGEON'), fsp.writeFile(same, 'PIGEON'), fsp.writeFile(different, 'pigeon')]);
  assert.equal(await filesAreIdentical(first, same), true);
  assert.equal(await filesAreIdentical(first, different), false);
});

test('differing content receives a collision-safe name only when preference is enabled', async () => {
  const occupied = new Set(['C:\\target\\photo.jpg', 'C:\\target\\photo (2).jpg'].map((item) => item.toLowerCase()));
  const exists = async (candidate) => occupied.has(candidate.toLowerCase());
  assert.equal(await uniqueConflictPath('C:\\target\\photo.jpg', { exists, pathApi: path.win32 }), 'C:\\target\\photo (3).jpg');
  const resolved = await resolveFileConflict('C:\\source\\photo.jpg', 'C:\\target\\photo.jpg', { exists, identical: async () => false, uniquePath: (target) => uniqueConflictPath(target, { exists, pathApi: path.win32 }), pathApi: path.win32 });
  assert.deepEqual(resolved, { action: 'write', target: 'C:\\target\\photo (3).jpg', renamed: true, identical: false });
  await assert.rejects(() => resolveFileConflict('C:\\source\\photo.jpg', 'C:\\target\\photo.jpg', { autoRename: false, exists, identical: async () => false, pathApi: path.win32 }), { code: 'FILE_NAME_CONFLICT' });
});

test('safe overwrite leaves one destination and removes a moved source', async (t) => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'pigeon-overwrite-')); t.after(() => fsp.rm(directory, { recursive: true, force: true }));
  const source=path.join(directory,'incoming.jpg'),destination=path.join(directory,'existing.jpg');await Promise.all([fsp.writeFile(source,'PIGEON'),fsp.writeFile(destination,'PIGEON')]);
  await replaceFileSafely(source,destination,{removeSource:true});
  assert.equal(await fsp.readFile(destination,'utf8'),'PIGEON');await assert.rejects(()=>fsp.stat(source),{code:'ENOENT'});assert.deepEqual((await fsp.readdir(directory)).sort(),['existing.jpg']);
});

test('identical conflicts support Skip, Keep both, and Overwrite decisions', async () => {
  const base = { exists: async () => true, identical: async () => true, uniquePath: async () => '/target/file (2).jpg' };
  assert.equal((await resolveFileConflict('/source/file.jpg', '/target/file.jpg', { ...base, decideIdentical: async () => 'skip' })).action, 'skip');
  assert.deepEqual(await resolveFileConflict('/source/file.jpg', '/target/file.jpg', { ...base, decideIdentical: async () => 'keep-both' }), { action: 'write', target: '/target/file (2).jpg', renamed: true, identical: true });
  assert.deepEqual(await resolveFileConflict('/source/file.jpg', '/target/file.jpg', { ...base, decideIdentical: async () => 'overwrite' }), { action: 'overwrite', target: '/target/file.jpg', renamed: false, identical: true });
});
