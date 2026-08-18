'use strict';

const fs = require('node:fs/promises');
const zlib = require('node:zlib');

async function pngTextMetadata(source) {
  let bytes;
  try { const stat = await fs.stat(source); if (stat.size > 128 * 1024 * 1024) return null; bytes = await fs.readFile(source); }
  catch { return null; }
  if (bytes.length < 8 || bytes.subarray(1, 4).toString() !== 'PNG') return null;
  const result = {};
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.subarray(offset + 4, offset + 8).toString('ascii'), data = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (length > 2 * 1024 * 1024 || !['tEXt', 'zTXt', 'iTXt'].includes(type)) continue;
    try {
      const zero = data.indexOf(0); if (zero < 1) continue;
      const key = data.subarray(0, zero).toString('latin1'); let text = '';
      if (type === 'tEXt') text = data.subarray(zero + 1).toString('utf8');
      else if (type === 'zTXt') text = zlib.inflateSync(data.subarray(zero + 2), { maxOutputLength: 2 * 1024 * 1024 }).toString('utf8');
      else { const compressed = data[zero + 1] === 1; let cursor = zero + 3; cursor = data.indexOf(0, cursor) + 1; cursor = data.indexOf(0, cursor) + 1; const payload = data.subarray(cursor); text = (compressed ? zlib.inflateSync(payload, { maxOutputLength: 2 * 1024 * 1024 }) : payload).toString('utf8'); }
      if (/^(prompt|workflow|parameters)$/i.test(key) || /"(?:nodes|class_type|prompt|workflow)"/.test(text)) result[key] = text.slice(0, 500000);
    } catch {}
  }
  return Object.keys(result).length ? result : null;
}

module.exports = { pngTextMetadata };
