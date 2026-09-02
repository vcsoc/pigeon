const fs = require('node:fs/promises');
const fileSystem = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { migrateLibrary } = require('../electron/library-core');
const { createLibraryStore } = require('../electron/database');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.ico', '.avif', '.tif', '.tiff', '.svg']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg']);
const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.woff', '.woff2']);
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.af', '.afdesign', '.afphoto', '.ai', '.psd', '.sketch', '.fig', '.eps', '.snagx']);

function id(value) { return crypto.createHash('sha1').update(value).digest('hex').slice(0, 16); }
function hashFile(filePath) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    const stream = fileSystem.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', () => resolve(null));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
function kind(extension) {
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (FONT_EXTENSIONS.has(extension)) return 'font';
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';
  return 'file';
}

async function collectFiles(root) {
  const files = [];
  const folders = [root];
  while (folders.length) {
    const folder = folders.shift();
    let entries = [];
    try { entries = await fs.readdir(folder, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(folder, entry.name);
      if (entry.isDirectory()) folders.push(fullPath);
      else if (entry.isFile()) files.push(fullPath);
    }
  }
  return files;
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  }));
  return results;
}

(async () => {
  const [target, ...roots] = process.argv.slice(2);
  if (!target || !roots.length) throw new Error('Usage: node rebuild-library.js <library.db> <folder> [...]');
  const library = migrateLibrary({ locations: [], assets: [], loading: false });
  for (const root of roots) {
    const resolvedRoot = path.resolve(root);
    const files = await collectFiles(resolvedRoot);
    const locationId = id(`location:${resolvedRoot.toLowerCase()}`);
    const assets = (await mapConcurrent(files, 8, async (filePath) => {
      try {
        const stat = await fs.stat(filePath);
        const extension = path.extname(filePath).toLowerCase();
        return {
          id: id(path.resolve(filePath).toLowerCase()), locationId, path: path.resolve(filePath),
          name: path.basename(filePath, extension), filename: path.basename(filePath),
          extension: extension.slice(1).toUpperCase() || 'FILE', kind: kind(extension), size: stat.size,
          created: stat.birthtimeMs, modified: stat.mtimeMs, indexedAt: Date.now(), tags: [], note: '',
          rating: 0, favorite: false, thumbnailPath: null, contentHash: await hashFile(filePath),
          collectionIds: [], annotations: [], deletedAt: null
        };
      } catch { return null; }
    })).filter(Boolean);
    library.locations.push({
      id: locationId, name: path.basename(resolvedRoot) || resolvedRoot, path: resolvedRoot, type: 'folder',
      removable: false, online: true, checking: false, scanning: false, assetCount: assets.length,
      addedAt: Date.now(), lastScanned: Date.now()
    });
    library.assets.push(...assets);
    console.log(`${resolvedRoot}: ${assets.length} references`);
  }
  const store = createLibraryStore(path.resolve(target));
  store.save(library); store.close();
  console.log(`Restored ${library.assets.length} references to SQLite database ${target}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
