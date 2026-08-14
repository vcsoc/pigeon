'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { extractAffinityPreview, affinityPreviewLocation, inspectPng, MAX_PREVIEW_BYTES } = require('../electron/affinity-preview');

const fixture = path.join(__dirname, 'fixtures', 'affinity-preview.af');

test('Affinity preview extraction follows the thumbnail pointer instead of embedded artwork', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pigeon-affinity-'));
  try {
    const result = await extractAffinityPreview(fixture, path.join(directory, 'preview'));
    assert.equal(result.format, 'png');
    assert.equal(result.affinityVersion, 12);
    assert.equal(result.width, 320);
    assert.equal(result.height, 180);
    const metadata = await sharp(result.target).metadata();
    assert.equal(metadata.width, 320);
    assert.equal(metadata.height, 180);
    const pixel = await sharp(result.target).extract({ left: 100, top: 90, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    assert.ok(pixel[0] > 220 && pixel[1] > 170 && pixel[2] < 110, 'expected the yellow rendered preview, not the red decoy image');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Affinity header parsing rejects invalid pointers and oversized previews', () => {
  const fileHeader = Buffer.alloc(40);
  Buffer.from([0x00, 0xff, 0x4b, 0x41]).copy(fileHeader);
  fileHeader.writeBigUInt64LE(64n, 24);
  const thumbnailHeader = Buffer.alloc(29);
  thumbnailHeader.write('Thmb', 4, 'ascii');
  thumbnailHeader.writeUInt32LE(MAX_PREVIEW_BYTES + 1, 24);
  assert.equal(affinityPreviewLocation(fileHeader, thumbnailHeader, MAX_PREVIEW_BYTES * 2), null);
  fileHeader.writeBigUInt64LE(BigInt(Number.MAX_SAFE_INTEGER), 24);
  assert.equal(affinityPreviewLocation(fileHeader, thumbnailHeader, 100), null);
  fileHeader[0] = 1;
  assert.equal(affinityPreviewLocation(fileHeader, thumbnailHeader, 100), null);
});

test('Affinity preview validation requires a complete bounded PNG', async () => {
  const extracted = await extractAffinityPreview(fixture, path.join(os.tmpdir(), `pigeon-affinity-validation-${process.pid}`));
  try {
    const png = fs.readFileSync(extracted.target);
    assert.deepEqual(inspectPng(png), { width: 320, height: 180 });
    assert.equal(inspectPng(png.subarray(0, png.length - 1)), null);
    assert.equal(inspectPng(Buffer.concat([png, Buffer.from([0])])), null);
  } finally {
    fs.rmSync(extracted.target, { force: true });
  }
});
