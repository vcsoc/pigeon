const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..'),main=fs.readFileSync(path.join(root,'electron','main.js'),'utf8'),renderer=fs.readFileSync(path.join(root,'src','renderer.js'),'utf8'),preload=fs.readFileSync(path.join(root,'electron','preload.js'),'utf8'),assetStream=fs.readFileSync(path.join(root,'src','asset-stream-state.js'),'utf8');

test('library shell and generation-safe asset transport are separate and delay-free',()=>{
  const summary=main.slice(main.indexOf('function publicLibrarySummary'),main.indexOf('function passwordKey'));
  const broadcast=main.slice(main.indexOf('function broadcast()'),main.indexOf('function broadcastLocations'));
  assert.doesNotMatch(summary,/assets\s*:/);assert.match(broadcast,/ASSET_STREAM_BATCH_SIZE/);assert.match(broadcast,/setImmediate\(sendNextBatch\)/);assert.doesNotMatch(broadcast,/visibleAssets=rendererVisibleAssets/);assert.match(main,/library:assets-consumed/);assert.match(main,/library:assets-complete/);assert.match(renderer,/assetStreamState\.applyChunk/);assert.match(renderer,/acknowledgeAssetBatchAfterFrame/);assert.match(renderer,/if\(!result\.accepted\)return/);assert.match(preload,/acknowledgeAssetBatch/);assert.match(preload,/onLibraryAssetsComplete/);
});

test('renderer keeps all assets while adapting the bounded virtual DOM window to the viewport',()=>{
  assert.match(renderer,/assetStreamState\.upsertMany\(assets\)/);assert.match(renderer,/PigeonVirtualLayout\.windowForScroll/);assert.match(renderer,/VIRTUAL_ASSET_WINDOW=120/);assert.match(renderer,/range\.count/);assert.match(renderer,/samePortfolio/);assert.match(renderer,/preservedScrollTop/);assert.doesNotMatch(renderer,/function loadMoreAssets/);assert.doesNotMatch(renderer,/Load more thumbnails/);
});

test('thumbnail work yields to interaction and patch bursts remain bounded',()=>{
  assert.match(main,/createThumbnailScheduler/);assert.match(main,/maxConcurrency:THUMBNAIL_WORKER_COUNT/);assert.match(renderer,/selected,visible,ahead,behind/);assert.match(main,/batch\.length>=250/);assert.match(main,/assetPatchTimer=setTimeout\(drain,16\)/);assert.match(renderer,/scroll-frame/);assert.match(renderer,/long-task/);assert.match(main,/rendererIpcReady=false/);assert.match(main,/if \(rendererIpcReady/);
});

test('normal persistence uses coalesced deltas and exposes structured timings',()=>{
  assert.match(main,/pendingAssetSaves=new Map/);assert.match(main,/upsert-assets/);assert.match(main,/save-library-metadata/);assert.match(main,/scheduleDeltaFlush/);assert.match(main,/serializationMs:metrics\.serializationMs/);assert.match(renderer,/filter-sort/);assert.match(renderer,/thumbnail-ready-to-paint/);
});

test('startup avoids repeated whole-library renderer work before first paint',()=>{
  const sidebar=renderer.slice(renderer.indexOf('function renderSidebar'),renderer.indexOf('let selectedTagNames'));
  const tags=renderer.slice(renderer.indexOf('function allExistingTags'),renderer.indexOf('function tagCatalog'));
  const stream=renderer.slice(renderer.indexOf('window.pigeon.onLibraryAssets('),renderer.indexOf('window.pigeon.onLibraryAssetsComplete'));
  assert.match(sidebar,/scheduleLibraryAggregateBuild/);assert.doesNotMatch(sidebar,/assets\.filter\(\(asset\).*matchesSavedFilters/);assert.match(tags,/scheduleLibraryAggregateBuild/);assert.match(renderer,/performance\.now\(\)-started<5/);assert.match(stream,/if\(firstUsable\)\{scheduleStreamGridRender/);assert.doesNotMatch(stream,/scheduleStreamGridRender\(firstUsable\)/);assert.match(main,/projectFolderTreeAssetsCooperatively/);assert.match(preload,/getAssetDetails/);
});

test('startup keeps the provisional grid behind the splash until the restored viewport is ready',()=>{
  const scheduler=renderer.slice(renderer.indexOf('function scheduleStreamGridRender'),renderer.indexOf('function acknowledgeAssetBatchAfterFrame'));
  const completion=renderer.slice(renderer.indexOf('window.pigeon.onLibraryAssetsComplete'),renderer.indexOf('function scheduleScanGridRender'));
  const reveal=renderer.slice(renderer.indexOf('function startupViewportHasPendingThumbnails'),renderer.indexOf('let streamRenderTimer'));
  assert.match(assetStream,/!firstUsable&&library\.assets\.length>0/);
  assert.doesNotMatch(scheduler,/restoreNavigationState/);
  assert.match(completion,/restoreNavigationState\(\);updateFilterChips\(\)/);
  assert.match(completion,/render\(\{preserveCards:true\}\);scheduleStartupViewportReveal\(\)/);
  assert.doesNotMatch(completion,/requestAnimationFrame\(finishStartupSplash\)/);
  assert.match(reveal,/state\.library\.assetStreamPending/);
  assert.match(reveal,/state\.navigationRestoredPortfolioId!==state\.library\.activePortfolioId/);
  assert.match(reveal,/querySelectorAll\('\.asset-card'\)/);
  assert.match(reveal,/pendingThumbnailCards\.has\(card\)\|\|activeThumbnailLoads\.has\(card\)/);
  assert.match(reveal,/STARTUP_VIEWPORT_READY_TIMEOUT_MS/);
});

test('startup avoids hidden tag DOM and unlocks stream only a yielded visibility delta',()=>{
  const suggestions=renderer.slice(renderer.indexOf('function renderTagSuggestions'),renderer.indexOf("$('#tag-autocomplete')"));
  const prewarm=renderer.slice(renderer.indexOf('function scheduleTagBrowserPrewarm'),renderer.indexOf('function selectTagRowWithEvent'));
  const delta=main.slice(main.indexOf('function broadcastUnlockVisibilityDelta'),main.indexOf('function broadcastLocations'));
  assert.doesNotMatch(suggestions,/tag-suggestions|<option/);
  assert.match(prewarm,/state\.view!=='tags'/);
  assert.match(delta,/examined<250/);assert.match(delta,/setTimeout\(step,additions\.length\?16:0\)/);assert.match(delta,/library:assets-delta-complete/);
  assert.match(main,/unlockedCollections\.set\(id, key\); broadcastUnlockVisibilityDelta\('collection-unlock'\)/);
  assert.match(main,/unlockedFolders\.set\(keyName,key\);broadcastUnlockVisibilityDelta\('folder-unlock'\)/);
  assert.match(preload,/onLibraryAssetsDelta/);assert.match(renderer,/onLibraryAssetsDelta/);assert.match(renderer,/visibilityDeltaPainted/);
});

test('renderer long tasks carry phase ownership and bounded live-card context',()=>{
  assert.match(renderer,/function measureRendererPhase/);assert.match(renderer,/owner=\[\.\.\.recentRendererPhases\]/);assert.match(renderer,/domCards:elements\.grid\.querySelectorAll/);assert.match(renderer,/MAX_THUMBNAIL_LOADS=4/);assert.match(renderer,/VIRTUAL_ASSET_WINDOW=120/);
});

test('large-folder preview and final render retain order, keyed cards, selection and scroll across every layout',()=>{
  const cooperative=fs.readFileSync(path.join(root,'src','cooperative-view.js'),'utf8');
  assert.match(cooperative,/const stablePreview=/);assert.doesNotMatch(cooperative,/matched>=previewLimit/);assert.match(cooperative,/onPreview\(stablePreview\(\)/);
  assert.match(renderer,/preserveCards:view\.previewPainted\|\|Boolean\(view\.preserveCards\)/);assert.match(renderer,/freshCard\.replaceWith\(existing\)/);assert.match(renderer,/gridScrollRestore\.commit/);assert.match(renderer,/noteDirectGridScrollInput/);assert.match(renderer,/state\.selectedIds\.has\(asset\.id\)/);assert.match(renderer,/layout-list/);assert.match(renderer,/layout-justified/);assert.match(renderer,/scheduleMasonry\(\)/);
});

test('virtual scrolling keeps a result-scoped exact extent and makes restoration user-cancellable',()=>{
  const virtualWindow=fs.readFileSync(path.join(root,'src','virtual-window.js'),'utf8'),styles=fs.readFileSync(path.join(root,'src','styles.css'),'utf8');
  assert.match(virtualWindow,/function layout/);assert.match(virtualWindow,/extentPx:totalRows\*rowHeight/);assert.match(virtualWindow,/function createScrollRestorer/);assert.match(virtualWindow,/pending\.interaction!==getInteraction\(\)/);assert.match(renderer,/state\.virtualExtentPx=virtualLayout\.extentPx/);assert.doesNotMatch(renderer,/state\.virtualExtentPx=Math\.max/);assert.doesNotMatch(renderer,/requiredExtent=/);assert.match(renderer,/viewport\.interaction!==gridScrollInteractionVersion/);assert.match(renderer,/interaction!==gridScrollInteractionVersion/);assert.match(styles,/\.asset-grid\.virtualized-grid/);assert.match(styles,/\.virtual-card-window/);
});

test('Smart Folder inheritance drives direct filtering, cooperative filtering, counts and read-only editor rules',()=>{
  const smartRules=fs.readFileSync(path.join(root,'src','smart-folder-rules.js'),'utf8'),libraryCore=fs.readFileSync(path.join(root,'electron','library-core.js'),'utf8'),html=fs.readFileSync(path.join(root,'src','index.html'),'utf8');
  assert.match(smartRules,/resolution\.chain\.every/);assert.match(libraryCore,/function matchesSmartFolder/);assert.match(libraryCore,/evaluateSmartFolder/);assert.match(renderer,/smartFilterChain\.every/);assert.match(renderer,/resolutions=new Map/);assert.match(renderer,/matchesSmartFolderResolution\(asset,resolutions\.get\(folder\.id\)\)/);assert.match(renderer,/renderInheritedSmartFolderRules/);assert.match(renderer,/Read-only inherited rules/);assert.match(html,/smart-folder-inherited-rules/);assert.match(renderer,/if\(smartFoldersChanged\).*invalidateSmartFolderCounts/);
});
