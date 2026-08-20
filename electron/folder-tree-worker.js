const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const collapsed = new Set(workerData.collapsedKeys || []), assetsByLocation = new Map(), locations = (workerData.locations || []).map((location) => ({ ...location, normalizedPath: String(location.path || '').replace(/\\/g, '/').replace(/\/$/, '') }));
for (const asset of workerData.assets || []) { const list = assetsByLocation.get(asset.locationId) || []; list.push(asset); assetsByLocation.set(asset.locationId, list); }
function discoverPhysicalFolders(location, folders, isExcluded) {
  const pending = [{ absolute: path.resolve(location.path), parts: [] }];
  while (pending.length) {
    const current = pending.pop();
    let entries;
    try { entries = fs.readdirSync(current.absolute, { withFileTypes: true }); }
    catch { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const parts = [...current.parts, entry.name], folderPath = parts.join('/');
      if (isExcluded(folderPath)) continue;
      if (!folders.has(folderPath)) folders.set(folderPath, { name: entry.name, path: folderPath, depth: parts.length - 1, count: 0, directCount: 0 });
      pending.push({ absolute: path.join(current.absolute, entry.name), parts });
    }
  }
}
const result = locations.map((location) => {
  const root = location.normalizedPath, rootLower = root.toLowerCase(), excludedRoots = locations.filter((other) => other.id !== location.id && other.type !== 'file' && other.normalizedPath.toLowerCase().startsWith(`${rootLower}/`)).map((other) => other.normalizedPath.slice(root.length + 1).toLowerCase()), isExcluded = (relative) => excludedRoots.some((excluded) => relative.toLowerCase() === excluded || relative.toLowerCase().startsWith(`${excluded}/`)), folders = new Map();
  discoverPhysicalFolders(location, folders, isExcluded);
  for (const sourceAsset of assetsByLocation.get(location.id) || []) { const source = String(sourceAsset.path || '').replace(/\\/g, '/'); if (!source.toLowerCase().startsWith(`${root}/`.toLowerCase())) continue; const relativeSource = source.slice(root.length + 1); if (isExcluded(relativeSource)) continue; const parts = relativeSource.split('/').slice(0, -1); for (let depth = 0; depth < parts.length; depth += 1) { const folderPath = parts.slice(0, depth + 1).join('/'), current = folders.get(folderPath) || { name: parts[depth], path: folderPath, depth, count: 0, directCount: 0, createdAt: sourceAsset.created || sourceAsset.indexedAt || 0, updatedAt: sourceAsset.modified || 0 }; current.count += 1; current.createdAt = Math.max(current.createdAt || 0, sourceAsset.created || sourceAsset.indexedAt || 0); current.updatedAt = Math.max(current.updatedAt || 0, sourceAsset.modified || 0); if (depth === parts.length - 1) current.directCount += 1; folders.set(folderPath, current); } }
  for (const emptyValue of workerData.emptyFolders?.[location.id] || []) { const source = String(emptyValue || '').replace(/\\/g, '/'); if (!source.toLowerCase().startsWith(`${root}/`.toLowerCase())) continue; const relativeSource = source.slice(root.length + 1); if (isExcluded(relativeSource)) continue; const parts = relativeSource.split('/').filter(Boolean); for (let depth = 0; depth < parts.length; depth += 1) { const folderPath = parts.slice(0, depth + 1).join('/'); if (!folders.has(folderPath)) folders.set(folderPath, { name: parts[depth], path: folderPath, depth, count: 0, directCount: 0 }); } }
  const sorted = [...folders.values()].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' })), visible = collapsed.has(`location:${location.id}`) ? [] : sorted.filter((folder) => { const parts = folder.path.split('/'); return !parts.slice(0, -1).some((_, index) => collapsed.has(`subfolder:${location.id}:${parts.slice(0, index + 1).join('/').toLowerCase()}`)); }).map((folder) => ({ ...folder, hasChildren: sorted.some((item) => item.path.startsWith(`${folder.path}/`)) }));
  return { locationId: location.id, folders: visible.slice(0, Math.max(100, workerData.limits?.[location.id] || 300)), visibleFolders: visible.length, totalFolders: sorted.length };
});
parentPort.postMessage(result);
