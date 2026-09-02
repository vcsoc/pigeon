'use strict';

const fsp = require('node:fs/promises');
const path = require('node:path');

const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const INVALID_NAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/;

function safeFolderName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw new Error('Enter a folder name.');
  if (name === '.' || name === '..') throw new Error('Folder name cannot be “.” or “..”.');
  if (INVALID_NAME_CHARACTERS.test(name)) throw new Error('Folder name cannot contain < > : " / \\ | ? * or control characters.');
  if (/[. ]$/.test(name)) throw new Error('Folder name cannot end with a space or period.');
  if (WINDOWS_RESERVED_NAME.test(name)) throw new Error('That folder name is reserved by the operating system.');
  if (name.length > 255 || Buffer.byteLength(name, 'utf8') > 255) throw new Error('Folder name must be 255 characters or fewer.');
  return name;
}

function cleanRelativeSubfolder(value = '') {
  const subfolder = String(value).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!subfolder) return '';
  const parts = subfolder.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) throw new Error('The selected folder path is invalid.');
  return parts.join(path.sep);
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function createPhysicalSubfolder(locationRoot, subfolder, requestedName, fsApi = fsp) {
  const name = safeFolderName(requestedName), relativeParent = cleanRelativeSubfolder(subfolder);
  let canonicalRoot, canonicalParent;
  try {
    canonicalRoot = await fsApi.realpath(path.resolve(locationRoot));
    canonicalParent = await fsApi.realpath(path.resolve(locationRoot, relativeParent));
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error('The selected folder no longer exists.');
    throw error;
  }
  if (!isInside(canonicalRoot, canonicalParent)) throw new Error('The selected folder is outside its physical folder root.');
  const target = path.join(canonicalParent, name);
  try {
    await fsApi.mkdir(target);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`A folder named “${name}” already exists.`);
    if (error?.code === 'EACCES' || error?.code === 'EPERM') throw new Error('Pigeon does not have permission to create a folder there.');
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw new Error('The selected folder no longer exists.');
    throw error;
  }
  return { name, path: target, subfolder: [...(relativeParent ? relativeParent.split(path.sep) : []), name].join('/') };
}

function comparablePath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' || process.platform === 'darwin' ? resolved.toLowerCase() : resolved;
}

function rebasePhysicalPath(source, target, candidate) {
  const relative = path.relative(source, candidate);
  if (relative === '') return target;
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
  return path.join(target, relative);
}

function rebaseSubfolder(source, target, candidate) {
  const from = String(source).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const to = String(target).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const value = String(candidate).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (value.toLowerCase() === from.toLowerCase()) return to;
  if (!value.toLowerCase().startsWith(`${from.toLowerCase()}/`)) return null;
  return `${to}${value.slice(from.length)}`;
}

async function safeExistingFolder(locationRoot, subfolder, { allowRoot = false, fsApi = fsp } = {}) {
  const relative = cleanRelativeSubfolder(subfolder);
  if (!relative && !allowRoot) throw new Error('A physical folder root cannot be moved from within Pigeon.');
  let canonicalRoot, canonicalFolder;
  try {
    canonicalRoot = await fsApi.realpath(path.resolve(locationRoot));
    const lexicalFolder = path.resolve(canonicalRoot, relative);
    canonicalFolder = await fsApi.realpath(lexicalFolder);
    if (!isInside(canonicalRoot, canonicalFolder)) throw new Error('The selected folder is outside its physical folder root.');
    if (comparablePath(lexicalFolder) !== comparablePath(canonicalFolder)) throw new Error('Folders reached through symbolic links cannot be moved.');
    if (!(await fsApi.stat(canonicalFolder)).isDirectory()) throw new Error('The selected path is not a folder.');
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error('The selected folder no longer exists.');
    throw error;
  }
  return { canonicalRoot, folder: canonicalFolder, relative };
}

async function moveDirectory(source, target, fsApi = fsp) {
  try {
    await fsApi.rename(source, target);
    return 'rename';
  } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
  }
  try {
    await fsApi.cp(source, target, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
  } catch (error) {
    await fsApi.rm(target, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
  try {
    await fsApi.rm(source, { recursive: true, force: false });
  } catch (error) {
    await fsApi.rm(target, { recursive: true, force: true }).catch(() => {});
    throw new Error('The folder was copied, but its original could not be removed; the move was rolled back.');
  }
  return 'copy-remove';
}

async function deletePhysicalFolder(locationRoot, subfolder = '', { trashItem, fsApi = fsp } = {}) {
  const target = await safeExistingFolder(locationRoot, subfolder, { allowRoot: true, fsApi });
  if (comparablePath(target.folder) === comparablePath(path.parse(target.folder).root)) throw new Error('A drive root cannot be deleted.');
  const entries = await fsApi.readdir(target.folder);
  if (!entries.length) {
    await fsApi.rmdir(target.folder);
    return { path: target.folder, empty: true, recycled: false };
  }
  if (typeof trashItem !== 'function') throw new Error('The operating-system Recycle Bin is unavailable.');
  await trashItem(target.folder);
  return { path: target.folder, empty: false, recycled: true };
}

async function movePhysicalSubfolder({ sourceRoot, sourceSubfolder, destinationRoot, destinationParentSubfolder = '', name }, fsApi = fsp) {
  const source = await safeExistingFolder(sourceRoot, sourceSubfolder, { fsApi });
  const destination = await safeExistingFolder(destinationRoot, destinationParentSubfolder, { allowRoot: true, fsApi });
  if (isInside(source.folder, destination.folder)) throw new Error('A folder cannot be moved into itself or one of its descendants.');
  const targetName = safeFolderName(name || path.basename(source.folder)), target = path.join(destination.folder, targetName);
  if (!isInside(destination.canonicalRoot, target)) throw new Error('The destination must stay inside a physical folder root.');
  const same = comparablePath(source.folder) === comparablePath(target);
  if (source.folder === target) return { moved: false, name: targetName, path: target, subfolder: String(sourceSubfolder).replace(/\\/g, '/') };
  if (!same) {
    try { await fsApi.lstat(target); throw new Error(`A file or folder named “${targetName}” already exists.`); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
  let method;
  try {
    if (same) {
      const temporary = path.join(path.dirname(source.folder), `.pigeon-folder-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      await fsApi.rename(source.folder, temporary);
      try { await fsApi.rename(temporary, target); method = 'rename'; }
      catch (error) { await fsApi.rename(temporary, source.folder).catch(() => {}); throw error; }
    } else method = await moveDirectory(source.folder, target, fsApi);
  } catch (error) {
    if (error?.code === 'EACCES' || error?.code === 'EPERM') throw new Error('Pigeon does not have permission to move that folder.');
    if (error?.code === 'ENOENT') throw new Error('The selected folder no longer exists.');
    throw error;
  }
  const parent = String(destinationParentSubfolder).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return { moved: true, method, name: targetName, source: source.folder, path: target, subfolder: [parent, targetName].filter(Boolean).join('/') };
}

module.exports = { createPhysicalSubfolder, deletePhysicalFolder, movePhysicalSubfolder, rebasePhysicalPath, rebaseSubfolder, safeFolderName };
