const fs = require('node:fs/promises');
const path = require('node:path');

const MIME_TYPES = Object.freeze({
  '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.gif':'image/gif', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.mp4':'video/mp4', '.m4v':'video/mp4', '.mov':'video/quicktime', '.webm':'video/webm', '.ogv':'video/ogg',
  '.mp3':'audio/mpeg', '.wav':'audio/wav', '.m4a':'audio/mp4', '.aac':'audio/aac', '.flac':'audio/flac', '.ogg':'audio/ogg', '.oga':'audio/ogg', '.opus':'audio/ogg'
});

function imageMimeFromBytes(bytes) {
  if (!bytes || bytes.length < 4) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
  if (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

function mimeTypeForExtension(extension, bytes = null) {
  const normalized = String(extension || '').toLowerCase();
  if (normalized === '.pnj' || normalized === 'pnj') return imageMimeFromBytes(bytes) || 'application/octet-stream';
  const key = normalized.startsWith('.') ? normalized : `.${normalized}`;
  return MIME_TYPES[key] || 'application/octet-stream';
}

async function mimeTypeForFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension !== '.pnj') return mimeTypeForExtension(extension);
  const handle = await fs.open(filePath, 'r');
  try {
    const bytes = Buffer.alloc(16), { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    return mimeTypeForExtension(extension, bytes.subarray(0, bytesRead));
  } finally { await handle.close(); }
}

module.exports = { imageMimeFromBytes, mimeTypeForExtension, mimeTypeForFile };
