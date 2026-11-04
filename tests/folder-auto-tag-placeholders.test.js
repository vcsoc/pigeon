const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const main = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer.js'), 'utf8');
const mainHelper = main.slice(main.indexOf('function expandFolderTags('), main.indexOf('function configuredFolderTags('));
const rendererHelper = renderer.slice(renderer.indexOf('function expandFolderAutoTags('), renderer.indexOf('function applyTagsToMatchingAssetsAsync('));
const expand = vm.runInNewContext(`${mainHelper}; expandFolderTags`, { path });
const expandRenderer = vm.runInNewContext(`${rendererHelper}; expandFolderAutoTags`);

test('folder placeholders resolve for each asset and preserve fixed tags', () => {
  const tags = ['fixed', '[[folder]]', '[[folder-0]]', '[[folder-1]]', '[[folder-2]]', 'trip-[[folder]]'];
  for (const file of ['/photos/2025/Trip/a.jpg', '/photos/2025/Trip/nested/b.jpg']) {
    const expected = file.includes('/nested/') ? ['fixed', 'nested', 'nested', 'Trip', '2025', 'trip-nested'] : ['fixed', 'Trip', 'Trip', '2025', 'photos', 'trip-Trip'];
    assert.deepEqual(Array.from(expand(tags, file)), expected);
    assert.deepEqual(Array.from(expandRenderer(tags, { path: file })), expected);
  }
});

test('unavailable ancestor skips its tag instead of producing a partial tag', () => {
  const tags = ['[[folder-1]]', 'prefix-[[folder-2]]', 'fixed'];
  assert.deepEqual(Array.from(expand(tags, '/photos/a.jpg')), ['fixed']);
  assert.deepEqual(Array.from(expandRenderer(tags, { path: '/photos/a.jpg' })), ['fixed']);
});

test('folder rules expand during indexing and existing asset application', () => {
  assert.match(main, /expandFolderTags\(rule\.tags \|\| \[\], filePath\)/);
  assert.match(main, /expandFolderTags\(normalizedTags,asset\.path\)/);
  assert.match(renderer, /tags,expandFolderAutoTags/);
});
