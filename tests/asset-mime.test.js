const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { imageMimeFromBytes, mimeTypeForExtension, mimeTypeForFile } = require('../electron/asset-mime');

const jpeg = Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46]);
const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00,0x00,0x00,0x0d]);

test('PNJ media types are detected from JPEG and PNG signatures', () => {
  assert.equal(imageMimeFromBytes(jpeg), 'image/jpeg');
  assert.equal(imageMimeFromBytes(png), 'image/png');
  assert.equal(mimeTypeForExtension('.pnj', jpeg), 'image/jpeg');
  assert.equal(mimeTypeForExtension('PNJ', png), 'image/png');
  assert.equal(mimeTypeForExtension('.pnj', Buffer.from('unknown')), 'application/octet-stream');
});

test('PNJ file MIME detection reads only the image signature', async (context) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'pigeon-pnj-'));
  context.after(() => fsp.rm(root, { recursive: true, force: true }));
  const jpegPath = path.join(root, 'photo.pnj'), pngPath = path.join(root, 'art.PNJ');
  await fsp.writeFile(jpegPath, Buffer.concat([jpeg, Buffer.alloc(100)]));
  await fsp.writeFile(pngPath, Buffer.concat([png, Buffer.alloc(100)]));
  assert.equal(await mimeTypeForFile(jpegPath), 'image/jpeg');
  assert.equal(await mimeTypeForFile(pngPath), 'image/png');
});
