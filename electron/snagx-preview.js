const fs = require('node:fs/promises');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const yauzl = require('yauzl');

const MAX_ARCHIVE_ENTRIES = 10000;
const MAX_PREVIEW_BYTES = 256 * 1024 * 1024;
const IMAGE_EXTENSION = /\.(png|jpe?g|webp)$/i;

function selectSnagxImageEntry(entries) {
  const images = entries.filter((entry) => {
    const name = String(entry.fileName || '').replace(/\\/g, '/');
    return IMAGE_EXTENSION.test(name) && !/(^|\/)__MACOSX\//i.test(name) && !/\.backup\.(png|jpe?g|webp)$/i.test(name) && entry.uncompressedSize > 0 && entry.uncompressedSize <= MAX_PREVIEW_BYTES;
  });
  return images.find((entry) => /(^|\/)thumbnail\.png$/i.test(entry.fileName))
    || images.sort((left, right) => right.uncompressedSize - left.uncompressedSize)[0]
    || null;
}

function openArchive(source) {
  return new Promise((resolve, reject) => {
    yauzl.open(source, { lazyEntries: true, autoClose: false, validateEntrySizes: true }, (error, archive) => error ? reject(error) : resolve(archive));
  });
}

function readEntries(archive) {
  return new Promise((resolve, reject) => {
    const entries = [];
    let settled = false;
    const fail = (error) => { if (settled) return; settled = true; archive.close(); reject(error); };
    archive.once('error', fail);
    archive.on('entry', (entry) => {
      if (settled) return;
      if (entries.length >= MAX_ARCHIVE_ENTRIES) return fail(new Error('SNAGX archive contains too many entries'));
      entries.push(entry);
      archive.readEntry();
    });
    archive.once('end', () => { if (settled) return; settled = true; archive.removeListener('error', fail); resolve(entries); });
    archive.readEntry();
  });
}

function openEntryStream(archive, entry) {
  return new Promise((resolve, reject) => {
    archive.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream));
  });
}

async function extractSnagxPreview(source, targetBase) {
  const archive = await openArchive(source);
  let temporaryPath = null;
  try {
    const entry = selectSnagxImageEntry(await readEntries(archive));
    if (!entry) return null;
    if (entry.generalPurposeBitFlag & 0x1) throw new Error('Encrypted SNAGX previews are not supported');
    const extension = path.extname(entry.fileName).toLowerCase() === '.jpeg' ? '.jpg' : path.extname(entry.fileName).toLowerCase();
    const target = `${targetBase}${extension}`;
    temporaryPath = `${target}.${process.pid}.${Date.now()}.partial`;
    await fs.mkdir(path.dirname(target), { recursive: true });
    const stream = await openEntryStream(archive, entry);
    await pipeline(stream, require('node:fs').createWriteStream(temporaryPath, { flags: 'wx' }));
    const stat = await fs.stat(temporaryPath);
    if (!stat.size || stat.size > MAX_PREVIEW_BYTES) throw new Error('SNAGX preview exceeds the safe extraction limit');
    await fs.rm(target, { force: true });
    await fs.rename(temporaryPath, target);
    temporaryPath = null;
    return { target, entryName: entry.fileName, size: stat.size };
  } finally {
    archive.close();
    if (temporaryPath) await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

module.exports = { extractSnagxPreview, selectSnagxImageEntry };
