'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');
const { saveImageToFile } = require('../electron/save-image-to-file');

async function fixture(t, extension = '.png') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pigeon-physical-save-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, `image${extension}`);
  await sharp({ create: { width: 100, height: 80, channels: 4, background: '#ff0000' } }).toFormat(extension === '.jpg' ? 'jpeg' : 'png').toFile(file);
  const stat = await fs.stat(file);
  return { file, dir, asset: { path: file, size: stat.size, modified: stat.mtimeMs, rotation: 0 } };
}

test('Save writes cropped pixels to the original file and preserves its permissions', async t => {
  const { file, asset } = await fixture(t);
  await fs.chmod(file, 0o600);
  const result = await saveImageToFile(asset, file, { crop: { x: 10, y: 12, width: 40, height: 30 } });
  const metadata = await sharp(file).metadata();
  assert.equal(result.width, 40);
  assert.equal(metadata.width, 40);
  assert.equal(metadata.height, 30);
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
});

test('Save preserves JPEG format and rejects unsupported sources without changing them', async t => {
  const { file, asset } = await fixture(t, '.jpg');
  await saveImageToFile(asset, file, { crop: { x: 5, y: 6, width: 30, height: 20 } });
  assert.equal((await sharp(file).metadata()).format, 'jpeg');
  const svg = path.join(path.dirname(file), 'image.svg');
  await fs.writeFile(svg, '<svg/>');
  const stat = await fs.stat(svg);
  await assert.rejects(saveImageToFile({ path: svg, size: stat.size, modified: stat.mtimeMs }, svg), /Save copy/);
  assert.equal(await fs.readFile(svg, 'utf8'), '<svg/>');
});

test('Save leaves original intact if rendering fails or the source changed', async t => {
  const { file, asset } = await fixture(t);
  const before = await fs.readFile(file);
  await assert.rejects(saveImageToFile(asset, file, {}, [], { render: async () => { throw new Error('render failed'); } }), /render failed/);
  assert.deepEqual(await fs.readFile(file), before);
  await assert.rejects(saveImageToFile(asset, file, {}, [], { verify: () => { throw new Error('asset changed'); } }), /asset changed/);
  assert.deepEqual(await fs.readFile(file), before);
  let renameCount = 0;
  const fsApi = { ...fs, async rename(from, to) { if (++renameCount === 2) throw new Error('disk rename failed'); return fs.rename(from, to); } };
  await assert.rejects(saveImageToFile(asset, file, {}, [], { fsApi }), /disk rename failed/);
  assert.deepEqual(await fs.readFile(file), before, 'Original must be restored if the final rename fails');
  assert.equal((await fs.readdir(path.dirname(file))).filter(name => name.startsWith('.pigeon-')).length, 0);
  await assert.rejects(saveImageToFile(asset, file, {}, [], { render: async (source, target) => { await sharp(source).png().toFile(target); await fs.writeFile(file, 'external change'); return { width: 100, height: 80 }; } }), /changed during editing/);
  assert.equal(await fs.readFile(file, 'utf8'), 'external change');
});

test('Save replaces only the named hardlink; rejects symlinks and stale indexed files', async t => {
  const { file, dir, asset } = await fixture(t);
  const link = path.join(dir, 'linked.png');
  await fs.link(file, link);
  await saveImageToFile(asset, file, { crop: { x: 0, y: 0, width: 40, height: 30 } });
  assert.equal((await sharp(file).metadata()).width, 40);
  assert.equal((await sharp(link).metadata()).width, 100);
  const alias = path.join(dir, 'alias.png');
  await fs.symlink(file, alias);
  await assert.rejects(saveImageToFile({ ...asset, path: alias }, alias), /symbolic link/);
  await assert.rejects(saveImageToFile({ ...asset, size: 0 }, file), /changed since it was indexed/);
});
