const crypto = require('node:crypto');

const SCHEMA_VERSION = 4;
const DEFAULT_LIBRARY = Object.freeze({
  version: SCHEMA_VERSION,
  locations: [],
  assets: [],
  collections: [],
  smartFolders: [],
  trash: [],
  settings: { syncFolder: null, autoTag: true, pluginPermissions: {} }
});

function idFor(prefix, value = `${Date.now()}:${Math.random()}`) {
  return crypto.createHash('sha1').update(`${prefix}:${value}`).digest('hex').slice(0, 16);
}

function migrateLibrary(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const library = {
    ...DEFAULT_LIBRARY,
    ...source,
    version: SCHEMA_VERSION,
    locations: Array.isArray(source.locations) ? source.locations : [],
    assets: Array.isArray(source.assets) ? source.assets : [],
    collections: Array.isArray(source.collections) ? source.collections : [],
    smartFolders: Array.isArray(source.smartFolders) ? source.smartFolders : [],
    trash: Array.isArray(source.trash) ? source.trash : [],
    settings: { ...DEFAULT_LIBRARY.settings, ...(source.settings || {}) }
  };
  library.collections = library.collections.map((collection) => ({ id: collection.id || idFor('collection'), name: collection.name || 'Untitled', parentId: collection.parentId || null, createdAt: collection.createdAt || Date.now(), lock: collection.lock || null, icon: collection.icon || null }));
  library.smartFolders = library.smartFolders.map((folder) => ({ id: folder.id || idFor('smart-folder'), name: folder.name || 'Saved filter', parentId: folder.parentId || null, filters: folder.filters || {}, createdAt: folder.createdAt || Date.now(), icon: folder.icon || null }));
  library.assets = library.assets.map((asset) => ({
    ...asset,
    tags: Array.isArray(asset.tags) ? [...new Set(asset.tags.filter(Boolean))] : [],
    collectionIds: Array.isArray(asset.collectionIds) ? [...new Set(asset.collectionIds)] : [],
    annotations: Array.isArray(asset.annotations) ? asset.annotations : [],
    deletedAt: asset.deletedAt || null,
    stackId: asset.stackId || null,
    favorite: Boolean(asset.favorite),
    rating: Math.max(0, Math.min(5, Number(asset.rating) || 0))
  }));
  return library;
}

function createCollection(library, name, parentId = null) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Collection name is required');
  if (parentId && !library.collections.some((item) => item.id === parentId)) throw new Error('Parent collection does not exist');
  const duplicate = library.collections.some((item) => item.parentId === parentId && item.name.toLowerCase() === trimmed.toLowerCase());
  if (duplicate) throw new Error('A collection with that name already exists here');
  const collection = { id: idFor('collection'), name: trimmed, parentId, createdAt: Date.now(), icon: null };
  library.collections.push(collection);
  return collection;
}

function renameCollection(library, id, name) {
  const collection = library.collections.find((item) => item.id === id);
  if (!collection) throw new Error('Collection does not exist');
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Collection name is required');
  if (library.collections.some((item) => item.id !== id && item.parentId === collection.parentId && item.name.toLowerCase() === trimmed.toLowerCase())) throw new Error('A collection with that name already exists here');
  collection.name = trimmed;
  return collection;
}

function moveCollection(library, id, parentId = null) {
  const collection = library.collections.find((item) => item.id === id);
  if (!collection) throw new Error('Collection does not exist');
  if (parentId && !library.collections.some((item) => item.id === parentId)) throw new Error('Parent collection does not exist');
  if (id === parentId) throw new Error('A collection cannot contain itself');
  let cursor = parentId;
  while (cursor) {
    if (cursor === id) throw new Error('A collection cannot move inside its descendant');
    cursor = library.collections.find((item) => item.id === cursor)?.parentId || null;
  }
  collection.parentId = parentId;
  return collection;
}

function removeCollection(library, id) {
  const descendants = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of library.collections) if (item.parentId && descendants.has(item.parentId) && !descendants.has(item.id)) { descendants.add(item.id); changed = true; }
  }
  library.collections = library.collections.filter((item) => !descendants.has(item.id));
  for (const asset of library.assets) asset.collectionIds = (asset.collectionIds || []).filter((collectionId) => !descendants.has(collectionId));
  return descendants.size;
}

function createSmartFolder(library, name, filters = {}, parentId = null) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Smart folder name is required');
  if (parentId && !library.smartFolders.some((item) => item.id === parentId)) throw new Error('Parent smart folder does not exist');
  if (library.smartFolders.some((item) => item.parentId === parentId && item.name.toLowerCase() === trimmed.toLowerCase())) throw new Error('A smart folder with that name already exists here');
  const folder = { id: idFor('smart-folder'), name: trimmed, parentId, filters: filters || {}, createdAt: Date.now(), icon: null };
  library.smartFolders.push(folder); return folder;
}
function renameSmartFolder(library, id, name) {
  const folder = library.smartFolders.find((item) => item.id === id), trimmed = String(name || '').trim();
  if (!folder) throw new Error('Smart folder does not exist');
  if (!trimmed) throw new Error('Smart folder name is required');
  if (library.smartFolders.some((item) => item.id !== id && item.parentId === folder.parentId && item.name.toLowerCase() === trimmed.toLowerCase())) throw new Error('A smart folder with that name already exists here');
  folder.name = trimmed; return folder;
}
function moveSmartFolder(library, id, parentId = null) {
  const folder = library.smartFolders.find((item) => item.id === id);
  if (!folder) throw new Error('Smart folder does not exist');
  if (parentId && !library.smartFolders.some((item) => item.id === parentId)) throw new Error('Parent smart folder does not exist');
  if (id === parentId) throw new Error('A smart folder cannot contain itself');
  let cursor = parentId; while (cursor) { if (cursor === id) throw new Error('A smart folder cannot move inside its descendant'); cursor = library.smartFolders.find((item) => item.id === cursor)?.parentId || null; }
  folder.parentId = parentId; return folder;
}
function removeSmartFolder(library, id) {
  const descendants = new Set([id]); let changed = true;
  while (changed) { changed = false; for (const item of library.smartFolders) if (item.parentId && descendants.has(item.parentId) && !descendants.has(item.id)) { descendants.add(item.id); changed = true; } }
  library.smartFolders = library.smartFolders.filter((item) => !descendants.has(item.id)); return descendants.size;
}

function batchUpdateAssets(library, ids, operation = {}) {
  const selected = new Set(ids || []);
  let updated = 0;
  for (const asset of library.assets) {
    if (!selected.has(asset.id)) continue;
    if (operation.addTags) asset.tags = [...new Set([...(asset.tags || []), ...operation.addTags.map(String).map((tag) => tag.trim()).filter(Boolean)])];
    if (operation.removeTags) asset.tags = (asset.tags || []).filter((tag) => !operation.removeTags.includes(tag));
    if (operation.collectionId) asset.collectionIds = [...new Set([...(asset.collectionIds || []), operation.collectionId])];
    if (operation.removeCollectionId) asset.collectionIds = (asset.collectionIds || []).filter((id) => id !== operation.removeCollectionId);
    if (Object.hasOwn(operation, 'rating')) asset.rating = Math.max(0, Math.min(5, Number(operation.rating) || 0));
    if (Object.hasOwn(operation, 'favorite')) asset.favorite = Boolean(operation.favorite);
    if (Object.hasOwn(operation, 'rotation')) asset.rotation = ((Number(operation.rotation) || 0) % 360 + 360) % 360;
    else if (Object.hasOwn(operation, 'rotateBy')) asset.rotation = ((Number(asset.rotation || 0) + Number(operation.rotateBy || 0)) % 360 + 360) % 360;
    if (operation.geo && Number.isFinite(Number(operation.geo.lat)) && Number.isFinite(Number(operation.geo.lon))) asset.geo = { lat: Number(operation.geo.lat), lon: Number(operation.geo.lon), address: String(operation.geo.address || '').slice(0, 500), updatedAt: Date.now() };
    if (operation.clearGeo) asset.geo = null;
    if (operation.trash) asset.deletedAt = asset.deletedAt || Date.now();
    if (operation.restore) asset.deletedAt = null;
    updated += 1;
  }
  return updated;
}

function colorDistance(first, second) {
  if (!/^#[0-9a-f]{6}$/i.test(first || '') || !/^#[0-9a-f]{6}$/i.test(second || '')) return Infinity;
  const channels = (value) => [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  const a = channels(first), b = channels(second);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function stackAssets(library, ids) {
  const selected = new Set(ids || []);
  if (selected.size < 2) throw new Error('Select at least two assets to create a stack');
  const stackId = idFor('stack');
  let count = 0;
  for (const asset of library.assets) if (selected.has(asset.id)) { asset.stackId = stackId; count += 1; }
  if (count < 2) throw new Error('At least two selected assets must exist');
  return { stackId, count };
}
function unstackAssets(library, ids) {
  const selected = new Set(ids || []);
  const stackIds = new Set(library.assets.filter((asset) => selected.has(asset.id) && asset.stackId).map((asset) => asset.stackId));
  let count = 0;
  for (const asset of library.assets) if (asset.stackId && (selected.has(asset.id) || stackIds.has(asset.stackId))) { asset.stackId = null; count += 1; }
  return count;
}

function exactDuplicateGroups(assets) {
  const groups = new Map();
  for (const asset of assets.filter((item) => !item.deletedAt)) {
    if (!asset.contentHash) continue;
    const key = `hash:${asset.contentHash}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(asset);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

function hashDistance(first, second) {
  if (!/^[0-9a-f]{16}$/i.test(first || '') || !/^[0-9a-f]{16}$/i.test(second || '')) return Infinity;
  let difference = BigInt(`0x${first}`) ^ BigInt(`0x${second}`), count = 0;
  while (difference) { count += Number(difference & 1n); difference >>= 1n; }
  return count;
}

function similarAssets(assets, reference, options = {}) {
  const colorThreshold = options.colorThreshold || 75;
  const ratioThreshold = options.ratioThreshold || 0.12;
  const referenceRatio = reference.width && reference.height ? reference.width / reference.height : null;
  return assets.filter((asset) => {
    if (asset.id === reference.id || asset.kind !== reference.kind || asset.deletedAt) return false;
    const ratio = asset.width && asset.height ? asset.width / asset.height : null;
    const shapeMatches = referenceRatio && ratio && Math.abs(referenceRatio - ratio) / referenceRatio <= ratioThreshold;
    const visualMatches = reference.perceptualHash && asset.perceptualHash
      ? hashDistance(reference.perceptualHash, asset.perceptualHash) <= (options.hashThreshold || 14)
      : colorDistance(reference.dominantColor, asset.dominantColor) <= colorThreshold;
    return shapeMatches && visualMatches;
  });
}

function visualSimilarityScore(first, second) {
  if (!first || !second || first.kind !== 'image' || second.kind !== 'image') return 0;
  if (first.contentHash && first.contentHash === second.contentHash) return 100;
  const firstRatio = first.width && first.height ? first.width / first.height : null, secondRatio = second.width && second.height ? second.width / second.height : null;
  const ratioScore = firstRatio && secondRatio ? Math.max(0, 100 - Math.abs(firstRatio - secondRatio) / Math.max(firstRatio, secondRatio) * 180) : 100;
  let visualScore = 0;
  if (first.perceptualHash && second.perceptualHash) visualScore = Math.max(0, 100 - hashDistance(first.perceptualHash, second.perceptualHash) / 64 * 100);
  else if (first.dominantColor && second.dominantColor) visualScore = Math.max(0, 100 - colorDistance(first.dominantColor, second.dominantColor) / 4.42);
  return Math.round(Math.min(ratioScore, visualScore));
}
function similarImageGroups(assets, accuracy = 78, sourceId = null) {
  const images = assets.filter((asset) => asset.kind === 'image' && !asset.deletedAt && !asset.locked);
  if (sourceId) { const source = images.find((asset) => asset.id === sourceId); if (!source) return []; const matches = images.filter((asset) => asset.id !== source.id && visualSimilarityScore(source, asset) >= accuracy).sort((a, b) => visualSimilarityScore(source, b) - visualSimilarityScore(source, a)); return matches.length ? [[source, ...matches]] : []; }
  const parent = images.map((_, index) => index), root = (index) => { while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index]; } return index; };
  for (let first = 0; first < images.length; first += 1) for (let second = first + 1; second < images.length; second += 1) if (visualSimilarityScore(images[first], images[second]) >= accuracy) { const a = root(first), b = root(second); if (a !== b) parent[b] = a; }
  const groups = new Map(); images.forEach((asset, index) => { const key = root(index); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(asset); });
  return [...groups.values()].filter((group) => group.length > 1).sort((a, b) => b.length - a.length);
}

function matchesRule(asset, rule) {
  const values = rule.field === 'tags' ? asset.tags || [] : rule.field === 'collection' ? asset.collectionIds || [] : [rule.field === 'name' ? asset.filename || asset.name : rule.field === 'type' ? asset.kind : rule.field === 'folder' ? asset.path : rule.field === 'rating' ? Number(asset.rating) || 0 : rule.field === 'favorite' ? String(Boolean(asset.favorite)) : ''];
  const expected = String(rule.value || '').toLowerCase(), operator = rule.operator || 'contains';
  if (operator === 'null') return values.length === 0 || values.every((value) => !String(value).trim()); if (operator === 'not-null') return values.some((value) => String(value).trim());
  if (rule.field === 'rating' && ['less-than','less-than-equal','greater-than','greater-than-equal'].includes(operator)) { const actual = Number(values[0]), target = Number(rule.value); if (!Number.isFinite(target)) return false; if (operator === 'less-than') return actual < target; if (operator === 'less-than-equal') return actual <= target; if (operator === 'greater-than') return actual > target; return actual >= target; }
  const tests = values.map((value) => { const actual = String(value).toLowerCase(); if (operator === 'equals') return actual === expected; if (operator === 'excludes') return !actual.includes(expected); if (operator === 'begins') return actual.startsWith(expected); if (operator === 'ends') return actual.endsWith(expected); if (operator === 'regex') { try { return new RegExp(rule.value, 'i').test(String(value)); } catch { return false; } } return actual.includes(expected); });
  return operator === 'excludes' ? tests.every(Boolean) : tests.some(Boolean);
}
function matchesFilters(asset, filters = {}) {
  if (filters.rules?.length) { const matches = filters.rules.map((rule) => matchesRule(asset, rule)); if (filters.ruleMatch === 'any' ? !matches.some(Boolean) : !matches.every(Boolean)) return false; }
  if (filters.extensions?.length && !filters.extensions.includes(String(asset.extension || '').toLowerCase())) return false;
  if (filters.ratings?.length && !filters.ratings.includes(asset.rating || 0)) return false;
  if (filters.tags?.length && !filters.tags.some((tag) => (asset.tags || []).includes(tag))) return false;
  if (filters.locationIds?.length && !filters.locationIds.includes(asset.locationId)) return false;
  if (filters.collectionIds?.length && !filters.collectionIds.some((id) => (asset.collectionIds || []).includes(id))) return false;
  if (filters.favorite === true && !asset.favorite) return false;
  if (filters.query && ![asset.filename, asset.path, asset.note, ...(asset.tags || [])].join(' ').toLowerCase().includes(filters.query.toLowerCase())) return false;
  return !asset.deletedAt;
}

function evaluateSmartFolder(library, smartFolder) {
  return library.assets.filter((asset) => matchesFilters(asset, smartFolder.filters));
}

function renameTag(library, from, to) {
  const source = String(from || '').trim(), requested = String(to || '').trim();
  if (!source || !requested) throw new Error('Both tag names are required');
  const existing = library.assets.flatMap((asset) => asset.tags || []).find((tag) => tag.toLowerCase() === requested.toLowerCase() && tag.toLowerCase() !== source.toLowerCase());
  const replacement = existing || requested;
  for (const asset of library.assets) {
    const merged = [];
    for (const tag of asset.tags || []) {
      const value = tag.toLowerCase() === source.toLowerCase() ? replacement : tag;
      if (!merged.some((item) => item.toLowerCase() === value.toLowerCase())) merged.push(value);
    }
    asset.tags = merged;
  }
  return replacement;
}

function suggestTags(asset) {
  const words = `${asset.name || ''} ${asset.filename || ''}`.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && word.length <= 24);
  const suggestions = new Set(words);
  if (asset.kind) suggestions.add(asset.kind);
  if (asset.width && asset.height) suggestions.add(asset.width > asset.height ? 'landscape' : asset.width < asset.height ? 'portrait' : 'square');
  if (asset.dominantColor) {
    const colorNames = [['dark', '#222222'], ['light', '#eeeeee'], ['red', '#d94747'], ['orange', '#e4933d'], ['yellow', '#e4c33c'], ['green', '#49a96f'], ['blue', '#417bd5'], ['purple', '#7855cb']];
    colorNames.sort((a, b) => colorDistance(asset.dominantColor, a[1]) - colorDistance(asset.dominantColor, b[1]));
    suggestions.add(colorNames[0][0]);
  }
  return [...suggestions].slice(0, 12);
}

function serializeLibrary(library) {
  return JSON.stringify(migrateLibrary(library), null, 2);
}

module.exports = { SCHEMA_VERSION, DEFAULT_LIBRARY, migrateLibrary, createCollection, renameCollection, moveCollection, removeCollection, createSmartFolder, renameSmartFolder, moveSmartFolder, removeSmartFolder, batchUpdateAssets, stackAssets, unstackAssets, exactDuplicateGroups, similarAssets, visualSimilarityScore, similarImageGroups, matchesFilters, evaluateSmartFolder, renameTag, suggestTags, serializeLibrary, colorDistance, hashDistance, idFor };
