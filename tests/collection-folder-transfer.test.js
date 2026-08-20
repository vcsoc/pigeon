const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { planCollectionFolderTransfer, safeCollectionFolderName } = require('../electron/collection-folder-transfer');

test('plans a complete collection hierarchy and places files in their deepest matching folder', () => {
  const collections = [
    { id: 'root', name: 'Portfolio', parentId: null, order: 0 },
    { id: 'people', name: 'People', parentId: 'root', order: 0 },
    { id: 'family', name: 'Family', parentId: 'people', order: 0 },
    { id: 'places', name: 'Places', parentId: 'root', order: 1 },
    { id: 'empty', name: 'Empty', parentId: 'root', order: 2 }
  ];
  const assets = [
    { id: 'cover', collectionIds: ['root'] },
    { id: 'portrait', collectionIds: ['root', 'family'] },
    { id: 'landscape', collectionIds: ['places'] }
  ];
  const destination = path.resolve('C:/Pictures');
  const plan = planCollectionFolderTransfer({ collections, assets, rootId: 'root', destination });
  assert.equal(plan.collectionCount, 5);
  assert.equal(plan.directories.length, 5);
  assert.ok(plan.directories.includes(path.join(destination, 'Portfolio', 'Empty')));
  assert.equal(plan.files.find((item) => item.assetId === 'cover').directory, path.join(destination, 'Portfolio'));
  assert.equal(plan.files.find((item) => item.assetId === 'portrait').directory, path.join(destination, 'Portfolio', 'People', 'Family'));
  assert.equal(plan.files.find((item) => item.assetId === 'landscape').directory, path.join(destination, 'Portfolio', 'Places'));
  assert.equal(plan.ambiguous, 0);
});

test('reuses an existing same-named physical destination as the collection root', () => {
  const destination = path.resolve('C:/Pictures/Portfolio'), collections = [{ id: 'root', name: 'Portfolio', parentId: null }, { id: 'child', name: 'People', parentId: 'root' }], assets = [{ id: 'cover', collectionIds: ['root'] }, { id: 'portrait', collectionIds: ['child'] }];
  const plan = planCollectionFolderTransfer({ collections, assets, rootId: 'root', destination, reuseRoot: true });
  assert.equal(plan.rootDirectory, destination); assert.ok(plan.directories.includes(path.join(destination, 'People')));assert.equal(plan.files.find((item)=>item.assetId==='cover').directory,destination);assert.equal(plan.files.find((item)=>item.assetId==='portrait').directory,path.join(destination,'People'));
});

test('resolves sibling memberships deterministically and makes unsafe folder names collision-safe', () => {
  const collections = [
    { id: 'root', name: 'CON', parentId: null, order: 0 },
    { id: 'first', name: 'A:B', parentId: 'root', order: 0 },
    { id: 'second', name: 'A?B', parentId: 'root', order: 1 }
  ];
  const plan = planCollectionFolderTransfer({ collections, assets: [{ id: 'shared', collectionIds: ['second', 'first'] }], rootId: 'root', destination: path.resolve('D:/Target') });
  assert.equal(safeCollectionFolderName('CON'), '_CON');
  assert.equal(plan.ambiguous, 1);
  assert.equal(path.basename(plan.files[0].directory), 'A_B');
  assert.ok(plan.directories.some((directory) => path.basename(directory) === 'A_B (2)'));
});
