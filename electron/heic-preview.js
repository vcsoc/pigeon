'use strict';

const fsp = require('node:fs/promises');

const MAX_HEIC_BYTES = 512 * 1024 * 1024;
const MAX_HEIC_PIXELS = 100 * 1024 * 1024;
let defaultDecoder;

async function decodeHeicToRaw(source, { fsApi = fsp, decoder = null } = {}) {
  const stat = await fsApi.stat(source);
  if (stat.size > MAX_HEIC_BYTES) throw new Error('HEIC file exceeds the 512 MB preview safety limit');
  const bytes = await fsApi.readFile(source), activeDecoder = decoder || (defaultDecoder ||= require('heic-decode'));
  const images = await activeDecoder.all({ buffer: bytes });
  try {
    const image = [...images].sort((first, second) => second.width * second.height - first.width * first.height)[0];
    if (!image?.width || !image?.height) throw new Error('HEIC file contains no decodable image');
    if (image.width * image.height > MAX_HEIC_PIXELS) throw new Error('HEIC image dimensions exceed the preview safety limit');
    const decoded = await image.decode(), expected = decoded.width * decoded.height * 4;
    if (!decoded.data || decoded.data.byteLength < expected) throw new Error('HEIC decoder returned incomplete pixel data');
    // Copy the decoder-owned pixels before dispose() releases its WASM-backed memory.
    return { data: Buffer.from(decoded.data.subarray(0, expected)), width: decoded.width, height: decoded.height, channels: 4, imageCount: images.length };
  } finally {
    images.dispose?.();
  }
}

module.exports = { decodeHeicToRaw, MAX_HEIC_BYTES, MAX_HEIC_PIXELS };
