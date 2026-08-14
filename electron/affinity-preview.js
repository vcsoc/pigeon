'use strict';

const fsp = require('node:fs/promises');

const AFFINITY_MAGIC = Buffer.from([0x00, 0xff, 0x4b, 0x41]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_PREVIEW_BYTES = 64 * 1024 * 1024;
const MAX_PREVIEW_PIXELS = 100 * 1024 * 1024;
const AFFINITY_HEADER_BYTES = 40;
const THUMBNAIL_HEADER_BYTES = 29;

function affinityPreviewLocation(fileHeader, thumbnailHeader, fileSize) {
  if (!Buffer.isBuffer(fileHeader) || fileHeader.length < AFFINITY_HEADER_BYTES || !fileHeader.subarray(0, 4).equals(AFFINITY_MAGIC)) return null;
  const offsetValue = fileHeader.readBigUInt64LE(24);
  if (offsetValue > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const thumbnailOffset = Number(offsetValue);
  if (thumbnailOffset < AFFINITY_HEADER_BYTES || thumbnailOffset + THUMBNAIL_HEADER_BYTES > fileSize) return null;
  if (!Buffer.isBuffer(thumbnailHeader) || thumbnailHeader.length < THUMBNAIL_HEADER_BYTES || thumbnailHeader.subarray(4, 8).toString('ascii') !== 'Thmb') return null;
  const length = thumbnailHeader.readUInt32LE(24);
  const imageOffset = thumbnailOffset + THUMBNAIL_HEADER_BYTES;
  if (length < 45 || length > MAX_PREVIEW_BYTES || imageOffset + length > fileSize) return null;
  return { imageOffset, length, affinityVersion: fileHeader.readUInt16LE(4) };
}

function inspectPng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 45 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let chunks = 0;
  while (offset + 12 <= buffer.length && chunks < 10000) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (length > MAX_PREVIEW_BYTES || end > buffer.length) return null;
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    if (chunks === 0) {
      if (type !== 'IHDR' || length !== 13) return null;
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
      if (!width || !height || width * height > MAX_PREVIEW_PIXELS) return null;
    }
    offset = end;
    chunks += 1;
    if (type === 'IEND') return length === 0 && offset === buffer.length ? { width, height } : null;
  }
  return null;
}

async function readAt(handle, length, position) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  return bytesRead === length ? buffer : null;
}

async function extractAffinityPreview(source, targetBase) {
  const handle = await fsp.open(source, 'r');
  let temporaryPath = null;
  try {
    const stat = await handle.stat();
    const fileHeader = await readAt(handle, AFFINITY_HEADER_BYTES, 0);
    if (!fileHeader) return null;
    const offsetValue = fileHeader.readBigUInt64LE(24);
    if (offsetValue > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    const thumbnailOffset = Number(offsetValue);
    if (thumbnailOffset < AFFINITY_HEADER_BYTES || thumbnailOffset + THUMBNAIL_HEADER_BYTES > stat.size) return null;
    const thumbnailHeader = await readAt(handle, THUMBNAIL_HEADER_BYTES, thumbnailOffset);
    const location = affinityPreviewLocation(fileHeader, thumbnailHeader, stat.size);
    if (!location) return null;
    const image = await readAt(handle, location.length, location.imageOffset);
    const metadata = inspectPng(image);
    if (!metadata) return null;
    const target = `${targetBase}.png`;
    temporaryPath = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(temporaryPath, image, { flag: 'wx' });
    await fsp.rm(target, { force: true });
    await fsp.rename(temporaryPath, target);
    temporaryPath = null;
    return { target, format: 'png', affinityVersion: location.affinityVersion, ...metadata };
  } finally {
    await handle.close();
    if (temporaryPath) await fsp.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

module.exports = { extractAffinityPreview, affinityPreviewLocation, inspectPng, MAX_PREVIEW_BYTES };
