'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const { safeTransferFilename, uniqueTransferFilename, stageAssetFiles } = require('../electron/portfolio-transfer');

async function temporaryDirectory() { return fsp.mkdtemp(path.join(os.tmpdir(), 'pigeon-transfer-')); }

test('portfolio transfers stage selected linked files with collision-safe names', async () => {
  const root = await temporaryDirectory(), firstDirectory = path.join(root, 'first'), secondDirectory = path.join(root, 'second'), target = path.join(root, 'target');
  await Promise.all([fsp.mkdir(firstDirectory), fsp.mkdir(secondDirectory)]);
  const first = path.join(firstDirectory, 'image.jpg'), second = path.join(secondDirectory, 'image.jpg'), thumbnail = path.join(firstDirectory, 'thumbnail.jpg');
  await Promise.all([fsp.writeFile(first, 'first'), fsp.writeFile(second, 'second'), fsp.writeFile(thumbnail, 'thumbnail')]);
  const staged = await stageAssetFiles([{ id: 'a', path: first, filename: 'image.jpg', thumbnailPath: thumbnail }, { id: 'b', path: second, filename: 'image.jpg' }], target);
  assert.deepEqual(staged.map((item) => item.filename), ['image.jpg', 'image 2.jpg']);
  assert.equal(await fsp.readFile(staged[0].targetPath, 'utf8'), 'first');
  assert.equal(await fsp.readFile(staged[1].targetPath, 'utf8'), 'second');
  assert.equal(await fsp.readFile(staged[0].thumbnailPath, 'utf8'), 'thumbnail');
  assert.match(staged[0].thumbnailPath, /\.pigeon-thumbnails/);
  assert.equal(path.basename(staged[0].thumbnailPath), 'a.jpg');
  assert.equal(staged[1].thumbnailPath, null);
  await fsp.rm(root, { recursive: true, force: true });
});

test('portfolio transfers reject unavailable linked files without creating a staging folder', async () => {
  const root = await temporaryDirectory(), target = path.join(root, 'target');
  await assert.rejects(stageAssetFiles([{ id: 'offline', path: path.join(root, 'missing.jpg'), filename: 'missing.jpg' }], target), (error) => error.code === 'SOURCE_FILES_UNAVAILABLE');
  assert.equal(fs.existsSync(target), false);
  await fsp.rm(root, { recursive: true, force: true });
});

test('portfolio transfers reject cloud placeholders without touching their source path', async () => {
  const root = await temporaryDirectory(), target = path.join(root, 'target');
  await assert.rejects(stageAssetFiles([{ id: 'cloud', path: path.join(root, 'online-only.jpg'), filename: 'online-only.jpg', sourcePending: true }], target), (error) => error.code === 'SOURCE_FILES_UNAVAILABLE');
  assert.equal(fs.existsSync(target), false);
  await fsp.rm(root, { recursive: true, force: true });
});

test('portfolio transfer filenames are sanitized and unique', () => {
  assert.equal(safeTransferFilename('bad<name>.jpg'), 'bad_name_.jpg');
  const used = new Set(['photo.png']);
  assert.equal(uniqueTransferFilename('photo.png', used), 'photo 2.png');
});

test('repeated portfolio transfers reuse a staging folder without overwriting prior files', async () => {
  const root = await temporaryDirectory(), firstDirectory = path.join(root, 'first'), secondDirectory = path.join(root, 'second'), target = path.join(root, 'Transferred from Source');
  await Promise.all([fsp.mkdir(firstDirectory), fsp.mkdir(secondDirectory)]);
  const first = path.join(firstDirectory, 'image.jpg'), second = path.join(secondDirectory, 'image.jpg');
  await Promise.all([fsp.writeFile(first, 'first'), fsp.writeFile(second, 'second')]);
  const firstTransfer = await stageAssetFiles([{ id: 'a', path: first, filename: 'image.jpg' }], target), secondTransfer = await stageAssetFiles([{ id: 'b', path: second, filename: 'image.jpg' }], target);
  assert.equal(firstTransfer[0].filename, 'image.jpg');assert.equal(secondTransfer[0].filename, 'image 2.jpg');
  assert.equal(await fsp.readFile(firstTransfer[0].targetPath, 'utf8'), 'first');assert.equal(await fsp.readFile(secondTransfer[0].targetPath, 'utf8'), 'second');
  assert.equal(path.basename(target), 'Transferred from Source');
  await fsp.rm(root, { recursive: true, force: true });
});
