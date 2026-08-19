'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

async function pathExists(filePath, statFile = fsp.stat) {
  try { await statFile(filePath); return true; }
  catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
}

async function hashFile(filePath, { createReadStream = fs.createReadStream, createHash = crypto.createHash } = {}) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256'), stream = createReadStream(filePath);
    stream.on('error', reject); stream.on('data', (chunk) => hash.update(chunk)); stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function filesAreIdentical(source, destination, dependencies = {}) {
  const statFile = dependencies.statFile || fsp.stat;
  const [sourceStat, destinationStat] = await Promise.all([statFile(source), statFile(destination)]);
  if (!sourceStat.isFile() || !destinationStat.isFile() || sourceStat.size !== destinationStat.size) return false;
  const [sourceHash, destinationHash] = await Promise.all([hashFile(source, dependencies), hashFile(destination, dependencies)]);
  return sourceHash === destinationHash;
}

async function uniqueConflictPath(destination, { exists = pathExists, pathApi = path } = {}) {
  const extension = pathApi.extname(destination), stem = pathApi.basename(destination, extension), directory = pathApi.dirname(destination);
  let suffix = 2, candidate;
  do { candidate = pathApi.join(directory, `${stem} (${suffix++})${extension}`); } while (await exists(candidate));
  return candidate;
}

async function resolveFileConflict(source, destination, {
  autoRename = true,
  exists = pathExists,
  identical = filesAreIdentical,
  decideIdentical = async () => 'skip',
  uniquePath = uniqueConflictPath,
  pathApi = path
} = {}) {
  if (pathApi.resolve(source).toLocaleLowerCase('en-US') === pathApi.resolve(destination).toLocaleLowerCase('en-US')) return { action: 'same', target: destination, renamed: false, identical: true };
  if (!(await exists(destination))) return { action: 'write', target: destination, renamed: false, identical: false };
  const sameContent = await identical(source, destination);
  if (sameContent) {
    const decision = await decideIdentical({ source, destination });
    if (decision !== 'keep-both') return { action: 'skip', target: destination, renamed: false, identical: true };
  } else if (!autoRename) {
    const error = new Error(`${pathApi.basename(destination)} already exists in the destination`);
    error.code = 'FILE_NAME_CONFLICT'; throw error;
  }
  return { action: 'write', target: await uniquePath(destination), renamed: true, identical: sameContent };
}

module.exports = { pathExists, hashFile, filesAreIdentical, uniqueConflictPath, resolveFileConflict };
