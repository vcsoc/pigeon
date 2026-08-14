const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { extractSnagxPreview, selectSnagxImageEntry } = require('../electron/snagx-preview');

test('SNAGX preview extraction prefers the rendered thumbnail over backups and larger source layers', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pigeon-snagx-'));
  try {
    const result = await extractSnagxPreview(path.join(__dirname, 'fixtures', 'snagx-preview.snagx'), path.join(directory, 'preview'));
    assert.equal(result.entryName, 'thumbnail.png');
    const metadata = await sharp(result.target).metadata();
    assert.equal(metadata.width, 320);
    assert.equal(metadata.height, 180);
    const pixel = await sharp(result.target).extract({ left: 90, top: 50, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    assert.ok(pixel[0] > 180 && pixel[1] > 140 && pixel[2] < 120, 'expected the rendered yellow annotation from thumbnail.png');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('SNAGX image selection falls back to the largest safe non-backup image', () => {
  const selected = selectSnagxImageEntry([
    { fileName: 'capture.backup.png', uncompressedSize: 9000 },
    { fileName: 'small.jpg', uncompressedSize: 100 },
    { fileName: 'current.png', uncompressedSize: 5000 },
    { fileName: 'notes.json', uncompressedSize: 12000 }
  ]);
  assert.equal(selected.fileName, 'current.png');
});

test('SNAGX image selection rejects oversized and unsupported archive entries', () => {
  assert.equal(selectSnagxImageEntry([
    { fileName: 'huge.png', uncompressedSize: 300 * 1024 * 1024 },
    { fileName: 'payload.exe', uncompressedSize: 10 }
  ]), null);
});
