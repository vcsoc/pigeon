const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

function orderedNativeDragSelection(assets = [], ids = [], { isLocked = () => false, pathExists = () => true } = {}) {
  const byId = new Map((assets || []).map((asset) => [String(asset.id), asset]));
  const available = [], excluded = [], seen = new Set();
  for (const rawId of ids || []) {
    const id = String(rawId);
    if (seen.has(id)) continue;
    seen.add(id);
    const asset = byId.get(id);
    let reason = '';
    if (!asset) reason = 'missing';
    else if (asset.deletedAt) reason = 'trashed';
    else if (asset.sourcePending) reason = 'cloud-placeholder';
    else if (asset.sourceMissing || !asset.path || !pathExists(asset.path)) reason = 'unavailable';
    else if (isLocked(asset)) reason = 'locked';
    if (reason) excluded.push({ id, reason });
    else available.push(asset);
  }
  return { assets: available, files: available.map((asset) => asset.path), excluded };
}

function collisionSafeBasename(filePath, usedNames, pathApi = path) {
  const originalName = pathApi.basename(filePath), extension = pathApi.extname(originalName), stem = pathApi.basename(originalName, extension);
  let candidate = originalName, suffix = 2;
  while (usedNames.has(candidate.toLocaleLowerCase('en-US'))) candidate = `${stem} (${suffix++})${extension}`;
  usedNames.add(candidate.toLocaleLowerCase('en-US'));
  return candidate;
}

async function prepareCollisionSafeDragFiles(files = [], { stagingRoot, makeDirectory = (directory) => fsp.mkdir(directory, { recursive: true }), linkFile = (source, target) => fsp.link(source, target), copyFile = (source, target) => fsp.copyFile(source, target, fs.constants.COPYFILE_FICLONE), sessionId = () => crypto.randomUUID(), pathApi = path } = {}) {
  const usedNames = new Set(), prepared = [], renamed = [], failed = [];
  let stagingDirectory = '';
  for (const source of files || []) {
    const originalName = pathApi.basename(source), exportName = collisionSafeBasename(source, usedNames, pathApi);
    if (exportName === originalName) { prepared.push(source); continue; }
    if (!stagingRoot) { failed.push({ source, reason: 'collision-staging-unavailable' }); continue; }
    if (!stagingDirectory) { stagingDirectory = pathApi.join(stagingRoot, sessionId()); await makeDirectory(stagingDirectory); }
    const target = pathApi.join(stagingDirectory, exportName);
    try {
      try { await linkFile(source, target); } catch { await copyFile(source, target); }
      prepared.push(target); renamed.push({ source, target, name: exportName });
    } catch (error) { failed.push({ source, reason: 'collision-staging-failed', message: error.message }); }
  }
  return { files: prepared, renamed, failed, stagingDirectory };
}

module.exports = { orderedNativeDragSelection, collisionSafeBasename, prepareCollisionSafeDragFiles };
