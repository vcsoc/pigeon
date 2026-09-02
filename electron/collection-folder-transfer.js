const path = require('node:path');

function safeCollectionFolderName(value, fallback = 'Collection') {
  let cleaned = String(value || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim().slice(0, 120);
  if (!cleaned) cleaned = fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(cleaned)) cleaned = `_${cleaned}`;
  return cleaned;
}

function uniqueSiblingSegment(name, used) {
  const base = safeCollectionFolderName(name), key = base.toLowerCase();
  if (!used.has(key)) { used.add(key); return base; }
  let suffix = 2, candidate;
  do { candidate = `${base} (${suffix++})`; } while (used.has(candidate.toLowerCase()));
  used.add(candidate.toLowerCase());
  return candidate;
}

function planCollectionFolderTransfer({ collections = [], assets = [], rootId, destination, reuseRoot = false }) {
  const byId = new Map(collections.map((collection) => [collection.id, collection])), root = byId.get(rootId);
  if (!root) throw new Error('Collection does not exist');
  const children = new Map();
  for (const collection of collections) {
    const parentId = collection.parentId || null;
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(collection);
  }
  const compare = (first, second) => (Number(first.order) || 0) - (Number(second.order) || 0) || String(first.name).localeCompare(String(second.name));
  const relativeParts = new Map(), depth = new Map(), traversalOrder = new Map(), orderedCollections = [];
  const visit = (collection, parentParts = [], isRoot = false) => {
    const siblings = (children.get(collection.parentId || null) || []).slice().sort(compare), used = new Set();
    let segment = isRoot ? safeCollectionFolderName(collection.name) : null;
    if (!isRoot) for (const sibling of siblings) {
      const candidate = uniqueSiblingSegment(sibling.name, used);
      if (sibling.id === collection.id) segment = candidate;
    }
    segment = segment || safeCollectionFolderName(collection.name);
    const parts = [...parentParts, segment];
    relativeParts.set(collection.id, parts); depth.set(collection.id, parts.length); traversalOrder.set(collection.id, orderedCollections.length); orderedCollections.push(collection);
    for (const child of (children.get(collection.id) || []).slice().sort(compare)) visit(child, parts);
  };
  if (reuseRoot) {
    relativeParts.set(root.id, []); depth.set(root.id, 0); traversalOrder.set(root.id, orderedCollections.length); orderedCollections.push(root);
    for (const child of (children.get(root.id) || []).slice().sort(compare)) visit(child, []);
  } else visit(root, [], true);
  const subtreeIds = new Set(orderedCollections.map((collection) => collection.id));
  const isAncestor = (ancestorId, descendantId) => { let cursor = byId.get(descendantId); while (cursor?.parentId) { if (cursor.parentId === ancestorId) return true; cursor = byId.get(cursor.parentId); } return false; };
  let ambiguous = 0;
  const files = [];
  for (const asset of assets) {
    const assigned = [...new Set(asset.collectionIds || [])].filter((id) => subtreeIds.has(id));
    if (!assigned.length) continue;
    assigned.sort((first, second) => (depth.get(second) || 0) - (depth.get(first) || 0) || (traversalOrder.get(first) || 0) - (traversalOrder.get(second) || 0));
    const chosenId = assigned[0];
    if (assigned.slice(1).some((id) => !isAncestor(id, chosenId) && !isAncestor(chosenId, id))) ambiguous += 1;
    files.push({ assetId: asset.id, collectionId: chosenId, directory: path.join(destination, ...relativeParts.get(chosenId)) });
  }
  return {
    rootDirectory: path.join(destination, ...relativeParts.get(root.id)),
    directories: orderedCollections.map((collection) => path.join(destination, ...relativeParts.get(collection.id))),
    files,
    ambiguous,
    collectionCount: orderedCollections.length
  };
}

module.exports = { planCollectionFolderTransfer, safeCollectionFolderName };
