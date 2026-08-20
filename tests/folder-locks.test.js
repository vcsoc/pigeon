const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { isPathInside, matchingFolderLockRules } = require('../electron/folder-locks');

const root = path.resolve('C:/Pigeon Library');
const nested = path.join(root, 'Protected', 'Nested Root');
const locations = [
  { id: 'parent', type: 'folder', path: root },
  { id: 'nested', type: 'folder', path: nested },
  { id: 'virtual', type: 'file', path: path.join(root, 'Protected') }
];
const rules = [{ locationId: 'parent', subfolder: 'protected' }];

test('folder locks follow the physical path even when a nested indexed root owns the asset', () => {
  const asset = { locationId: 'nested', path: path.join(nested, 'image.jpg') };
  assert.deepEqual(matchingFolderLockRules(asset, rules, locations), rules);
});

test('folder locks include descendants but not similarly prefixed siblings', () => {
  assert.equal(isPathInside(path.join(root, 'Protected'), path.join(root, 'Protected', 'video.mp4')), true);
  assert.equal(isPathInside(path.join(root, 'Protected'), path.join(root, 'Protected Other', 'video.mp4')), false);
  assert.equal(matchingFolderLockRules({ locationId: 'parent', path: path.join(root, 'Outside', 'image.jpg') }, rules, locations).length, 0);
});

test('non-folder locations cannot establish physical folder protection', () => {
  const asset = { locationId: 'parent', path: path.join(root, 'Protected', 'image.jpg') };
  assert.equal(matchingFolderLockRules(asset, [{ locationId: 'virtual', subfolder: '' }], locations).length, 0);
});
