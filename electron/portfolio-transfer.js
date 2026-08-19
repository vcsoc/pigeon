'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');

function safeTransferFilename(value, fallback = 'asset') {
  const cleaned = String(value || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim();
  return cleaned || fallback;
}

function uniqueTransferFilename(filename, usedNames) {
  const safe = safeTransferFilename(filename), extension = path.extname(safe), stem = path.basename(safe, extension);
  let candidate = safe, suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) candidate = `${stem} ${suffix++}${extension}`;
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

async function stageAssetFiles(assets, targetDirectory) {
  if (!Array.isArray(assets) || !assets.length) throw new Error('Select one or more available files');
  const unavailable = [];
  for (const asset of assets) {
    if (asset.sourceMissing || asset.sourcePending) { unavailable.push(asset.filename || asset.name || asset.path); continue; }
    try { const stat = await fsp.stat(asset.path); if (!stat.isFile()) unavailable.push(asset.filename || asset.name || asset.path); }
    catch { unavailable.push(asset.filename || asset.name || asset.path); }
  }
  if (unavailable.length) {
    const error = new Error(`${unavailable.length} selected file${unavailable.length === 1 ? ' is' : 's are'} offline or unavailable`);
    error.code = 'SOURCE_FILES_UNAVAILABLE'; error.files = unavailable; throw error;
  }
  await fsp.mkdir(targetDirectory, { recursive: true });
  const usedNames = new Set((await fsp.readdir(targetDirectory).catch(() => [])).map((name) => name.toLowerCase())), staged = [], writtenPaths = [], thumbnailNames = new Set();
  try {
    for (const asset of assets) {
      const filename = uniqueTransferFilename(asset.filename || path.basename(asset.path), usedNames), targetPath = path.join(targetDirectory, filename);
      await fsp.copyFile(asset.path, targetPath);writtenPaths.push(targetPath);
      let thumbnailPath = null;
      if (asset.thumbnailPath) {
        try {
          const thumbnailStat = await fsp.stat(asset.thumbnailPath);
          if (thumbnailStat.isFile()) {
            const thumbnailDirectory = path.join(targetDirectory, '.pigeon-thumbnails'), extension = path.extname(asset.thumbnailPath) || '.jpg';
            await fsp.mkdir(thumbnailDirectory, { recursive: true });
            if (!thumbnailNames.size) for (const name of await fsp.readdir(thumbnailDirectory).catch(() => [])) thumbnailNames.add(name.toLowerCase());
            thumbnailPath = path.join(thumbnailDirectory, uniqueTransferFilename(`${asset.id}${extension}`, thumbnailNames)); await fsp.copyFile(asset.thumbnailPath, thumbnailPath);writtenPaths.push(thumbnailPath);
          }
        } catch { thumbnailPath = null; }
      }
      staged.push({ asset, filename, targetPath, thumbnailPath });
    }
    return staged;
  } catch (error) {
    await Promise.all(writtenPaths.map((writtenPath) => fsp.rm(writtenPath, { force: true }).catch(() => {})));
    throw error;
  }
}

module.exports = { safeTransferFilename, uniqueTransferFilename, stageAssetFiles };
