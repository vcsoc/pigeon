'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { renderImageDerivative } = require('./image-derivative');

const FILE_FORMATS = new Map([['.png','png'],['.jpg','jpeg'],['.jpeg','jpeg'],['.webp','webp']]);

async function saveImageToFile(asset, source, edits = {}, annotations = [], { verify = () => {}, fsApi = fs, render = renderImageDerivative } = {}) {
  const target = asset?.path, format = FILE_FORMATS.get(path.extname(target || '').toLowerCase());
  if (!format) throw new Error('Save supports PNG, JPEG, and WebP source files. Use Save copy for other formats.');
  const original = await fsApi.lstat(target);
  if (!original.isFile() || original.isSymbolicLink()) throw new Error('This is not a regular image file. Use Save copy instead of writing through a symbolic link.');
  if (Number(asset.size) !== original.size || Math.abs(Number(asset.modified) - original.mtimeMs) > 2) throw new Error('The physical file changed since it was indexed. Rescan or reopen before saving.');
  const token = crypto.randomUUID(), temporary = path.join(path.dirname(target), `.pigeon-save-${token}${path.extname(target)}`), backup = path.join(path.dirname(target), `.pigeon-before-save-${token}${path.extname(target)}`);
  try {
    const result = await render(source, temporary, { ...edits, format, rotate: ((Number(asset.rotation) || 0) + Number(edits.rotate || 0) + 360) % 360, annotations });
    verify();
    const current = await fsApi.lstat(target);
    if (!current.isFile() || current.isSymbolicLink() || current.ino !== original.ino || current.dev !== original.dev || current.size !== original.size || current.mtimeMs !== original.mtimeMs) throw new Error('The physical file changed during editing. Your pending edits were not written.');
    await fsApi.chmod(temporary, original.mode & 0o777);
    await fsApi.rename(target, backup);
    try {
      await fsApi.rename(temporary, target);
    } catch (error) {
      try { await fsApi.rename(backup, target); }
      catch (restoreError) { throw new Error(`Save failed and the original could not be restored. Recovery file: ${backup}`, { cause: restoreError }); }
      throw error;
    }
    const saved = await fsApi.stat(target);
    await fsApi.rm(backup, { force: true }).catch(() => {});
    return { ...result, size: saved.size, modified: saved.mtimeMs, target };
  } finally {
    // Never delete the backup if restoration failed; it is the only surviving original.
    await fsApi.rm(temporary, { force: true }).catch(() => {});
  }
}

module.exports = { saveImageToFile };
