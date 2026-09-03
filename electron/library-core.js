const crypto = require('node:crypto');
const smartFolderRules = require('../src/smart-folder-rules');

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
  library.collections = library.collections.map((collection,index) => ({ id: collection.id || idFor('collection'), name: collection.name || 'Untitled', parentId: collection.parentId || null, createdAt: collection.createdAt || Date.now(), updatedAt:collection.updatedAt||collection.createdAt||Date.now(),order:Number.isFinite(collection.order)?collection.order:index, lock: collection.lock || null, icon: collection.icon || null }));
  library.smartFolders = library.smartFolders.map((folder,index) => ({ id: folder.id || idFor('smart-folder'), name: folder.name || 'Saved filter', parentId: folder.parentId || null, filters: folder.filters || {}, createdAt: folder.createdAt || Date.now(),updatedAt:folder.updatedAt||folder.createdAt||Date.now(),order:Number.isFinite(folder.order)?folder.order:index, icon: folder.icon || null }));
  library.assets = library.assets.map((asset) => ({
    ...asset,
    kind: String(asset.extension||'').toUpperCase()==='PNJ'?'image':asset.kind,
    tags: Array.isArray(asset.tags) ? [...new Set(asset.tags.filter(Boolean))] : [],
    collectionIds: Array.isArray(asset.collectionIds) ? [...new Set(asset.collectionIds)] : [],
    annotations: Array.isArray(asset.annotations) ? asset.annotations : [],
    deletedAt: asset.deletedAt || null,
    stackId: asset.stackId || null,
    favorite: Boolean(asset.favorite),
    quickChecked: Boolean(asset.quickChecked),
    rating: Math.max(0, Math.min(5, Number(asset.rating) || 0))
  }));
  return library;
}

function createCollection(library, name, parentId = null, requestedId = null) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Collection name is required');
  if (parentId && !library.collections.some((item) => item.id === parentId)) throw new Error('Parent collection does not exist');
  const duplicate = library.collections.some((item) => item.parentId === parentId && item.name.toLowerCase() === trimmed.toLowerCase());
  if (duplicate) throw new Error('A collection with that name already exists here');
  const suppliedId=String(requestedId||'');
  if(suppliedId&&(!/^[0-9a-f-]{16,64}$/i.test(suppliedId)||library.collections.some((item)=>item.id===suppliedId)))throw new Error('Invalid collection identifier');
  const now=Date.now(),siblings=library.collections.filter((item)=>item.parentId===parentId);const collection = { id: suppliedId||idFor('collection'), name: trimmed, parentId, createdAt:now,updatedAt:now,order:siblings.length, icon: null };
  library.collections.push(collection);
  return collection;
}

function renameCollection(library, id, name) {
  const collection = library.collections.find((item) => item.id === id);
  if (!collection) throw new Error('Collection does not exist');
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Collection name is required');
  if (library.collections.some((item) => item.id !== id && item.parentId === collection.parentId && item.name.toLowerCase() === trimmed.toLowerCase())) throw new Error('A collection with that name already exists here');
  collection.name = trimmed;collection.updatedAt=Date.now();
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
  collection.parentId = parentId;collection.updatedAt=Date.now();collection.order=library.collections.filter((item)=>item.parentId===parentId&&item.id!==id).length;
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
  if(parentId&&!smartFolderRules.resolve(library.smartFolders,parentId).valid)throw new Error('Parent smart folder hierarchy contains a cycle');
  if (library.smartFolders.some((item) => item.parentId === parentId && item.name.toLowerCase() === trimmed.toLowerCase())) throw new Error('A smart folder with that name already exists here');
  const now=Date.now(),siblings=library.smartFolders.filter((item)=>item.parentId===parentId);const folder = { id: idFor('smart-folder'), name: trimmed, parentId, filters: filters || {}, createdAt:now,updatedAt:now,order:siblings.length, icon: null };
  library.smartFolders.push(folder); return folder;
}
function renameSmartFolder(library, id, name) {
  const folder = library.smartFolders.find((item) => item.id === id), trimmed = String(name || '').trim();
  if (!folder) throw new Error('Smart folder does not exist');
  if (!trimmed) throw new Error('Smart folder name is required');
  if (library.smartFolders.some((item) => item.id !== id && item.parentId === folder.parentId && item.name.toLowerCase() === trimmed.toLowerCase())) throw new Error('A smart folder with that name already exists here');
  folder.name = trimmed;folder.updatedAt=Date.now(); return folder;
}
function moveSmartFolder(library, id, parentId = null) {
  const folder = library.smartFolders.find((item) => item.id === id);
  if (!folder) throw new Error('Smart folder does not exist');
  if (parentId && !library.smartFolders.some((item) => item.id === parentId)) throw new Error('Parent smart folder does not exist');
  if (id === parentId) throw new Error('A smart folder cannot contain itself');
  let cursor = parentId;const seen=new Set();while(cursor){if(cursor===id)throw new Error('A smart folder cannot move inside its descendant');if(seen.has(cursor))throw new Error('Parent smart folder hierarchy contains a cycle');seen.add(cursor);cursor=library.smartFolders.find((item)=>item.id===cursor)?.parentId||null;}
  folder.parentId = parentId;folder.updatedAt=Date.now();folder.order=library.smartFolders.filter((item)=>item.parentId===parentId&&item.id!==id).length; return folder;
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
    if (operation.clearCollections) asset.collectionIds = [];
    if (operation.clearTags) asset.tags = [];
    if (Object.hasOwn(operation, 'rating')) asset.rating = Math.max(0, Math.min(5, Number(operation.rating) || 0));
    if (operation.clearRating) asset.rating = 0;
    if (Object.hasOwn(operation, 'favorite')) asset.favorite = Boolean(operation.favorite);
    if (Object.hasOwn(operation, 'thumbnailEffect')) asset.thumbnailEffect = Boolean(operation.thumbnailEffect);
    if (Object.hasOwn(operation, 'rotation')) asset.rotation = ((Number(operation.rotation) || 0) % 360 + 360) % 360;
    else if (Object.hasOwn(operation, 'rotateBy')) asset.rotation = ((Number(asset.rotation || 0) + Number(operation.rotateBy || 0)) % 360 + 360) % 360;
    if (operation.geo && Number.isFinite(Number(operation.geo.lat)) && Number.isFinite(Number(operation.geo.lon))) asset.geo = { lat: Number(operation.geo.lat), lon: Number(operation.geo.lon), address: String(operation.geo.address || '').slice(0, 500), updatedAt: Date.now() };
    if (operation.clearGeo) asset.geo = null;
    if (Object.hasOwn(operation, 'note')) asset.note = String(operation.note || '').slice(0, 10000);
    if (operation.clearInfo) { asset.note = ''; asset.tags = []; asset.rating = 0; asset.favorite = false; asset.geo = null; asset.annotations = []; }
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
function similarImageGroups(assets, accuracy = 95, sourceId = null, options = {}) {
  const images = assets.filter((asset) => asset.kind === 'image' && !asset.deletedAt && !asset.locked), report = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  if (sourceId) { const source = images.find((asset) => asset.id === sourceId); if (!source) return []; const matches=[];for(let index=0;index<images.length;index+=1){const asset=images[index];if(asset.id!==source.id&&visualSimilarityScore(source,asset)>=accuracy)matches.push(asset);if(index%256===0)report(index+1,images.length);}report(images.length,images.length);matches.sort((a,b)=>visualSimilarityScore(source,b)-visualSimilarityScore(source,a));return matches.length?[[source,...matches]]:[]; }
  const parent=images.map((_,index)=>index),root=(index)=>{while(parent[index]!==index){parent[index]=parent[parent[index]];index=parent[index];}return index;},join=(first,second)=>{const a=root(first),b=root(second);if(a!==b)parent[b]=a;};
  const exactHashes=new Map(),maximumHashDistance=(()=>{let maximum=0;for(let distance=0;distance<=64;distance+=1)if(Math.round(100-distance/64*100)>=accuracy)maximum=distance;return maximum;})(),hashTrees=new Map(),useHashBands=maximumHashDistance<=8,hashBandBuckets=new Map(),hashBandAllBuckets=new Map(),hashBandCount=maximumHashDistance+1,ratioBinWidth=Math.max(.0001,-Math.log(1-Math.min(.999,(100-accuracy+.5)/180)));
  const hashBandParts=(hash)=>{const value=BigInt(`0x${hash}`),parts=[];let shift=0;for(let band=0;band<hashBandCount;band+=1){const size=Math.floor(64/hashBandCount)+(band<64%hashBandCount?1:0),mask=(1n<<BigInt(size))-1n;parts.push(`${band}:${(value>>BigInt(shift))&mask}`);shift+=size;}return parts;},ratioBin=(asset)=>asset.width&&asset.height?Math.floor(Math.log(asset.width/asset.height)/ratioBinWidth):null;
  const searchHash=(hash,index,visit)=>{if(useHashBands){const candidates=new Set(),bin=ratioBin(images[index]);for(const part of hashBandParts(hash)){if(bin===null){for(const candidate of hashBandAllBuckets.get(part)||[])candidates.add(candidate);continue;}for(const candidateBin of [bin-1,bin,bin+1])for(const candidate of hashBandBuckets.get(`${part}:${candidateBin}`)||[])candidates.add(candidate);}for(const candidate of candidates)if(hashDistance(hash,images[candidate].perceptualHash)<=maximumHashDistance)visit(candidate);return;}const bin=ratioBin(images[index]),trees=bin===null?[...hashTrees.values()]:[hashTrees.get(bin-1),hashTrees.get(bin),hashTrees.get(bin+1),hashTrees.get('*')].filter(Boolean);for(const tree of trees){if(!tree.root)continue;const pending=[tree.root];while(pending.length){const node=pending.pop(),distance=hashDistance(hash,node.hash);if(distance<=maximumHashDistance)visit(node.index);for(const[edge,child]of node.children)if(edge>=distance-maximumHashDistance&&edge<=distance+maximumHashDistance)pending.push(child);}}},insertHash=(hash,index)=>{if(useHashBands){const bin=ratioBin(images[index]);for(const part of hashBandParts(hash)){const key=`${part}:${bin===null?'*':bin}`;if(!hashBandBuckets.has(key))hashBandBuckets.set(key,[]);hashBandBuckets.get(key).push(index);if(!hashBandAllBuckets.has(part))hashBandAllBuckets.set(part,[]);hashBandAllBuckets.get(part).push(index);}return;}const bin=ratioBin(images[index]),treeKey=bin===null?'*':bin,tree=hashTrees.get(treeKey)||{root:null};hashTrees.set(treeKey,tree);const node={hash,index,children:new Map()};if(!tree.root){tree.root=node;return;}let current=tree.root;while(true){const distance=hashDistance(hash,current.hash);if(!current.children.has(distance)){current.children.set(distance,node);return;}current=current.children.get(distance);}};
  const withoutHashes=images.map((asset,index)=>/^[0-9a-f]{16}$/i.test(asset.perceptualHash||'')||!asset.dominantColor?null:index).filter((index)=>index!==null),workTotal=images.length+withoutHashes.length;
  for(let index=0;index<images.length;index+=1){const asset=images[index];if(asset.contentHash){if(exactHashes.has(asset.contentHash))join(index,exactHashes.get(asset.contentHash));else exactHashes.set(asset.contentHash,index);}if(/^[0-9a-f]{16}$/i.test(asset.perceptualHash||'')){searchHash(asset.perceptualHash,index,(candidate)=>{if(visualSimilarityScore(asset,images[candidate])>=accuracy)join(index,candidate);});insertHash(asset.perceptualHash,index);}if(index%128===0)report(index+1,workTotal);}
  for(let position=0;position<withoutHashes.length;position+=1){const index=withoutHashes[position];for(let candidate=0;candidate<images.length;candidate+=1)if(candidate!==index&&visualSimilarityScore(images[index],images[candidate])>=accuracy)join(index,candidate);if(position%8===0)report(images.length+position+1,workTotal);}
  report(workTotal,workTotal);const groups=new Map();images.forEach((asset,index)=>{const key=root(index);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(asset);});return[...groups.values()].filter((group)=>group.length>1).sort((a,b)=>b.length-a.length);
}

function matchesRule(asset, rule) {
  const values = rule.field === 'tags' ? asset.tags || [] : rule.field === 'collection' ? asset.collectionIds || [] : [rule.field === 'name' ? asset.filename || asset.name : rule.field === 'type' ? asset.kind : rule.field === 'folder' ? asset.path : rule.field === 'rating' ? Number(asset.rating) || 0 : rule.field === 'favorite' ? String(Boolean(asset.favorite)) : rule.field === 'privacyEffect' ? String(Boolean(asset.thumbnailEffect)) : ''];
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

function matchesSmartFolder(library,smartFolderOrId,asset){return smartFolderRules.matches(asset,library.smartFolders,smartFolderOrId,matchesFilters);}
function evaluateSmartFolder(library, smartFolder) { return library.assets.filter((asset)=>matchesSmartFolder(library,smartFolder,asset)); }

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

function replaceTags(library, requestedTags, to) {
  const sources = new Set((Array.isArray(requestedTags) ? requestedTags : [requestedTags]).map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean));
  const requested = String(to || '').trim();
  if (!sources.size || !requested) throw new Error('Source tags and a replacement tag are required');
  const existing = library.assets.flatMap((asset) => asset.tags || []).find((tag) => tag.toLowerCase() === requested.toLowerCase());
  const replacement = existing || requested, assets = [];
  const merge = (tags) => { const merged = []; for (const tag of tags || []) { const value = sources.has(String(tag).toLowerCase()) ? replacement : tag; if (!merged.some((item) => item.toLowerCase() === String(value).toLowerCase())) merged.push(value); } return merged; };
  for (const asset of library.assets) { const current = asset.tags || []; if (!current.some((tag) => sources.has(String(tag).toLowerCase()))) continue; const next = merge(current); if (JSON.stringify(next) !== JSON.stringify(current)) { asset.tags = next; assets.push(asset); } }
  for (const rules of [library.settings?.folderAutoTags, library.settings?.collectionAutoTags]) for (const rule of Object.values(rules || {})) rule.tags = merge(rule.tags);
  return { replacement, replacedTags: [...sources], updatedAssets: assets.length, assets };
}

function deleteTags(library, requestedTags) {
  const targets = new Set((Array.isArray(requestedTags) ? requestedTags : [requestedTags]).map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean)), assets = [];
  for (const asset of library.assets) { const current = asset.tags || [], remaining = current.filter((tag) => !targets.has(tag.toLowerCase())); if (remaining.length !== current.length) { asset.tags = remaining; assets.push(asset); } }
  for (const rules of [library.settings?.folderAutoTags, library.settings?.collectionAutoTags]) for (const rule of Object.values(rules || {})) rule.tags = (rule.tags || []).filter((tag) => !targets.has(String(tag).toLowerCase()));
  return { deletedTags: [...targets], updatedAssets: assets.length, assets };
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

module.exports = { SCHEMA_VERSION, DEFAULT_LIBRARY, migrateLibrary, createCollection, renameCollection, moveCollection, removeCollection, createSmartFolder, renameSmartFolder, moveSmartFolder, removeSmartFolder, batchUpdateAssets, stackAssets, unstackAssets, exactDuplicateGroups, similarAssets, visualSimilarityScore, similarImageGroups, matchesFilters, matchesSmartFolder, evaluateSmartFolder, renameTag, replaceTags, deleteTags, suggestTags, serializeLibrary, colorDistance, hashDistance, idFor };
