'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createPhysicalSubfolder, deletePhysicalFolder, movePhysicalSubfolder, rebasePhysicalPath, rebaseSubfolder, safeFolderName } = require('../electron/physical-folders');

async function temporaryDirectory() { return fsp.mkdtemp(path.join(os.tmpdir(), 'pigeon-physical-folder-')); }

test('safe folder names reject traversal, separators, reserved names, and invalid endings', () => {
  for (const name of ['', '.', '..', '../escape', 'nested/name', 'bad\\name', 'CON', 'com1.txt', 'trailing.']) {
    assert.throws(() => safeFolderName(name));
  }
  assert.equal(safeFolderName('  New references  '), 'New references');
});

test('creates one physical subfolder inside a nested indexed folder', async () => {
  const root = await temporaryDirectory(), parent = path.join(root, 'existing');
  await fsp.mkdir(parent);
  const created = await createPhysicalSubfolder(root, 'existing', 'New references');
  assert.equal(created.name, 'New references');
  assert.equal(created.subfolder, 'existing/New references');
  assert.equal((await fsp.stat(created.path)).isDirectory(), true);
  await assert.rejects(createPhysicalSubfolder(root, 'existing', 'New references'), /already exists/);
  await fsp.rm(root, { recursive: true, force: true });
});

test('rejects missing parents and parents that escape through a symlink', async (context) => {
  const root = await temporaryDirectory(), outside = await temporaryDirectory();
  context.after(async () => { await fsp.rm(root, { recursive: true, force: true }); await fsp.rm(outside, { recursive: true, force: true }); });
  await assert.rejects(createPhysicalSubfolder(root, 'missing', 'child'), /no longer exists/);
  const link = path.join(root, 'outside-link');
  try { await fsp.symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { context.skip(`Symlinks unavailable: ${error.code}`); return; }
  await assert.rejects(createPhysicalSubfolder(root, 'outside-link', 'child'), /outside its physical folder root/);
});

test('deletes empty folders immediately and recycles non-empty folders', async (context) => {
  const root = await temporaryDirectory(); context.after(() => fsp.rm(root, { recursive: true, force: true }));
  await fsp.mkdir(path.join(root, 'empty')); await fsp.mkdir(path.join(root, 'full')); await fsp.writeFile(path.join(root, 'full', 'asset.txt'), 'asset');
  const canonicalFull = await fsp.realpath(path.join(root, 'full'));
  let recycled = null; const empty = await deletePhysicalFolder(root, 'empty', { trashItem: async () => assert.fail('empty folders must not use trash') });
  assert.equal(empty.empty, true); await assert.rejects(fsp.access(path.join(root, 'empty')));
  const full = await deletePhysicalFolder(root, 'full', { trashItem: async (target) => { recycled = target; await fsp.rm(target, { recursive: true }); } });
  assert.equal(full.recycled, true); assert.equal(recycled, canonicalFull); await assert.rejects(fsp.access(path.join(root, 'full')));
});

test('renames and moves physical folders while preserving their contents', async (context) => {
  const root = await temporaryDirectory(); context.after(() => fsp.rm(root, { recursive: true, force: true }));
  await fsp.mkdir(path.join(root, 'source')); await fsp.mkdir(path.join(root, 'destination')); await fsp.writeFile(path.join(root, 'source', 'asset.txt'), 'asset');
  const renamed = await movePhysicalSubfolder({ sourceRoot: root, sourceSubfolder: 'source', destinationRoot: root, name: 'renamed' });
  assert.equal(renamed.subfolder, 'renamed'); assert.equal(await fsp.readFile(path.join(root, 'renamed', 'asset.txt'), 'utf8'), 'asset');
  const moved = await movePhysicalSubfolder({ sourceRoot: root, sourceSubfolder: 'renamed', destinationRoot: root, destinationParentSubfolder: 'destination' });
  assert.equal(moved.subfolder, 'destination/renamed'); assert.equal(await fsp.readFile(path.join(root, 'destination', 'renamed', 'asset.txt'), 'utf8'), 'asset');
});

test('rejects collisions, physical-root moves, and moves into descendants', async (context) => {
  const root = await temporaryDirectory(); context.after(() => fsp.rm(root, { recursive: true, force: true }));
  await fsp.mkdir(path.join(root, 'source', 'child'), { recursive: true }); await fsp.mkdir(path.join(root, 'taken'));
  await assert.rejects(movePhysicalSubfolder({ sourceRoot: root, sourceSubfolder: '', destinationRoot: root }), /physical folder root cannot be moved/);
  await assert.rejects(movePhysicalSubfolder({ sourceRoot: root, sourceSubfolder: 'source', destinationRoot: root, name: 'taken' }), /already exists/);
  await assert.rejects(movePhysicalSubfolder({ sourceRoot: root, sourceSubfolder: 'source', destinationRoot: root, destinationParentSubfolder: 'source/child' }), /descendants/);
});

test('falls back to copy and remove for cross-device folder moves', async (context) => {
  const sourceRoot = await temporaryDirectory(), destinationRoot = await temporaryDirectory();
  context.after(async () => { await fsp.rm(sourceRoot, { recursive: true, force: true }); await fsp.rm(destinationRoot, { recursive: true, force: true }); });
  await fsp.mkdir(path.join(sourceRoot, 'source')); await fsp.writeFile(path.join(sourceRoot, 'source', 'asset.txt'), 'asset');
  let firstRename = true; const fsApi = { ...fsp, rename: async (source, target) => { if (firstRename) { firstRename = false; const error = new Error('different devices'); error.code = 'EXDEV'; throw error; } return fsp.rename(source, target); } };
  const moved = await movePhysicalSubfolder({ sourceRoot, sourceSubfolder: 'source', destinationRoot }, fsApi);
  assert.equal(moved.method, 'copy-remove'); assert.equal(await fsp.readFile(path.join(destinationRoot, 'source', 'asset.txt'), 'utf8'), 'asset');
  await assert.rejects(fsp.access(path.join(sourceRoot, 'source')));
});

test('rebases physical paths and nested folder settings without touching siblings', () => {
  assert.equal(rebasePhysicalPath('C:/root/source', 'D:/target/source', 'C:/root/source/child/file.jpg'), path.join('D:/target/source', 'child/file.jpg'));
  assert.equal(rebasePhysicalPath('C:/root/source', 'D:/target/source', 'C:/root/sibling/file.jpg'), null);
  assert.equal(rebaseSubfolder('source', 'destination/source', 'source/child'), 'destination/source/child');
  assert.equal(rebaseSubfolder('source', 'destination/source', 'source-two'), null);
});
