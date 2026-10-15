const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { fingerprint, fingerprintsMatch, contentFingerprint, contentFingerprintsMatch } = require('../electron/semantic-policy');
const main = fs.readFileSync(require.resolve('../electron/main.js'), 'utf8');
const renderer = fs.readFileSync(require.resolve('../src/renderer.js'), 'utf8');
const source = { id: 'a', path: '/photos/a.jpg', name: 'A', size: 42, modified: 1, tags: [] };

test('first hash and derivative cache paths do not invalidate semantic search matches', () => {
  const cached = { ...source, contentHash: 'first', thumbnailPath: '/cache/thumb.jpg', proxyPath: '/cache/proxy.jpg' };
  assert.equal(fingerprintsMatch(fingerprint(cached), fingerprint(source)), true);
  assert.equal(contentFingerprintsMatch(contentFingerprint(cached), contentFingerprint(source)), true);
  const legacy = JSON.stringify([source.path, source.size, source.modified, '', source.name, '', [], '', '']);
  assert.equal(fingerprintsMatch(fingerprint(cached), legacy), true);
  assert.equal(fingerprintsMatch(fingerprint({ ...cached, thumbnailPath: '/cache/new-thumb.jpg' }), fingerprint(cached)), true);
});

test('real source changes, edits, and semantic metadata still invalidate saved matches', () => {
  const cached = { ...source, contentHash: 'known' };
  for (const change of [{ path: '/photos/b.jpg' }, { size: 43 }, { modified: 2 }, { contentHash: 'different' }, { contentHash: '' }, { editedPath: '/edit.png' }, { editedAt: 2 }, { editedPreviewPath: '/edited-preview.png' }, { name: 'B' }, { note: 'new note' }, { tags: ['new'] }]) {
    assert.equal(fingerprintsMatch(fingerprint({ ...cached, ...change }), fingerprint(cached)), false, JSON.stringify(change));
  }
  for (const invalid of ['null', '{}', '[]', 'invalid']) assert.equal(fingerprintsMatch(fingerprint(source), invalid), false);
});

test('visibility changes rebuild folder metadata without a recursive directory request', async () => {
  const requests = [], cache = new Map([['root', { locationId: 'root', folders: [
    { path: 'parent', count: 7, directCount: 7, hasChildren: true },
    { path: 'parent/empty', count: 0, directCount: 0, hasChildren: false },
    { path: 'stale', count: 9, directCount: 9, hasChildren: false }
  ] }]]);
  let scheduled;
  const context = vm.createContext({
    state: { library: { activePortfolioId: 'p', locations: [{ id: 'root' }] } },
    clearTimeout() {}, setTimeout(fn) { scheduled = fn; }, folderTreeTimer: null,
    folderTreeGeneration: 0, folderTreeCachePortfolioId: 'p', folderTreeCache: cache,
    collapsedFolders: () => new Set(), renderSidebar() {},
    window: { pigeon: { async buildFolderTree(options) {
      requests.push(options);
      assert.equal(options.metadataOnly, true);
      return [{ locationId: 'root', folders: [
        { path: 'parent', count: 4, directCount: 4, hasChildren: false },
        { path: 'unlocked', count: 2, directCount: 2, hasChildren: false }
      ] }];
    }, logDiagnostic(...args) { throw Error(args.join(' ')); } } }
  });
  vm.runInContext(renderer.split('\n').find(line => line.startsWith('function scheduleFolderTreeBuild(')), context);
  vm.runInContext('scheduleFolderTreeBuild({metadataOnly:true})', context);
  await scheduled();
  assert.equal(requests.length, 1);
  const folders = new Map(cache.get('root').folders.map(folder => [folder.path, folder]));
  assert.equal(folders.get('parent').count, 4);
  assert.equal(folders.get('parent').hasChildren, true);
  assert.equal(folders.get('parent/empty').count, 0);
  assert.equal(folders.get('stale').count, 0);
  assert.equal(folders.get('unlocked').count, 2);
  for (const name of ['onSidebarChanged', 'onLibraryAssetsDeltaComplete']) {
    const handler = renderer.split('\n').find(line => line.startsWith(`window.pigeon.${name}(`));
    assert.match(handler, /scheduleFolderTreeBuild\(\{metadataOnly:true\}\)/);
    assert.doesNotMatch(handler, /scheduleFolderTreeBuild\(\)/);
  }
});

test('preview warming excludes locked, trashed, missing, pending, and offline assets before reporting work', async () => {
  let provider;
  const progress = [], scheduler = { setContext() {}, setIdleProvider(fn) { provider = fn; }, drain() {} };
  const assets = [source, { ...source, id: 'locked', locked: true }, { ...source, id: 'trash', deletedAt: 1 }, { ...source, id: 'missing', sourceMissing: true }, { ...source, id: 'pending', sourcePending: true }, { ...source, id: 'offline', locationId: 'offline' }];
  const context = vm.createContext({
    ensureThumbnailGenerationScheduler: () => scheduler, library: { assets, locations: [{ id: 'offline', online: false }] },
    activePortfolioId: 'p', libraryStreamGeneration: 1, isAssetLocked: asset => asset.locked,
    thumbnailWorkRequired: () => true, thumbnailWarmProgress: null,
    reportBackgroundProgress: (...args) => progress.push(args), reportThumbnailWarmJob() {}
  });
  vm.runInContext(main.slice(main.indexOf('async function warmThumbnailCache('), main.indexOf('\nasync function addLocations(')), context);
  await context.warmThumbnailCache();
  assert.equal(progress[0][1].total, 1);
  assert.equal(provider().id, source.id);
  assert.equal(provider(), null);
});

test('a preview job cannot read a source locked before dispatch or while awaiting CPU budget', async () => {
  const code = main.slice(main.indexOf('async function generateScheduledThumbnail('), main.indexOf('\nfunction reportThumbnailWarmJob('));
  for (const lockDuringWait of [false, true]) {
    const asset = { ...source, locked: !lockDuringWait };
    let reads = 0, generated = 0;
    const context = vm.createContext({
      mainAssetIndex: new Map([[asset.id, asset]]), isAssetLocked: item => item.locked,
      thumbnailWorkRequired: () => true, library: { assets: [asset], locations: [] },
      pathAvailable: async () => { reads++; return true; }, networkScanTimeout: () => 1,
      backgroundEpoch: 1, activePortfolioId: 'p',
      waitForIndexCpuBudget: async () => { asset.locked = true; return true; },
      performanceRecorder: { start() { generated++; throw Error('Locked source dispatched'); } }
    });
    vm.runInContext(code, context);
    await context.generateScheduledThumbnail({ id: source.id, version: 1 });
    assert.equal(reads, lockDuringWait ? 1 : 0);
    assert.equal(generated, 0);
  }
});
