const test = require('node:test');
const assert = require('node:assert/strict');
const { createRenameSession } = require('../src/rename-session');

test('rename session remains bound to the initiating asset when selection changes', () => {
  const session = createRenameSession();
  let selectedId = 'image-a';
  session.begin(selectedId, 'A'); session.update('Renamed A'); selectedId = 'image-b';
  assert.deepEqual(session.snapshot(), { assetId: 'image-a', value: 'Renamed A' });
  assert.equal(selectedId, 'image-b');
});

test('cleared rename sessions cannot target another selected asset', () => {
  const session = createRenameSession(); session.begin('image-a', 'A'); session.update('Renamed A');
  assert.deepEqual(session.clear(), { assetId: 'image-a', value: 'Renamed A' });
  assert.equal(session.snapshot(), null);
});
