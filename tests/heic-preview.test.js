'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeHeicToRaw, MAX_HEIC_BYTES, MAX_HEIC_PIXELS } = require('../electron/heic-preview');

test('HEIC preview decoder selects the largest image and releases decoder resources', async () => {
  let disposed = false, decoded = false, decodedPixels;
  const images = [
    { width: 2, height: 2, decode: async () => ({ width: 2, height: 2, data: new Uint8ClampedArray(16) }) },
    { width: 4, height: 3, decode: async () => { decoded = true; decodedPixels = new Uint8ClampedArray(48).fill(127); return { width: 4, height: 3, data: decodedPixels }; } }
  ];
  images.dispose = () => { disposed = true; decodedPixels?.fill(0); };
  const result = await decodeHeicToRaw('sample.HEIC', { fsApi: { stat: async () => ({ size: 32 }), readFile: async () => Buffer.from('heic') }, decoder: { all: async () => images } });
  assert.equal(decoded, true); assert.equal(disposed, true); assert.equal(result.width, 4); assert.equal(result.height, 3); assert.equal(result.channels, 4); assert.equal(result.data.length, 48); assert.equal(result.imageCount, 2);
  assert.equal(result.data[0], 127, 'returned pixels must remain valid after decoder disposal');
});

test('HEIC preview decoder enforces file and decoded-pixel safety limits', async () => {
  await assert.rejects(decodeHeicToRaw('large.heic', { fsApi: { stat: async () => ({ size: MAX_HEIC_BYTES + 1 }) } }), /512 MB/);
  let disposed = false; const images = [{ width: MAX_HEIC_PIXELS + 1, height: 1, decode: async () => assert.fail('oversized image must not decode') }]; images.dispose = () => { disposed = true; };
  await assert.rejects(decodeHeicToRaw('wide.heic', { fsApi: { stat: async () => ({ size: 10 }), readFile: async () => Buffer.alloc(12) }, decoder: { all: async () => images } }), /dimensions/);
  assert.equal(disposed, true);
});
