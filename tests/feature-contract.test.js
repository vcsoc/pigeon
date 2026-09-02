const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'electron', 'preload.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');
const mediaStream = fs.readFileSync(path.join(root,'electron','media-stream.js'),'utf8');
const pigeonCollection = fs.readFileSync(path.join(root,'electron','pigeon-collection.js'),'utf8');
const pluginManager = fs.readFileSync(path.join(root, 'electron', 'plugin-manager.js'), 'utf8');
const libraryCore = fs.readFileSync(path.join(root, 'electron', 'library-core.js'), 'utf8');
const core = libraryCore;
const thumbnailWorker = fs.readFileSync(path.join(root, 'electron', 'thumbnail-worker.js'), 'utf8');
const heicPreview = fs.readFileSync(path.join(root, 'electron', 'heic-preview.js'), 'utf8');
const textDocumentPreview = fs.readFileSync(path.join(root,'electron','text-document-preview.js'),'utf8');
const cooperativeView=fs.readFileSync(path.join(root,'src','cooperative-view.js'),'utf8');
const folderTreeWorker = fs.readFileSync(path.join(root, 'electron', 'folder-tree-worker.js'), 'utf8');
const database = fs.readFileSync(path.join(root, 'electron', 'database.js'), 'utf8');
const assetTransport = fs.readFileSync(path.join(root, 'electron', 'asset-transport.js'), 'utf8');
const assetStreamState = fs.readFileSync(path.join(root,'src','asset-stream-state.js'),'utf8');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const worldLand = fs.readFileSync(path.join(root, 'src', 'world-land.js'), 'utf8');
const icons = fs.readFileSync(path.join(root, 'src', 'icons.js'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
const systemResources = fs.readFileSync(path.join(root, 'electron', 'system-resources.js'), 'utf8');
const youtubeImport = fs.readFileSync(path.join(root, 'electron', 'youtube-import.js'), 'utf8');
const ytDlpImport = fs.readFileSync(path.join(root, 'electron', 'yt-dlp-import.js'), 'utf8');
const affinityPreview = fs.readFileSync(path.join(root, 'electron', 'affinity-preview.js'), 'utf8');
const snagxPreview = fs.readFileSync(path.join(root, 'electron', 'snagx-preview.js'), 'utf8');
const lightroomPreview=fs.readFileSync(path.join(root,'electron','lightroom-preview.js'),'utf8');
const imageDerivative=fs.readFileSync(path.join(root,'electron','image-derivative.js'),'utf8');
const assetIndexesSource=fs.readFileSync(path.join(root,'src','asset-indexes.js'),'utf8');
const fileTypesSource = fs.readFileSync(path.join(root, 'electron', 'file-types.js'), 'utf8');

test('UI exposes collection, smart-folder, batch, trash, media, metadata and editing surfaces', () => {
  for (const id of ['collection-list', 'smart-folder-list', 'batch-bar', 'duplicates-count', 'trash-count', 'inspector-video', 'inspector-audio', 'sidebar-resizer', 'inspector-resizer', 'batch-stack', 'batch-unstack', 'settings-dialog', 'text-entry-dialog', 'smart-folder-dialog', 'smart-folder-name', 'smart-folder-rules', 'favorite-shortcut', 'portfolio-switcher', 'portfolio-switcher-search', 'portfolio-switcher-list', 'portfolio-select', 'switch-portfolio', 'new-portfolio', 'rename-portfolio', 'delete-portfolio', 'encrypt-locked-folders', 'confirm-folder-moves', 'rotate-left', 'rotate-right', 'tag-suggestions', 'tag-autocomplete', 'tag-assignment-dialog', 'batch-tag-input', 'viewer-crop-overlay', 'map-view', 'location-map', 'map-search-input', 'map-globe-mode', 'map-street-mode', 'map-save', 'location-shortcut', 'duplicate-controls', 'duplicate-similarity', 'show-all-duplicate-groups', 'thumbnail-title-line-1', 'thumbnail-title-line-2', 'thumbnail-title-line-3', 'tag-browser', 'media-viewer', 'viewer-video', 'asset-histogram', 'annotation-view']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing ${id}`);
  }
});

test('large grids delegate card interactions and batch visibility registration',()=>{
  assert.match(renderer,/elements\.grid\.addEventListener\('pointerdown'/);assert.match(renderer,/preserveDragSelection/);assert.match(renderer,/elements\.grid\.addEventListener\('click'/);assert.match(renderer,/elements\.grid\.addEventListener\('dragstart'/);assert.match(renderer,/elements\.grid\.addEventListener\('pointerover'/);assert.match(renderer,/requestIdleCallback/);assert.match(renderer,/count<1200/);assert.match(renderer,/gridAssetForCard/);assert.match(styles,/content-visibility:auto/);assert.doesNotMatch(renderer,/\$\$\('\.asset-card'\)\.forEach\(\(card\) => \{[\s\S]*card\.addEventListener\('click'/);
});

test('every Smart Folder asset receives a placeholder and thumbnails load safely after scroll settles',()=>{
  assert.match(renderer,/criteria\.smartFolderId\|\|criteria\.view==='duplicates'/);assert.match(renderer,/assets=assetView\.assets/);assert.match(renderer,/MAX_THUMBNAIL_LOADS=4/);assert.match(renderer,/thumbnailScrollUntil=Date\.now\(\)\+320/);assert.match(renderer,/const image=new Image\(\)/);assert.match(renderer,/queueMicrotask\(drainThumbnailLoads\)/);assert.match(renderer,/preview\.appendChild\(image\)/);assert.match(renderer,/image\.alt=''/);assert.match(renderer,/THUMBNAIL_READ_AHEAD_PX=1200/);assert.match(renderer,/THUMBNAIL_READ_BEHIND_PX=600/);assert.match(renderer,/queueThumbnailCardsForViewport/);assert.match(renderer,/priority=distance===0\?0:ahead\?1:2/);assert.match(renderer,/thumbnailLoadsActive=Math\.max\(0,thumbnailLoadsActive-1\)/);assert.match(renderer,/attempts<3/);assert.match(renderer,/rootMargin:`\$\{THUMBNAIL_READ_AHEAD_PX\}px 0px`/);assert.match(renderer,/THUMBNAIL_LOAD_TIMEOUT_MS=8000/);assert.match(renderer,/activeThumbnailLoads=new Map/);assert.match(renderer,/scheduleThumbnailViewportSweep/);assert.match(renderer,/armThumbnailWatchdog/);assert.match(renderer,/showThumbnailLoadFailure/);assert.match(renderer,/Preview unavailable/);assert.doesNotMatch(renderer,/thumbnail-eager/);assert.match(main,/placeholders\.cards>120/);assert.match(main,/placeholders\.last!==`asset-\$\{placeholders\.total-1\}`/);
});

test('huge portfolio views cooperatively sort and keep an adaptive bounded virtual DOM window',()=>{
  assert.match(html,/cooperative-view\.js[\s\S]*virtual-layout-model\.js[\s\S]*renderer\.js/);assert.match(renderer,/COOPERATIVE_VIEW_THRESHOLD=1000,VIRTUAL_ASSET_WINDOW=120/);assert.match(renderer,/function currentAssetViewSnapshot/);assert.match(renderer,/scheduleAssetViewTask/);assert.match(renderer,/performance\.now\(\)-assetViewSliceStarted>=6/);assert.match(renderer,/PigeonVirtualLayout\.build/);assert.match(renderer,/state\.virtualStart=range\.start/);assert.match(renderer,/elements\.grid\.querySelectorAll\('\.asset-card'\)\.length===range\.count/);assert.match(renderer,/renderGrid\(\{preserveCards:true\}\)/);assert.match(renderer,/preservedCards\.get\(freshCard\.dataset\.assetId\)/);assert.match(renderer,/freshCard\.replaceWith\(existing\)/);assert.match(renderer,/windowForScroll/);assert.match(renderer,/gridScrollRestore\.commit\(\{ready:assetView\.ready\}\)/);assert.match(renderer,/class="virtual-card-window"/);assert.match(renderer,/state\.virtualExtentPx=virtualLayout\.extentPx/);assert.match(renderer,/selectAllVisibleAssetsCooperatively/);assert.match(styles,/\.virtual-card-window/);assert.match(styles,/overflow-anchor:none/);assert.match(cooperativeView,/filterChunk=512,runSize=2048,mergeChunk=1024/);
});

test('inspector folder paths, bidirectional read-ahead and compact thumbnail spacing are wired',()=>{
  assert.match(html,/id="meta-folder"/);assert.match(html,/id="copy-folder-path"/);assert.match(html,/id="meta-source-url"/);assert.match(html,/id="copy-source-url"/);assert.match(renderer,/metaFolder: \$\('#meta-folder'\)/);assert.match(renderer,/metaSourceUrl: \$\('#meta-source-url'\)/);assert.match(renderer,/asset\.sourceUrl/);assert.match(renderer,/Folder path copied/);assert.match(renderer,/Source URL copied/);assert.match(styles,/\.details-copy-field/);assert.match(renderer,/function assetFolderPath/);assert.match(renderer,/elements\.metaFolder\.textContent=folderPath/);assert.match(renderer,/function nextThumbnailCard/);assert.match(renderer,/thumbnailScrollDirection/);assert.match(renderer,/thumbnailScrollUntil=Date\.now\(\)\+320/);assert.match(styles,/padding: 6px; background: #191a1c/);assert.match(styles,/column-gap: 4px/);assert.match(styles,/\.asset-grid\.placeholder-grid\{grid-auto-rows:auto;row-gap:4px\}/);assert.match(styles,/border-radius: 5px; padding: 1px/);
});

test('media resource errors do not become fatal UI errors',()=>{
  assert.match(renderer,/if\(!\(event instanceof ErrorEvent\)\)return/);assert.match(renderer,/elements\.inspectorVideo\.addEventListener\('error'/);assert.match(renderer,/recoverInspectorVideo/);
});

test('all file types support location, complete EXIF inspection, and native cross-application drag handoff',()=>{
  assert.match(renderer,/const assetIds=\[\.\.\.new Set\(ids\|\|\[\]\)\]/);assert.match(renderer,/Select one or more files first/);assert.match(renderer,/<button data-context-action="copy-path"><span>Copy path<\/span><\/button>/);assert.match(renderer,/action==='copy-path'[^\n]*copyText\(asset\.path\)/);assert.match(renderer,/<button data-context-action="location">/);assert.match(html,/id="exif-metadata"/);assert.match(renderer,/function flattenedMetadata/);assert.match(renderer,/image\?flattenedMetadata\(asset\.exif\)/);assert.match(renderer,/addEventListener\('dragstart',[^\n]*nativeDrag=event\.altKey/);assert.match(renderer,/application\/x-pigeon-assets/);assert.match(renderer,/setDragImage\(ghost,36,36\)/);assert.match(renderer,/effectAllowed='copyMove'/);assert.match(styles,/\.asset-drag-ghost[^}]*opacity:\.28/);assert.match(preload,/startAssetDrag: \(ids\) => ipcRenderer\.invoke\('assets:start-drag', ids\)/);assert.match(main,/prepareCollisionSafeDragFiles/);assert.match(main,/nativeImage\.createFromPath/);assert.match(main,/toBitmap\(\)/);assert.match(main,/bitmap\[index\]\*\.34/);assert.match(main,/startDrag\(\{files,icon\}\)/);assert.match(renderer,/collision-safe rename/);
});

test('Snagit SNAGX files receive safe archive thumbnails and full image previews',()=>{
  assert.match(fileTypesSource,/design:[^\n]*'\.snagx'/);
  assert.match(main,/PREVIEWABLE_DOCUMENT_EXTENSIONS[^\n]*'SNAGX'/);
  assert.match(main,/extractSnagxPreview/);
  assert.match(main,/asset\.proxyPath=extracted\.target;asset\.proxyVersion=3/);
  assert.match(snagxPreview,/thumbnail\\\.png/);
  assert.match(snagxPreview,/MAX_PREVIEW_BYTES/);
  assert.match(renderer,/IMAGE_PREVIEW_DOCUMENT_EXTENSIONS=new Set\(\[[^\n]*'SNAGX'/);
  assert.match(renderer,/function isImagePreviewDocument/);
  assert.match(packageJson,/"yauzl": "3\.4\.0"/);
});

test('Affinity documents receive bounded embedded thumbnails and full image previews',()=>{
  for(const extension of ['.af','.afdesign','.afphoto'])assert.match(fileTypesSource,new RegExp(`design:[^\\n]*'\\${extension}'`));
  for(const extension of ['AF','AFDESIGN','AFPHOTO'])assert.match(main,new RegExp(`PREVIEWABLE_DOCUMENT_EXTENSIONS[^\\n]*'${extension}'`));
  assert.match(main,/extractAffinityPreview/);
  assert.match(main,/AFFINITY_PREVIEW_EXTENSIONS\.has\(asset\.extension\)/);
  assert.match(main,/format:'affinity'/);
  assert.match(affinityPreview,/readBigUInt64LE\(24\)/);
  assert.match(affinityPreview,/MAX_PREVIEW_BYTES/);
  assert.match(affinityPreview,/thumbnailHeader\.subarray\(4, 8\).*'Thmb'/);
  assert.match(renderer,/IMAGE_PREVIEW_DOCUMENT_EXTENSIONS=new Set\(\['PDF','AF','AFDESIGN','AFPHOTO','SNAGX','LRPREV'\]\)/);
  assert.match(renderer,/fullImagePreview=visual&&\(asset\.kind==='image'\|\|hasDocumentThumbnailPreview\(asset\)\)/);
  assert.match(styles,/-webkit-clip-path:polygon\(100% 0,100% 100%,0 100%\)/);
  assert.match(styles,/\.thumbnail-fit-preview \.ui-icon\{[^}]*display:block[^}]*stroke:currentColor/);
});

test('Lightroom catalog folders index catalogs, templates and embedded previews',()=>{
  for(const extension of ['.lrcat','.lrcat-data','.lrprev','.lrtemplate'])assert.match(fileTypesSource,new RegExp(`design:[^\\n]*'\\${extension}'`));assert.match(main,/PREVIEWABLE_DOCUMENT_EXTENSIONS[^\n]*'LRPREV'/);assert.match(main,/extractLightroomPreview/);assert.match(main,/format:'lightroom-preview'/);assert.match(renderer,/IMAGE_PREVIEW_DOCUMENT_EXTENSIONS[^\n]*'LRPREV'/);assert.match(lightroomPreview,/MAX_LIGHTROOM_PREVIEW_BYTES/);assert.match(lightroomPreview,/embeddedJpegCandidates/);assert.match(main,/if\(location&&location\.online!==true\)return/);assert.match(main,/!locations\.has\(asset\.locationId\)\|\|locations\.get\(asset\.locationId\)\?\.online===true/);assert.match(main,/INDEXING_POLICY_VERSION=2/);assert.match(main,/refreshChangedIndexingPolicy\(\)/);assert.match(main,/await persistScanBatch\(location,checkpointAssets\)/);assert.match(main,/proxyPath:asset\.proxyPath/);assert.match(renderer,/asset\.proxyPath=proxyPath\|\|asset\.proxyPath/);
});

test('text and PDF documents generate thumbnails and open in inspector, preview and viewer',()=>{
  for(const extension of ['TXT','MD','MARKDOWN','JSON','JSONC','YAML','YML'])assert.match(textDocumentPreview,new RegExp(`'${extension}'`));assert.match(fileTypesSource,/\.jsonc/);assert.match(main,/createTextDocumentThumbnail\(asset,target\)/);assert.match(main,/allowed=TEXT_PREVIEW_DOCUMENT_EXTENSIONS/);assert.match(main,/createThumbnailScheduler/);assert.match(main,/waitForIndexCpuBudget\(run\)/);assert.match(renderer,/function isTextPreviewDocument/);assert.match(renderer,/function hasDocumentThumbnailPreview/);assert.match(renderer,/text=isTextPreviewDocument\(asset\)/);assert.match(renderer,/String\(asset\.extension\)\.toUpperCase\(\)==='PDF' \? asset\.previewUrl/);
});

test('privacy shortcuts paint before persistence and do not animate behind key input',()=>{
  assert.match(renderer,/paintThumbnailEffectImmediately\(assets,enabled\);showToast/);assert.ok(renderer.indexOf('paintThumbnailEffectImmediately(assets,enabled);showToast')<renderer.indexOf('await window.pigeon.batchUpdateAssets(ids,{thumbnailEffect:enabled}'));assert.match(renderer,/requestAnimationFrame\(draw\)/);assert.match(styles,/\.privacy-effect-view :is\(img,video,iframe\)\{transition:none\}/);assert.match(styles,/thumbnail-effect-applied \.asset-preview>img[^}]*transition:none/);
});

test('targeted thumbnail rebuild, virtual full scroll, cover previews, metadata copy and native drag are wired',()=>{
  assert.match(renderer,/data-context-action="rebuild-thumbnails"/);assert.match(preload,/rebuildThumbnails/);assert.match(main,/assets:rebuild-thumbnails/);assert.match(renderer,/thumbnailVisibilityObserver/);assert.match(renderer,/currentAssetViewSnapshot/);assert.match(renderer,/VIRTUAL_ASSET_WINDOW=120/);assert.match(renderer,/virtual-card-window/);assert.match(cooperativeView,/filterChunk=512/);assert.match(cooperativeView,/mergeChunk=1024/);assert.match(html,/cooperative-view\.js/);assert.match(renderer,/state\.kind='all';state\.query=''/);assert.match(styles,/\.asset-preview img[^}]*object-fit:cover/);assert.match(html,/copy-additional-metadata/);assert.match(html,/copy-comfyui-metadata/);assert.match(renderer,/ComfyUI workflow copied/);assert.match(renderer,/window\.pigeon\.startAssetDrag/);assert.match(main,/sender\.startDrag/);
});

test('trash and auto-tag mutations reconcile cards without full thumbnail reloads',()=>{
  assert.match(renderer,/setAssetTrashWithoutGridRefresh[\s\S]*silent:true,returnAssets:true/);assert.match(renderer,/setAssetTrashWithoutGridRefresh[\s\S]*reconcileThumbnailCards\(unique\)/);assert.match(renderer,/action === 'trash'[^\n]*setAssetTrashWithoutGridRefresh/);assert.match(renderer,/#batch-trash[\s\S]*setAssetTrashWithoutGridRefresh/);assert.match(renderer,/deleteTrashItems[\s\S]*assetStreamState\.removeMany\(deletedIds\)/);assert.match(renderer,/deleteTrashItems[\s\S]*reconcileThumbnailCards\(deletedIds,\{viewport\}\)/);assert.doesNotMatch(main,/sendDatabaseRequest\('delete-assets',[^\n]*broadcast\(\)/);assert.match(renderer,/selectAndRevealSuccessor\(successorId\)/);assert.match(renderer,/currentSmartFolderDependsOnTags/);assert.match(renderer,/patchTagMetadataCards/);assert.match(renderer,/applyTagsToMatchingAssetsAsync/);assert.match(main,/applyTagsInBackground/);assert.match(main,/collection:set-auto-tags[\s\S]*broadcastSidebar/);assert.match(main,/folder:set-auto-tags[\s\S]*broadcastSidebar/);
});

test('Smart Folders filter privacy effects, hotkey is editable, and level sorting targets siblings',()=>{
  assert.match(renderer,/\['privacyEffect','Blur \/ Pixelate'\]/);assert.match(renderer,/Effect applied/);assert.match(libraryCore,/rule\.field === 'privacyEffect'/);assert.match(renderer,/wireShortcutInput\('#thumbnail-effect-shortcut'/);assert.match(html,/Click an input, then press the shortcut/);assert.match(renderer,/branch:collection\.parentId/);assert.match(renderer,/branch:folder\.parentId/);assert.match(renderer,/appendFolderLevel/);assert.match(renderer,/sidebarBranchSort/);
});

test('privacy ranges extend into previews/viewer, modifier wheel scrolls, submenu and parent trunks work',()=>{
  assert.match(renderer,/minimum=mode==='pixelate'\?6:8/);assert.match(renderer,/maximum=mode==='pixelate'\?60:40/);assert.match(html,/id="sidebar-order-submenu"/);assert.match(renderer,/privacy-effect-view/);assert.match(styles,/\.thumbnail-effect-reveal \.privacy-effect-view :is\(img,video,iframe\)/);assert.match(renderer,/event\.ctrlKey\|\|event\.shiftKey/);assert.match(renderer,/sidebar-order-submenu/);assert.match(styles,/location-subfolder-list::before/);assert.match(folderTreeWorker,/updatedAt/);
});

test('unfocused hover audio, complete menus, tree trunks, preference spacing and branch ordering are wired',()=>{
  assert.match(main,/GetAsyncKeyState/);assert.match(main,/startHoverControlMonitor/);assert.match(preload,/onHoverControl/);assert.match(renderer,/monitorHoverControl\(true\)/);assert.match(renderer,/asset-context-menu-expanded/);assert.match(styles,/overflow:visible/);assert.match(styles,/\.location-subfolder-list::before\{[^}]*left:13px/);assert.match(styles,/preferences-nav nav button[^}]*gap:9px/);assert.match(renderer,/showBranchOrderMenu/);assert.match(main,/sidebar:set-branch-sort/);assert.match(renderer,/created-desc/);
});

test('actions support topbar editing, reordered clearing/move/rename steps and larger fields',()=>{
  for(const step of ['clearCollections','clearTags','clearRating','moveFolder','autoRename'])assert.match(renderer,new RegExp(step));assert.match(renderer,/data-quick-edit/);assert.match(renderer,/wireShortcutStepReordering/);assert.match(renderer,/rename-pattern-suggestions/);assert.match(renderer,/created-date-time/);assert.match(styles,/font-size:calc\(13px \* var\(--app-font-scale\)\)/);assert.match(main,/assets:auto-rename/);assert.match(main,/assets:move-to-path/);assert.match(core,/operation\.clearCollections/);
});
test('SVG, Sketch and Lunacy files plus embedded workflow metadata and drag export are wired',()=>{
  assert.match(fileTypesSource,/\.svg/);assert.match(fileTypesSource,/\.sketch/);assert.match(fileTypesSource,/\.free/);assert.match(main,/extractZipPreview/);assert.match(thumbnailWorker,/pngTextMetadata/);assert.match(thumbnailWorker,/metadataOnly/);assert.match(main,/extractEmbeddedMetadata\(asset\)/);assert.match(main,/return\{embeddedMetadata:result\?\.embeddedMetadata\|\|null\}/);assert.doesNotMatch(main,/persistAssetBatch\(\[asset\]\).*embeddedMetadata/);assert.match(renderer,/embeddedMetadataCache\.size>8/);assert.match(database,/removePersistedEmbeddedMetadata/);assert.match(renderer,/comfy\.classList\.toggle\('hidden',!hasComfyWorkflow\)/);assert.match(html,/id="comfyui-metadata" class="additional-metadata comfyui-metadata/);assert.match(html,/showAdditionalMetadata/);assert.match(renderer,/nativeDrag=event\.altKey/);assert.match(styles,/\.folder-tree-toggle \{ width: 18px/);assert.match(renderer,/addEventListener\('dragenter',showCollectionDrop\)/);
});

test('privacy-affected motion previews and opened videos retain every privacy mode',()=>{
  assert.match(renderer,/protectedMotion=Boolean\(asset\.thumbnailEffect/);assert.match(renderer,/mediaViewer\.classList\.toggle\('privacy-effect-view',Boolean\(asset\.thumbnailEffect\)\)/);assert.match(renderer,/video\?elements\.inspectorVideo:elements\.inspectorImage/);assert.match(renderer,/renderViewerPrivacySurface\(asset\)/);assert.match(renderer,/requestVideoFrameCallback\(draw\)/);assert.match(styles,/privacy-effect-view :is\(img,video,iframe\)/);assert.match(renderer,/protectedMotion&&!state\.thumbnailEffectRevealPressed/);assert.match(renderer,/activeProtectedHoverReveals\.add\(syncProtectedReveal\)/);assert.match(renderer,/activeProtectedHoverReveals\.delete\(syncProtectedReveal\)/);assert.match(renderer,/for\(const syncReveal of \[\.\.\.activeProtectedHoverReveals\]\)syncReveal\(pressed,event\)/);assert.match(renderer,/syncProtectedReveal=\(pressed,event\)=>\{if\(!protectedMotion\)return;if\(!pressed\)\{stop\(\);return;\}/);assert.match(renderer,/thumbnailEffectRevealKey:'Alt'/);assert.match(renderer,/wireShortcutInput\('#thumbnail-effect-reveal-shortcut'/);
});

test('hovered video uses hold-Control or Alt sound and tree screenshots have terminal branches',()=>{
  assert.match(renderer,/temporaryShortcutPressed\(event,preferences\.hoverAudioShortcut\)/);assert.match(renderer,/media\.muted=!controlHeld/);assert.match(renderer,/window\.addEventListener\('keyup',keyUp,true\)/);assert.match(renderer,/window\.removeEventListener\('keydown',keyDown,true\)/);assert.match(renderer,/hoverAudioShortcut:'Ctrl'/);assert.match(html,/id="hover-audio-shortcut"/);assert.match(renderer,/String\(event\.key\|\|''\)/);assert.match(renderer,/rawKey\|\|activeModifier&&key/);
  assert.match(renderer,/tree-last/);assert.match(styles,/\.collection-item\.tree-last::after/);assert.match(main,/PIGEON_SMOKE_CAPTURE_TREE/);assert.match(main,/pigeon-tree-smoke\.png/);
});

test('polished tree, stable post-move reveal and configurable thumbnail privacy effects are wired',()=>{
  assert.match(styles,/isolation:isolate/);assert.match(styles,/linear-gradient\(90deg,color-mix/);assert.match(styles,/border-radius:0 0 0 5px/);assert.match(styles,/\.folder-tree-toggle \{[^}]*background:transparent[^}]*box-shadow:none/);
  assert.match(renderer,/postMoveRevealUntil=Date\.now\(\)\+900/);assert.match(renderer,/focusSelectedAsset\(\{lockScroll:true\}\)/);assert.match(renderer,/delays=lockScroll\?\[0,60,140,260,480\]/);assert.match(renderer,/interaction!==gridScrollInteractionVersion/);
  assert.match(html,/id="thumbnail-effect-shortcut"/);assert.match(html,/id="thumbnail-effect-strength"/);assert.match(html,/id="blur-effect-preview"/);assert.match(renderer,/function toggleThumbnailEffect/);assert.match(renderer,/thumbnailEffectRevealKey/);assert.match(html,/id="thumbnail-effect-reveal-shortcut"/);assert.match(renderer,/revealShortcutPressed/);assert.match(renderer,/thumbnail-effect-reveal/);assert.match(styles,/thumbnail-effect-applied/);assert.match(libraryCore,/thumbnailEffect/);assert.match(main,/'thumbnailEffect'/);
});

test('portfolio loading withholds locked assets and paints before authorized stream completion',()=>{
  assert.match(main,/if\(isAssetLocked\(asset\)\)continue/);assert.match(main,/assetStreamPending:!library\.loading/);assert.match(main,/examined<ASSET_STREAM_BATCH_SIZE/);assert.match(main,/publicAssetForRenderer/);assert.match(assetTransport,/encryptedMediaPaths,encryptedThumbnailPaths,histogram,palette,exif,technicalMetadata/);
  assert.match(renderer,/assetStreamState\.applyChunk/);assert.match(renderer,/if\(firstUsable\)\{scheduleStreamGridRender\(true\)/);assert.match(renderer,/onLibraryAssetsComplete/);assert.match(renderer,/assetStreamState\.finish/);assert.match(fs.readFileSync(path.join(root,'src','asset-stream-state.js'),'utf8'),/asset\.locked/);
});

test('portfolio registry recovery and adding existing databases are wired',()=>{
  assert.match(main,/portfolioRegistrySave=Promise\.resolve/);assert.match(main,/async function discoverPortfolioDatabases/);assert.match(main,/portfolios\.json\.bak|`\$\{portfolioRegistryFile\}\.bak`/);assert.match(main,/await handle\.sync\(\)/);assert.match(main,/portfolio:add-existing/);assert.match(main,/portfolio\.managed!==false/);assert.match(preload,/addExistingPortfolio/);assert.match(html,/id="add-existing-portfolio"/);assert.match(renderer,/addExistingPortfolio\(\)/);
});

test('appearance tree colors, hierarchical action destinations, custom F2 and faster magnifier are wired',()=>{
  assert.match(html,/id="tree-level-colors"/);assert.match(html,/id="add-tree-level-color"/);assert.match(renderer,/treeLevelColors/);assert.match(renderer,/function treeLevelColor/);assert.match(renderer,/data-delete-tree-level/);assert.match(styles,/color-mix\(in srgb,var\(--tree-color\)/);
  assert.match(renderer,/function shortcutCollectionOptions/);assert.match(renderer,/nextPath\.join\(' › '\)/);assert.match(renderer,/class="shortcut-tree-select"/);assert.match(styles,/select\[data-shortcut-step-value\][^{]*\{[^}]*font-size:calc\(9px \* var\(--app-font-scale\)\)/);
  const customShortcut=renderer.indexOf("const shortcutAction=!editing"),builtInF2=renderer.indexOf("event.key === 'F2'");assert.ok(customShortcut>=0&&customShortcut<builtInF2,'custom actions must run before built-in F2 rename');
  assert.match(renderer,/hoverFitPreviewTimer=setTimeout\(\(\)=>\{delayDone=true;reveal\(\);\},300\)/);
});

test('animated image hover, viewport magnifier, reorder markers and sidebar-only mutation broadcasts are wired',()=>{
  assert.match(renderer,/animatedImage=asset\.kind==='image'/);assert.match(renderer,/thumbnail-hover-media animated-image/);assert.match(main,/ANIMATED_IMAGE_EXTENSIONS/);assert.match(main,/createAnimatedImageFallback/);assert.match(main,/MOTION_PREVIEW_VERSION/);assert.match(styles,/\.thumbnail-hover-media\.animated-image/);assert.match(renderer,/asset\.mediaUrl\|\|asset\.previewUrl/);assert.match(renderer,/function stopAllHoverPreviews/);assert.match(renderer,/elements\.gridWrap\.addEventListener\('scroll',stopAllHoverPreviews/);assert.match(renderer,/pointerIsOverPreview/);assert.match(renderer,/document\.elementFromPoint\(pointerX,pointerY\)/);assert.match(renderer,/const hoverLifecycleActive=\(\)=>hovering&&card\.isConnected/);assert.match(renderer,/if\(media!==activeMedia\|\|!hoverLifecycleActive\(\)\)return/);assert.match(renderer,/revealEvent\?hoverLifecycleActive\(\):pointerIsOverPreview\(\)/);assert.match(renderer,/addEventListener\('loadeddata',showReady/);assert.match(renderer,/addEventListener\('load',showReady/);assert.match(renderer,/classList\.add\('hover-media-ready'\)/);assert.match(renderer,/enter=\(event\)=>\{updatePointer\(event\);hovering=true;seekFromPointer\(event\)/);assert.match(renderer,/activeMedia\.preload='auto'/);assert.ok(renderer.indexOf("addEventListener('loadeddata',showReady")<renderer.indexOf('activeMedia.src=asset.mediaUrl'),'video readiness must be observed before loading starts');assert.match(styles,/thumbnail-hover-media\.hover-media-ready\{opacity:1!important;visibility:visible/);assert.match(styles,/\.asset-preview:is\(\.media-hovering,\.animated-hovering\)>img:not\(\.thumbnail-hover-media\)\{visibility:hidden/);
  assert.match(styles,/\.hover-fit-preview \{ position:fixed/);assert.match(styles,/background:transparent/);assert.match(renderer,/elements\.gridWrap\.getBoundingClientRect/);assert.match(renderer,/delayDone/);
  assert.match(renderer,/function sidebarDropZone/);assert.match(renderer,/drop-before/);assert.match(renderer,/drop-after/);assert.match(renderer,/dropZone/);assert.match(styles,/\.collection-item\.drop-before::after/);assert.match(styles,/background:rgba\(102,166,255,\.48\)/);
  assert.match(main,/collection:rename[\s\S]{0,220}broadcastSidebar\(\)/);assert.match(main,/collection:move[\s\S]{0,700}broadcastSidebar\(\)/);assert.match(main,/smart-folder:move[\s\S]{0,220}broadcastSidebar\(\)/);assert.match(main,/sidebar:reorder-items[\s\S]{0,1000}broadcastSidebar\(\)/);
});

test('trash isolation, analytics actions, text reader, contact export, window restore and Smart Folder editing are wired',()=>{
  assert.match(renderer,/state\.view === 'trash'&&!state\.locationId&&!state\.collectionId&&!state\.smartFolderId/);assert.match(renderer,/state\.view='all';state\.smartFolderId/);assert.match(renderer,/metrics\.visibleCount/);assert.match(renderer,/metrics\?\.tagCatalog\.length/);assert.match(renderer,/metrics\?\.visibleCount/);
  assert.match(renderer,/data-analytics-asset/);assert.match(renderer,/View in folder/);assert.match(renderer,/Export to computer/);assert.match(renderer,/Copy path to file/);assert.match(preload,/exportAsset/);
  assert.match(html,/id="viewer-text-reader"/);assert.match(html,/id="viewer-line-numbers"/);assert.match(preload,/readTextAsset/);assert.match(main,/asset:read-text/);assert.match(renderer,/function escapeSyntax/);assert.match(styles,/syntax-key/);
  assert.match(html,/id="contact-sheet-export"/);assert.match(html,/WEBP/);assert.match(main,/contact-sheet:export/);assert.match(styles,/contact-sheet-page[^}]*background:var\(--panel\)/);assert.match(styles,/@media print[\s\S]*background:white/);
  assert.match(main,/window-state\.json/);assert.match(main,/function savedWindowOptions/);assert.match(main,/screen\.getPrimaryDisplay/);assert.match(main,/window:center-display/);assert.match(renderer,/event\.ctrlKey&&event\.altKey/);
  assert.match(renderer,/data-smart-action="edit"/);assert.match(renderer,/openSmartFolderDialog\(null,folder\)/);assert.match(preload,/updateSmartFolder/);assert.match(main,/smart-folder:update/);
});

test('preloaded magnifier, true viewer scale, scoped thumbnail sizes and matching folder counts are wired',()=>{
  assert.match(renderer,/image\.onload=/);assert.match(renderer,/asset\.previewUrl\|\|asset\.mediaUrl/);assert.match(renderer,/function viewerFitScale/);assert.match(renderer,/sourceX=\(cursorX-viewerPan\.x\)\/oldScale/);assert.match(renderer,/viewerPan\.x=cursorX-sourceX\*next/);assert.match(renderer,/Math\.min\(VIEWER_MAX_ZOOM,oldScale\*factor\)/);const wheelHandler=renderer.match(/\$\('\.viewer-stage'\)\.addEventListener\('wheel',[^\n]+/)?.[0]||'';assert.doesNotMatch(wheelHandler,/clampViewerPan/);assert.doesNotMatch(styles,/min-width: max-content/);
  assert.match(renderer,/function thumbnailSizeScopeKey/);assert.match(renderer,/function thumbnailSizeStorage/);assert.match(renderer,/restoreScopedThumbnailSize/);assert.match(html,/id="zoom-set-default"/);assert.match(renderer,/Portfolio thumbnail default updated/);assert.match(styles,/aspect-ratio:var\(--preview-ratio\)/);assert.match(styles,/object-fit:contain/);
  assert.match(fs.readFileSync(path.join(root,'electron','folder-tree-worker.js'),'utf8'),/directCount/);assert.match(renderer,/state\.includeSubfolderContent\?folder\.count:folder\.directCount/);assert.match(renderer,/--depth:\$\{folder\.depth\+1\};--tree-color:\$\{treeLevelColor\(folder\.depth\+1\)\}/);assert.match(html,/data-pref="coloredTreeLevels"/);assert.match(renderer,/colored-tree-levels/);assert.match(styles,/--tree-level-0/);assert.match(styles,/var\(--tree-color\)/);
});

test('startup restores scoped layout before reveal and automatic updates use actionable in-app prompts',()=>{
  assert.match(main,/show: false/);assert.match(main,/once\('ready-to-show',revealMainWindow\)/);assert.match(main,/webContents\.on\('did-finish-load',[^\n]*rendererIpcReady=true/);assert.match(main,/setTimeout\(revealMainWindow,2500\)/);assert.match(main,/app\.on\('second-instance',[\s\S]{0,250}revealMainWindow\(\)/);assert.match(html,/id="startup-version"/);assert.match(main,/--pigeon-app-version=\$\{app\.getVersion\(\)\}/);assert.match(preload,/startupVersion/);assert.match(preload,/target\.textContent=`Version \$\{startupVersion\}`/);assert.match(html,/class="startup-loader"/);assert.match(html,/class="startup-loader"[\s\S]*?pigeon-loading\.gif/);assert.match(styles,/\.startup-loader img\{/);
  assert.match(renderer,/SHARED_DEFAULT_THUMBNAIL_VIEWS=new Set\(\['all','uncategorized','untagged'\]\)/);assert.match(renderer,/scope==='default'\?settings\.default/);assert.match(renderer,/if\(scope==='default'\)\{settings\.default=next/);assert.match(renderer,/preferredPanelWidths/);assert.match(renderer,/restoreScopedThumbnailSize\(\);/);
  assert.match(html,/id="update-toast"/);assert.match(html,/id="update-now"/);assert.match(html,/id="update-later"/);assert.match(html,/id="update-skip"/);assert.match(renderer,/pigeon\.update\.deferUntil/);assert.match(renderer,/pigeon\.update\.skippedVersion/);assert.match(renderer,/setInterval\(\(\)=>runUpdateCheck\(\),60\*60\*1000\)/);assert.match(renderer,/result\.status==='required'/);assert.match(renderer,/document\.body\.classList\.toggle\('update-required'/);assert.match(preload,/installUpdate/);assert.match(main,/app:install-update/);assert.match(renderer,/elements\.inspector\.classList\.remove\('hidden-panel'\);\$\('#inspector-toggle'\)\.classList\.add\('selected'\);selectRightPanelTab\('threads'\);scheduleVirtualLayoutRefresh\(layoutAnchor\)/);assert.match(main,/UPDATE_POLICY_URL/);assert.doesNotMatch(main,/Pigeon Update Available/);
});

test('clean hierarchy, delayed fit preview, move continuity and contact sheets are wired',()=>{
  assert.doesNotMatch(styles,/background-image:repeating-linear-gradient\(to right/);assert.match(styles,/border-left:1px solid #4d5561/);assert.match(styles,/\.location-folder-item\.active::before/);
  assert.match(renderer,/hoverFitPreviewTimer=setTimeout/);assert.match(renderer,/,300\)/);assert.match(styles,/clip-path:polygon\(100% 0,100% 100%,0 100%\)/);assert.match(styles,/max-width:100%!important/);assert.match(styles,/object-fit:contain!important/);
  assert.match(renderer,/function successorAfterRemoving/);assert.match(renderer,/function selectAndRevealSuccessor/);assert.match(renderer,/successorId=leavesCurrent\?successorAfterRemoving/);assert.match(renderer,/delays=lockScroll\?\[0,60,140,260,480\]:\[0,90,240\]/);assert.match(renderer,/focusSelectedAsset\(\)/);assert.match(html,/id="contact-sheet-view"/);assert.match(renderer,/function openContactSheet/);assert.match(renderer,/function renderContactSheet/);assert.match(renderer,/data-folder-action="contact-sheet"/);assert.match(renderer,/data-location-action="contact-sheet"/);assert.match(renderer,/data-context-action="contact-sheet"/);assert.match(styles,/@media print/);
});

test('structure duplication, broad zoom, cursor viewer zoom, sticky trees, hover preview and topbar actions are wired',()=>{
  assert.match(preload,/duplicateGroupStructure/);assert.match(main,/group:duplicate-structure/);assert.match(main,/copyDirectories/);assert.match(main,/emptyFolders/);assert.match(renderer,/data-folder-action="duplicate"/);assert.match(renderer,/data-smart-action="duplicate"/);assert.match(renderer,/data-location-action="duplicate"/);
  assert.match(html,/id="zoom-slider"[^>]*min="72"[^>]*max="520"/);assert.match(html,/id="zoom-out"/);assert.match(html,/id="zoom-in"/);assert.match(renderer,/function setThumbnailZoom/);assert.match(styles,/-webkit-app-region:no-drag/);assert.match(renderer,/Math\.min\(VIEWER_MAX_ZOOM,oldScale\*factor\)/);assert.match(renderer,/viewerPan\.x=cursorX-sourceX\*next/);
  assert.match(styles,/\.collapsible-section-label\.pinned-section/);assert.match(renderer,/pinned-section/);assert.match(renderer,/folder-open/);assert.match(html,/id="hover-fit-preview"/);assert.match(renderer,/thumbnail-fit-preview/);assert.match(styles,/\.hover-fit-preview/);assert.match(renderer,/function showQuickActions/);assert.match(renderer,/data-quick-new-action/);
});

test('global similarity never runs automatically and explicit requests supersede and terminate workers',()=>{
  assert.match(main,/let activeSimilarityJob=null/);assert.match(main,/if\(activeSimilarityJob\)/);assert.match(main,/worker\.terminate\(\)\.catch/);assert.match(main,/resourceLimits:\{maxOldGenerationSizeMb:192\}/);
  assert.doesNotMatch(renderer,/refreshSimilarityGroups\(state\.view === 'duplicates'\)/);assert.match(renderer,/state\.view==='duplicates'&&state\.duplicateSourceId/);assert.match(main,/cancelPortfolioBackground[\s\S]*activeSimilarityJob/);
});

test('modified thumbnail clicks bypass marquee and all heavy background work uses laptop-safe limits',()=>{
  assert.match(renderer,/event\.target\.closest\('\.asset-card,button,input,textarea,select,a,\.stack-badge'\)/);assert.match(renderer,/event\.ctrlKey \|\| event\.metaKey/);assert.match(renderer,/event\.shiftKey && state\.selectionAnchorId/);
  assert.match(main,/const INDEX_CPU_LIMIT = 20/);assert.match(main,/const MAX_BACKGROUND_THREADS = 4/);assert.match(main,/const THUMBNAIL_WORKER_COUNT = 2/);assert.match(main,/const THUMBNAIL_REBUILD_WORKER_COUNT = Math\.max\(2,Math\.min\(4/);assert.match(main,/const BACKGROUND_HASH_WORKERS = 2/);assert.match(main,/const PDF_WORKER_LIMIT = 1/);assert.match(main,/const LARGE_SCAN_WORKER_LIMIT = 2/);assert.match(main,/dutyCycle: Math\.max\(0\.08, \(INDEX_CPU_LIMIT \/ 100\) \/ INDEX_WORKER_COUNT\)/);const budget=main.slice(main.indexOf('async function waitForIndexCpuBudget'),main.indexOf('function scanWorkActive'));assert.match(budget,/availableMemoryBytes\(\)/);assert.match(budget,/Background work paused for memory/);assert.doesNotMatch(budget,/telemetrySnapshot|collective\.cpu|yielding to your laptop/);
});

test('large-file scans defer fingerprints, use size-aware background deadlines, and classify intentional worker exits',()=>{
  assert.match(main,/SCAN_INLINE_HASH_MAX_BYTES = 8 \* 1024 \* 1024/);assert.match(main,/inlineHashMaxBytes: SCAN_INLINE_HASH_MAX_BYTES/);assert.match(main,/function fingerprintTimeoutForSize/);assert.match(main,/attempts: asset\.size>SCAN_INLINE_HASH_MAX_BYTES\?1:3/);assert.match(main,/entry\?\.expectedExit/);assert.match(main,/telemetry\.expectedExit = true/);assert.match(main,/schedulePortfolioBackground\(warmContentHashes, 500\)/);assert.match(main,/autoUpdater\.disableWebInstaller = true/);
});

test('thumbnail marquee selection auto-scrolls while background scans remain consolidated and responsive',()=>{
  assert.match(html,/id="selection-marquee"/);assert.match(styles,/\.selection-marquee/);assert.match(renderer,/function updateMarqueeSelection/);assert.match(renderer,/function runMarqueeAutoScroll/);assert.match(renderer,/setPointerCapture/);assert.match(renderer,/scrollSpeed/);assert.match(renderer,/paintChangedSelectionCards\(changed\)/);
  assert.match(main,/showProgress=\['plugin','similarity'\]\.includes\(type\)/);assert.match(main,/offset\+=100/);assert.match(main,/const scanBroadcastQueues=new Map/);assert.match(main,/setTimeout\(drain,16\)/);assert.match(renderer,/function scheduleLibraryAggregateBuild/);assert.match(renderer,/performance\.now\(\)-started<5/);assert.match(renderer,/const smartFolderCounts=new Map/);
});

test('destructive sidebar confirmations identify the exact collection, Smart Folder, or indexed folder',()=>{
  assert.match(renderer,/title: `Delete “\$\{collection\.name\}”\?`/);assert.match(renderer,/collection “\$\{collection\.name\}”/);
  assert.match(renderer,/title: `Delete “\$\{folder\.name\}”\?`/);assert.match(renderer,/Smart Folder “\$\{folder\.name\}”/);
  assert.match(renderer,/title: `Remove “\$\{location\.name\}”\?`/);assert.match(renderer,/\$\{location\.path\}/);
});

test('sidebar-only creation, optimistic folders, universal worker progress, and immediate inspector tag suggestions are wired',()=>{
  assert.match(main,/function broadcastSidebar/);assert.match(main,/collection:create[\s\S]{0,220}createCollection\(library, name, parentId, id\)[\s\S]{0,120}broadcastSidebar\(\)/);assert.match(main,/smart-folder:create[\s\S]{0,180}broadcastSidebar\(\)/);assert.match(preload,/createCollection: \(name, parentId, id = null\)/);assert.match(preload,/onSidebarChanged/);assert.match(renderer,/window\.pigeon\.onSidebarChanged/);
  const createPrompt=renderer.slice(renderer.indexOf('async function createCollectionPrompt'),renderer.indexOf("$('#add-collection')"));assert.match(createPrompt,/crypto\.randomUUID\(\)/);assert.ok(createPrompt.indexOf('renderSidebar(false)')<createPrompt.indexOf('await window.pigeon.createCollection'));assert.match(createPrompt,/requestAnimationFrame\(resolve\)/);
  const physicalCreate=renderer.slice(renderer.indexOf("if(action==='new-subfolder')"),renderer.indexOf("if(action==='rename')"));assert.match(physicalCreate,/stageOptimisticPhysicalFolder/);assert.ok(physicalCreate.indexOf('stageOptimisticPhysicalFolder')<physicalCreate.indexOf('await window.pigeon.createPhysicalSubfolder'));assert.match(physicalCreate,/requestAnimationFrame\(resolve\)/);assert.match(physicalCreate,/rollback\(\)/);assert.match(renderer,/function stageOptimisticPhysicalFolder/);
  assert.match(main,/showProgress=\['plugin','similarity'\]\.includes\(type\)/);assert.match(main,/if\(showProgress\)reportBackgroundProgress/);assert.match(main,/worker complete/);
  assert.match(renderer,/if\(input===elements\.tags\)/);assert.match(renderer,/addTagsToAssets\(targets,\[tag\]\)/);assert.match(renderer,/event\.key === 'Enter'.*applyTagSuggestion/);
});

test('trash progress, PDF first-page refresh, sidebar ordering, reset icon, and larger branding are wired',()=>{
  assert.match(main,/Clearing Trash/);assert.match(main,/reportBackgroundProgress\(progressId/);assert.match(main,/PDF_PREVIEW_VERSION=3/);assert.match(main,/pdfPreviewVersion!==PDF_PREVIEW_VERSION/);assert.match(main,/thumbnailFailureVersion!==PDF_PREVIEW_VERSION/);assert.match(main,/timeout:\s*asset\.extension==='PDF'\?35000:RAW_IMAGE_EXTENSION_SET/);
  const pdfChild=fs.readFileSync(path.join(root,'electron','pdf-thumbnail-child.js'),'utf8');assert.match(pdfChild,/standardFontDataUrl/);assert.match(pdfChild,/GlobalWorkerOptions\.workerSrc/);
  assert.match(preload,/reorderSidebarItems/);assert.match(preload,/setSidebarSort/);assert.match(main,/sidebar:reorder-items/);assert.match(main,/sidebar:set-sort/);assert.match(renderer,/sidebarSortedSiblings/);assert.match(renderer,/data-sidebar-sort/);
  assert.match(html,/id="clear-filters"[^>]*Reset all filters/);assert.match(renderer,/\['#clear-filters','refresh'\]/);assert.match(styles,/width:270px/);assert.match(styles,/font-size:calc\(72px \* var\(--app-font-scale\)\)/);assert.match(styles,/font-size:calc\(29px \* var\(--app-font-scale\)\)/);
  assert.match(html,/id="order-by-button"/);assert.match(html,/id="order-by-popover"/);assert.match(preload,/setAssetOrder/);assert.match(main,/assets:set-order/);assert.match(renderer,/function assetOrderScopeKey/);assert.match(renderer,/function currentAssetOrder/);assert.match(styles,/\.order-by-popover/);
});

test('inspector actions live in the thumbnail menu and annotations edit inline',()=>{
  assert.doesNotMatch(html,/id="(?:open-asset|reveal-asset|find-similar|annotate-asset)"/);
  assert.match(renderer,/data-context-action="open"/);
  assert.match(renderer,/data-context-action="reveal"/);
  assert.match(renderer,/data-context-action="similar"/);
  assert.match(renderer,/data-context-action="annotate"/);
  assert.match(html,/id="annotation-view" class="annotation-view hidden"/);
  assert.doesNotMatch(html,/<dialog id="annotation-dialog"/);
  assert.match(renderer,/elements\.annotationView\.classList\.remove\('hidden'\)/);
  assert.match(renderer,/function closeAnnotationEditor/);
  assert.match(styles,/\.annotation-view \{/);
});

test('thumbnail Find Similar supersedes global grouping and remains scoped to its source image',()=>{
  assert.match(renderer,/sourceId=state\.duplicateSourceId/);
  assert.match(renderer,/sourceId!==state\.duplicateSourceId/);
  assert.match(renderer,/similarityRefreshGeneration\+=1;state\.duplicateGroups=\[\];state\.duplicateIds\.clear\(\)/);
  assert.doesNotMatch(renderer,/if \(similarityRefreshPromise\) return similarityRefreshPromise/);
  assert.match(renderer,/action === 'similar'\) selectView\('duplicates'.*sourceId: id/);
});

test('common interactions paint immediately and defer expensive renderer work',()=>{
  assert.match(renderer,/function paintActiveNavigation/);
  assert.match(renderer,/function renderNavigationDestination/);
  assert.match(renderer,/requestAnimationFrame\(\(\)=>requestAnimationFrame/);
  assert.match(renderer,/const heights=cards\.map/);
  assert.match(renderer,/Object\.assign\(asset,patch\);patchCardMetadata\(asset,patch\);applyMetadataViewDelta/);assert.match(renderer,/invalidateMetadataAggregateCaches\(change\.patch\)/);
  assert.match(renderer,/searchRenderTimer=setTimeout/);assert.match(renderer,/elements\.gridWrap\.classList\.add\('navigation-pending'\)/);assert.match(renderer,/\},25\);/);
  assert.match(styles,/grid-wrap\.navigation-pending::after/);
});

test('portfolio-wide counts, analytics, smart-folder previews, and interactive jobs are cooperatively scheduled',()=>{
  assert.match(renderer,/function scheduleLibraryAggregateBuild/);assert.match(renderer,/performance\.now\(\)-started<5/);assert.match(renderer,/const asset=assets\[build\.index\+\+\];if\(!asset\)continue/);assert.match(renderer,/schedule:\(task\)=>scheduleAssetViewTask\(task,true\)/);assert.match(renderer,/try\{task\?\.\(\);\}catch\(error\)/);assert.match(renderer,/finally\{assetViewTaskRunning=false;\}/);assert.match(renderer,/function renderAnalytics\(\)/);assert.match(renderer,/Calculating analytics/);assert.match(renderer,/analyticsSnapshotCache/);assert.match(renderer,/function updateSmartFolderFound/);assert.match(renderer,/Calculating…/);assert.doesNotMatch(renderer,/const count = assets\.filter\(\(asset\) => !asset\.deletedAt && !asset\.locked && matchesSavedFilters/);
});

test('high-frequency viewer and selection paths use indexed asset access',()=>{
  assert.match(renderer,/function viewerSourceSize\(\)\{const asset=assetById/);assert.match(renderer,/const assets=ids\.map\(assetById\)\.filter\(Boolean\)/);assert.match(renderer,/function expandedTagTargetIds[\s\S]{0,500}map\(assetById\)/);assert.match(renderer,/stackMembers:new Map/);assert.doesNotMatch(renderer,/state\.library\.assets\.find\(/);
});

test('empty portfolios offer one-click indexing of the default Pictures folder',()=>{
  assert.match(html,/id="empty-add-pictures"/);
  assert.match(html,/Click here to add your default Pictures folder to get started/);
  assert.match(html,/empty-folder-back/);
  assert.match(styles,/\.empty-photo/);
  assert.match(preload,/addDefaultPictures:.*library:add-default-pictures/);
  assert.match(main,/library:add-default-pictures/);
  assert.match(main,/app\.getPath\('pictures'\)/);
  assert.match(renderer,/addDefaultPictures/);
});

test('preload exposes local-first ingestion, sync, plugin, batch and editing APIs', () => {
  for (const api of ['setCollectionAutoTags', 'setFolderAutoTags', 'copyText', 'copyAssets', 'pasteAssets', 'pathForDroppedFile', 'importDroppedFiles', 'searchMap', 'suggestMap', 'createPortfolio', 'renamePortfolio', 'switchPortfolio', 'removePortfolio', 'createCollection', 'batchUpdateAssets', 'findDuplicates', 'autoTag', 'importUrl', 'importClipboard', 'captureScreen', 'backupLibrary', 'configureSync', 'syncNow', 'exportAnnotated', 'runPlugin', 'openAssetWith', 'ensurePlayable', 'listPlugins', 'installPlugin', 'setupPlugin', 'preparePlugin', 'cancelPluginSetup', 'checkPluginHealth', 'importPluginModel', 'removePluginModel', 'uninstallPlugin', 'setPluginEnabled', 'configurePlugin', 'setWindowZoom', 'setCollectionPassword', 'unlockCollection', 'lockCollectionNow', 'removeCollectionPassword', 'renameAssetFile', 'applyInlineCrop', 'resetInlineEdits', 'duplicateAsset', 'stackAssets', 'unstackAssets']) assert.match(preload, new RegExp(`${api}:`));
  assert.match(preload, /webUtils\.getPathForFile/);
});

test('Ctrl+A selects thumbnails and Ctrl+C/Ctrl+V use the native file clipboard',()=>{
  assert.match(preload,/copyAssets:/);
  assert.match(preload,/pasteAssets:/);
  assert.match(main,/clipboard:copy-assets/);
  assert.match(main,/SetFileDropList/);
  assert.match(main,/ContainsFileDropList/);
  assert.match(main,/clipboard\.readImage\(\)/);
  assert.match(main,/importDroppedFiles\(paths\)/);
  assert.match(renderer,/event\.key\.toLowerCase\(\)==='a'/);
  assert.match(renderer,/selectAllVisibleAssetsCooperatively\(\)/);
  assert.match(renderer,/event\.key\.toLowerCase\(\)==='c'/);
  assert.match(renderer,/window\.pigeon\.copyAssets/);
  assert.match(renderer,/event\.key\.toLowerCase\(\)==='v'/);
  assert.match(renderer,/window\.pigeon\.pasteAssets/);
});

test('external drops use a managed organization inbox and ordinary wheel input scrolls', () => {
  assert.match(main, /Needs Organization/);
  assert.match(main, /managedInbox: true/);
  assert.match(main, /COPYFILE_EXCL/);
  assert.match(main, /library:import-dropped-files/);
  assert.match(renderer, /hasExternalFiles/);
  assert.match(renderer, /window\.pigeon\.pathForDroppedFile\(file\)/);
  assert.match(renderer, /window\.pigeon\.importDroppedFiles\(paths\)/);
  assert.match(renderer, /transfer\.items/);
  assert.match(renderer, /\['all', 'uncategorized', 'tags'\]/);
  assert.match(renderer, /!event\.ctrlKey && !event\.metaKey/);
  assert.match(renderer, /!\(asset\.tags \|\| \[\]\)\.length && !\(asset\.collectionIds \|\| \[\]\)\.length/);
  assert.match(styles, /#grid-wrap\.external-drop/);
});

test('map view supports batch geolocation, address search, globe and street modes', () => {
  assert.match(renderer, /openMapView/);
  assert.match(renderer, /drawGlobe/);
  assert.match(renderer, /drawStreetMap/);
  assert.match(renderer, /mapGlobeZoom/);
  assert.match(renderer, /state\.mapMode = 'street'; state\.mapZoom = 3/);
  assert.match(renderer, /createWorldLandTexture/);
  assert.match(renderer, /drawProjectedLand/);
  assert.match(renderer, /cursorGeo/);
  assert.match(html, /world-land\.js/);
  assert.match(worldLand, /PIGEON_WORLD_LAND/);
  assert.ok(worldLand.length > 100000, 'accurate Natural Earth geometry should be bundled');
  assert.match(renderer, /requestMapSuggestions/);
  assert.equal((html.match(/id="map-search-input"/g) || []).length, 1);
  assert.match(html, /id="map-search-results"[^>]*role="listbox"/);
  assert.doesNotMatch(html, /map-address-suggestions/);
  assert.match(renderer,/updateAssetsWithoutGridRefresh\(state\.mapSelectionIds/);
  assert.match(main, /nominatim\.openstreetmap\.org/);
  assert.match(main, /photon\.komoot\.io/);
  assert.match(main, /tile\.openstreetmap\.org/);
  assert.match(main, /pigeon-map/);
});

test('Rows is the default layout and layout names stay concise', () => {
  assert.match(renderer, /layout: 'justified'/);
  assert.match(renderer, /grid: \['layout', 'Masonry'\], justified: \['all', 'Rows'\], list: \['menu', 'List'\]/);
  assert.match(renderer, /\['Masonry','Alt\+1'\],\['Rows','Alt\+2'\],\['List','Alt\+4'\]/);
  assert.doesNotMatch(renderer, /Masonry thumbnails|Equal-height rows|List view/);
  assert.match(packageJson, /"version": "0\.2\.66"/);
});

test('justified rows, tag autocomplete, and viewer editing controls are wired', () => {
  assert.match(renderer, /layout-justified/);
  assert.match(renderer, /justified-basis/);
  assert.match(renderer, /renderTagSuggestions/);
  assert.match(renderer, /allExistingTags/);
  assert.match(renderer, /cachedExistingTags/);
  assert.match(renderer, /cachedTagCatalog/);
  assert.doesNotMatch(renderer, /renderedTagSuggestions!==tags/);
  assert.match(renderer, /data-tag-create="true"/);
  assert.match(renderer, /Create &quot;/);
  assert.match(renderer, /enableTagAutocomplete/);
  assert.match(renderer, /mountTagAutocomplete/);
  assert.match(renderer, /requestTagSet/);
  assert.match(renderer, /textEntryTagValues/);
  assert.match(html, /id="text-entry-tag-pills"/);
  assert.match(renderer, /closest\('dialog\[open\]'\)/);
  assert.match(renderer, /showPopover/);
  assert.match(html, /id="tag-autocomplete"[^>]*popover="manual"/);
  assert.match(renderer, /currentTagToken/);
  assert.match(renderer, /data-smart-tag-input/);
  assert.match(renderer, /folderAutoTags/);
  assert.match(renderer, /collectionAutoTags/);
  assert.match(styles, /\.tag-autocomplete/);
  assert.match(renderer, /rotateViewerAsset/);
  assert.match(renderer, /beginViewerCrop/);
  assert.match(renderer, /applyViewerCrop/);
  assert.match(renderer, /event\.key === 'Enter'/);
});

test('startup copy is left aligned without a logo while About and platform packages retain Pigeon branding', async () => {
  assert.doesNotMatch(html, /id="startup-splash"[^\n]*class="startup-brand"><img/);
  assert.match(html, /id="startup-splash"[^\n]*class="startup-brand"><div><strong>pigeon<\/strong><span>sees all<\/span><small id="startup-version">Version<\/small>/);
  assert.match(html, /rel="icon"[^>]*pigeon-logo\.png/);
  assert.match(styles, /\.startup-splash \{[^}]*background: #040405/);
  assert.match(styles,/\.app-shell\.startup-active > :not\(\.startup-splash\)/);
  assert.match(html,/startup-brand[\s\S]*?<strong>pigeon<\/strong><span>sees all<\/span>/);
  assert.match(styles,/\.startup-brand \{ position:absolute; left:0; bottom:0/);
  assert.match(styles,/\.startup-splash > \.startup-brand \{ left:clamp\(24px,3vw,48px\)/);
  assert.match(styles,/\.startup-brand img \{[^}]*width:270px/);
  assert.match(styles,/\.startup-brand strong \{[^}]*font-size:calc\(72px \* var\(--app-font-scale\)\)/);
  assert.match(styles,/\.startup-brand span \{[^}]*font-size:calc\(29px \* var\(--app-font-scale\)\)/);
  assert.match(styles, /\.brand-mark \{[^}]*background: transparent/);
  assert.doesNotMatch(html, /pigeon\.png/);
  assert.match(main, /icon: path\.join\([^\n]*'pigeon-logo\.png'/);
  assert.match(html,/id="about-dialog"[\s\S]*?pigeon-logo\.png/);
  assert.match(packageJson,/"mac": \{[\s\S]*?"icon": "build\/icon\.icns"/);assert.match(packageJson,/"win": \{[\s\S]*?"icon": "build\/icon\.ico"/);assert.match(packageJson,/"linux": \{[\s\S]*?"icon": "build\/icons"/);assert.match(packageJson,/"icons:generate": "node scripts\/generate-app-icons\.js"/);
  const ico=fs.readFileSync(path.join(root,'build','icon.ico')),icns=fs.readFileSync(path.join(root,'build','icon.icns'));assert.equal(ico.readUInt16LE(2),1);assert.ok(ico.readUInt16LE(4)>=7);assert.equal(icns.subarray(0,4).toString('ascii'),'icns');assert.equal(icns.readUInt32BE(4),icns.length);
  for(const size of [16,32,48,64,128,256,512,1024]){const metadata=await sharp(path.join(root,'build','icons',`${size}x${size}.png`)).metadata();assert.equal(metadata.width,size);assert.equal(metadata.height,size);assert.equal(metadata.hasAlpha,true);}
  const linuxIcon=await sharp(path.join(root,'build','icon.png')).metadata();assert.equal(linuxIcon.width,1024);assert.equal(linuxIcon.height,1024);
  const logo = sharp(path.join(root, 'pigeon-logo.png'));
  assert.equal((await logo.metadata()).hasAlpha, true);
  assert.equal((await logo.stats()).isOpaque, false);
  assert.match(renderer, /finishStartupSplash/);
  assert.match(renderer, /STARTUP_SPLASH_MINIMUM_MS=0/);
  assert.match(styles, /\.startup-brand img \{[^}]*width:270px/);
  assert.match(styles, /border: 0/);
});

test('macOS titlebar keeps the Pigeon menu clear of window controls', () => {
  assert.match(renderer, /document\.documentElement\.dataset\.platform = window\.pigeon\.platform/);
  assert.match(styles, /html\[data-platform="darwin"\] \.window-drag \{ padding-left: 80px; \}/);
  assert.match(styles, /html\[data-platform="darwin"\] #app-menu \{ top: 42px; left: 73px; \}/);
});

test('rotated thumbnails swap orientation and rotated viewer images remain fitted', () => {
  assert.match(renderer, /quarterTurn \? 1 \/ originalRatio/);
  assert.match(renderer, /applyViewerImageFit/);
  assert.match(renderer, /fitRotatedThumbnail/);
  assert.match(renderer, /image\.naturalHeight \/ image\.naturalWidth/);
  assert.match(renderer, /rotatedThumbnailObserver = new ResizeObserver/);
  assert.match(renderer, /--rotated-image-width/);
  assert.match(styles, /asset-preview\.quarter-turned/);
  assert.match(styles, /var\(--rotated-image-width/);
});

test('proper SVG icons and per-item icon customization are wired', () => {
  assert.match(html, /src="icons\.js"/);
  assert.match(html, /id="icon-picker-dialog"/);
  assert.match(icons, /window\.pigeonIcon/);
  assert.ok((icons.match(/:'<|:'/g) || []).length >= 30);
  assert.match(preload, /setItemIcon/);
  assert.match(main, /item:set-icon/);
  assert.match(renderer, /openIconPicker/);
  assert.match(renderer, /Change Icon/);
  assert.match(renderer, /typeof anchor === 'number'/);
  assert.match(renderer, /positionMenu\(elements\.contextMenu, event\.clientX, event\.clientY\)/);
});

test('left-panel section headings collapse, expand, and persist', () => {
  for (const name of ['smart-folders', 'collections', 'indexed-locations']) {
    assert.match(html, new RegExp(`data-section-toggle="${name}"`));
    assert.match(html, new RegExp(`id="sidebar-section-${name}"`));
  }
  assert.match(renderer, /setSidebarSectionExpanded/);
  assert.match(renderer,/setGroupExpanded=\(expanded\)=>\{setSidebarSectionExpanded\(name,expanded\);setHierarchyGroupCollapsed\(group,!expanded\);\}/);
  assert.match(renderer,/setSidebarSectionExpanded\(name,!collapsedSidebarSections\.has\(name\)\)/);
  assert.match(renderer,/label\.getAttribute\('aria-expanded'\)!=='true'/);
  assert.match(renderer, /pigeon\.collapsedSidebarSections/);
  assert.match(renderer, /pigeon\.collapsedFolders/);
  assert.match(renderer, /toggleFolderCollapsed/);
  assert.match(renderer, /hierarchyCollapseKeys/);
  assert.match(renderer, /setFolderCollapseStates/);
  assert.match(renderer, /collectionCollapseKey/);
  assert.match(renderer, /locationCollapseKey/);
  assert.match(styles, /\.folder-tree-toggle/);
  assert.match(styles, /\.folder-row-lock/);assert.match(styles,/folder-row-lock[^}]*border:0[^}]*background:transparent/);assert.match(styles,/\.sidebar-tree-scroll \[hidden\] \{ display:none !important; \}/);
  for(const name of ['smartFolders','collections','folders'])assert.match(html,new RegExp(`data-hierarchy-collapse="${name}"`));
  assert.match(renderer,/\[data-hierarchy-collapse\]/);assert.match(main,/\['collections','smartFolders','folders'\]/);
  assert.match(styles, /\.context-menu button \{[^}]*justify-content: flex-start[^}]*text-align: left/);
  assert.match(styles, /sidebar-section-content\.collapsed/);
});

test('smart folders support collection presence and numeric rating comparisons', () => {
  assert.match(renderer,/\['collection','Collection'\]/);
  for(const operator of ['less-than','less-than-equal','greater-than','greater-than-equal']) assert.match(renderer,new RegExp(operator));
  assert.match(renderer,/operatorsForSmartField/);
  assert.match(renderer,/rule\.field === 'collection' \? asset\.collectionIds/);
  assert.match(libraryCore,/rule\.field === 'collection' \? asset\.collectionIds/);
  assert.match(libraryCore,/Number\.isFinite\(target\)/);
});

test('portfolio, collection, and smart-folder creation use in-app dialogs', () => {
  assert.doesNotMatch(renderer, /\bprompt\s*\(/);
  assert.doesNotMatch(renderer, /\bconfirm\s*\(/);
  assert.match(renderer, /requestText/);
  assert.match(renderer, /requestConfirmation/);
  assert.match(renderer,/requestAnimationFrame\(\(\) => \$\('#confirm-text-entry'\)\.focus\(\)\)/);
  assert.match(renderer, /openSmartFolderDialog/);
  assert.match(renderer, /smartFolderRules/);
  assert.match(renderer, /matchesSmartRule/);
  assert.match(styles, /smart-folder-dialog/);
});

test('brand menu opens a searchable modal portfolio hot-switcher', () => {
  assert.match(html, /class="brand-row brand-menu"[^>]*role="button"[^>]*tabindex="0"/);
  assert.doesNotMatch(html, /<button[^>]*brand-menu/);
  assert.match(html, /id="portfolio-switcher"[^>]*role="dialog"/);
  assert.match(renderer, /event\.target !== event\.currentTarget/);
  assert.match(renderer, /'ArrowDown'/);
  assert.match(html, /Create Portfolio/);
  assert.match(renderer, /renderPortfolioSwitcher/);
  assert.match(renderer, /switchPortfolioTo/);
  assert.match(styles, /portfolio-switcher-item\.active/);
});

test('portfolio navigation and scroll position persist across restarts', () => {
  assert.match(renderer, /saveNavigationState/);
  assert.match(renderer, /restoreNavigationState/);
  assert.match(renderer, /pigeon\.navigation\./);
  assert.match(renderer, /locationSubfolder/);
  assert.match(renderer, /gridScrollTop/);
  assert.match(renderer, /beforeunload/);
});

test('files can be renamed without exposing or changing their extension', () => {
  assert.match(html, /id="asset-name"[^>]*Filename without extension/);
  assert.match(preload, /renameAssetFile:/);
  assert.match(main, /asset:rename-file/);
  assert.match(main, /Enter the filename without its extension/);
  assert.match(main, /fsp\.rename/);
  assert.match(renderer, /event\.key === 'F2'/);
  assert.match(renderer, /beginInlineFilenameRename/);
  assert.match(renderer, /elapsed >= 350 && elapsed <= 2500/);
  assert.match(styles, /card-filename-input/);
});

test('thumbnail title lines are optional and configurable', () => {
  assert.match(renderer, /thumbnailTitleLines/);
  assert.match(renderer, /thumbnailTitle\(asset, field\)/);
  assert.match(renderer, /pigeon\.thumbnailTitleLine/);
  assert.match(renderer, /card-title-line/);
});

test('included locations expose nested physical-folder filtering and recursive Auto-Tag rules', () => {
  assert.match(renderer, /location-folder-item/);
  assert.match(renderer, /function hideContextMenu/);
  assert.match(renderer, /Set Auto-Tag/);
  assert.match(renderer, /data-location-action="rescan"/);
  assert.match(renderer, /data-location-action="new-subfolder"/);
  assert.match(renderer, /createPhysicalSubfolder/);
  assert.match(preload, /folder:create-physical/);
  assert.match(main, /createPhysicalSubfolder/);
  assert.match(main, /emptyFolders\[locationId\]/);
  assert.match(renderer, /data-location-action="rename"/);
  assert.match(renderer, /application\/x-pigeon-physical-folder/);
  assert.match(preload, /folder:move-physical/);
  assert.match(main, /movePhysicalSubfolder/);
  assert.match(main, /migratePhysicalFolderSettings/);
  assert.match(renderer, /Rescan Folder/);
  assert.match(renderer, /source-missing-overlay/);
  assert.match(renderer, /Source Missing/);
  assert.match(styles, /asset-card\.source-missing[^}]*opacity: \.3/);
  assert.match(renderer, /including every subfolder/);
  assert.match(main, /folder:set-auto-tags/);
  assert.match(main, /assetMatchesFolder/);
  assert.match(main, /configuredFolderTags/);
  assert.match(main, /sourceMissing: true/);
  assert.match(main, /missingSince: asset\.missingSince \|\| Date\.now\(\)/);
  assert.match(main, /sourceMissing: false/);
  assert.match(main, /collection:set-auto-tags/);
  assert.match(main, /collectionDescendants/);
  assert.match(renderer, /editCollectionAutoTags/);
  assert.match(renderer, /locationSubfolder/);
  assert.match(html, /id="subfolder-content-toggle"[^>]*aria-pressed="false"/);
  assert.match(renderer, /includeSubfolderContent: localStorage\.getItem\('pigeon\.includeSubfolderContent'\) === 'true'/);
  assert.match(renderer, /state\.includeSubfolderContent \? source\.startsWith/);
  assert.match(renderer, /parent === selectedFolder/);
  assert.match(renderer, /pigeon\.includeSubfolderContent/);
  assert.match(renderer, /folder-tree/);
  assert.match(renderer, /buildFolderTree/);
  assert.match(renderer, /selectedFolder/);
});
test('thumbnail context menu navigates in-app to the containing physical Folder',()=>{assert.match(html,/physical-folder-navigation\.js/);assert.match(renderer,/data-context-action="go-to-folder"/);assert.match(renderer,/>Go to Folder</);assert.match(renderer,/goToAssetPhysicalFolder\(asset\)/);assert.match(renderer,/physicalFolderNavigation\.assetFolderTarget/);assert.match(renderer,/await selectLocation\(target\.locationId,target\.subfolder\)/);assert.match(renderer,/folderTreeLimits\.set/);assert.match(renderer,/scheduleFolderTreeBuild\(\)/);});
test('physical Folders rebuild after sidebar refresh, rescan, and section expansion',()=>{assert.match(renderer,/if\(locations\)scheduleFolderTreeBuild\(\)/);assert.match(renderer,/await window\.pigeon\.rescan\(state\.locationId,state\.locationSubfolder\); scheduleFolderTreeBuild\(\)/);assert.match(renderer,/expanded && name === 'indexed-locations'\) scheduleFolderTreeBuild\(\)/);assert.match(main,/PIGEON_SMOKE_PHYSICAL_TREE/);assert.match(main,/physical folder tree visible/);});

test('explicit folder rescans scope indexing and live thumbnail rebuilding to the selected subfolder',()=>{const rescanHandler=main.slice(main.indexOf("ipcMain.handle('library:rescan'"),main.indexOf("ipcMain.handle('library:refresh-sources'")),scanBody=main.slice(main.indexOf('async function scanLocation'),main.indexOf('function resumePendingScans'));assert.match(preload,/rescan: \(id, subfolder = ''\)/);assert.match(renderer,/rescan\(location\.id,subfolder\)/);assert.match(rescanHandler,/scanLocation\(id,\{rebuildPreviews:true,subfolder\}\)/);assert.match(rescanHandler,/notify:false,rebuildPreviews:true/);assert.match(scanBody,/const scanRoot=path\.resolve\(location\.path,scanSubfolder\)/);assert.match(scanBody,/assetInScanScope=\(asset\)=>asset\.locationId===location\.id&&pathIsInside\(scanRoot,asset\.path\)/);assert.match(scanBody,/walkFolder\(scanRoot/);assert.match(scanBody,/jobLibrary\.assets\.filter\(\(asset\)=>!assetInScanScope\(asset\)\)\.concat\(retained\)/);assert.match(scanBody,/if\(rebuildPreviews&&backgroundRunActive\(run\)\)/);assert.match(scanBody,/await rebuildThumbnails\(rebuildIds\)/);assert.match(scanBody,/\['image','video','audio','document'\]\.includes\(asset\.kind\)/);assert.match(main,/scanLocation\(location\.id\);/);});

test('Collections stay virtual while the physical source tree is labeled Folders', () => {
  assert.match(html, /<span>Folders<\/span>/); assert.doesNotMatch(html, />Indexed locations</i); assert.match(html, /Show these items[\s\S]*showLocations[^\n]*Folders/);
  assert.match(renderer, /Collections are virtual/); assert.match(renderer, /without changing any folders on disk/); assert.match(renderer, /New Nested Collection/);
  for (const channel of ['collection:create','collection:rename','collection:move']) { const handler=main.match(new RegExp(`ipcMain\\.handle\\('${channel}'[\\s\\S]*?\\n\\}\\);`))?.[0]||''; assert.ok(handler, `${channel} handler should exist`); assert.doesNotMatch(handler, /\bfsp?\./, `${channel} must not mutate disk`); }
});

test('rotated justified thumbnails, centered metadata, untagged view, and durable collection auto-tags are wired', () => {
  assert.match(styles, /layout-justified \.asset-preview\.quarter-turned img/);
  assert.match(styles, /width: var\(--rotated-image-width/);
  assert.match(styles, /\.card-titles \{[^}]*justify-items: center/);
  assert.match(styles, /\.card-title-line \{[^}]*text-align: center/);
  assert.match(html, /data-view="untagged"/);
  assert.match(html, /id="untagged-count"/);
  assert.match(renderer, /state\.view === 'untagged'/);
  assert.match(renderer, /!\['trash', 'duplicates', 'untagged'\]\.includes/);
  assert.match(main, /reconcileConfiguredCollectionTagsCooperatively/);
  assert.match(main, /applyConfiguredCollectionTags\(duplicate\)/);
  assert.match(main, /target\.collectionId[\s\S]*applyConfiguredCollectionTags\(asset\)/);
  assert.match(main, /Object\.prototype\.hasOwnProperty\.call\(patch, 'collectionIds'\)/);
  assert.match(renderer, /setCollectionAutoTags\(collection\.id,tags\)\.catch/);
});

test('duplicates view groups similar images and supports source-based accuracy', () => {
  assert.match(preload, /findSimilarGroups/);
  assert.match(main, /assets:similar-groups/);
  assert.match(renderer, /refreshSimilarityGroups/);
  assert.match(renderer, /duplicate-group-title/);
  assert.match(renderer, /sourceId: id/);
  assert.match(styles, /duplicate-row/);
  assert.match(styles, /\.duplicates-layout \.duplicate-row \.asset-preview img[^}]*object-fit: contain/);
  assert.match(styles, /\.duplicate-controls \{[^}]*position: sticky; top: 0[^}]*box-shadow: none/);
});

test('tag assignment snapshots multi-selection and expands complete stacks', () => {
  assert.match(renderer, /tagAssignmentTargetIds = expandedTagTargetIds/);
  assert.match(renderer, /stackIds\.has\(asset\.stackId\)/);
  assert.match(renderer, /addTagsToAssets\(tagAssignmentTargetIds, tags\)/);
  assert.match(renderer, /const targets = expandedTagTargetIds\(\)/);
});

test('collection drag updates smart-folder thumbnails without a full grid refresh',()=>{
  assert.match(renderer,/addAssetsToCollectionWithoutGridRefresh/);
  assert.match(renderer,/batchUpdateAssets\(unique,operation,\{silent:true,returnAssets:true\}\)/);
  assert.match(renderer,/applyAssetMutationVisibility\(unique,result,\{viewport\}\)/);
  assert.match(renderer,/thumbnailVisibilityObserver\.unobserve\(card\);card\.remove\(\)/);
  const reconcile=renderer.match(/function reconcileThumbnailCards[\s\S]*?\n\}/)?.[0]||'';assert.match(reconcile,/host\.insertBefore\(card,cursor\)/);assert.match(reconcile,/card\.parentElement!==host/);assert.doesNotMatch(reconcile,/appendChild\(card\)/);
  assert.match(renderer,/renderSidebar\(false\)/);
  const helper=renderer.match(/async function addAssetsToCollectionWithoutGridRefresh[\s\S]*?\n\}/)?.[0]||'';
  assert.doesNotMatch(helper,/renderGrid\(/);
  assert.match(main,/if \(!options\.silent\) broadcastAssetPatches/);
});

test('collection and folder drops preserve scroll while incrementally re-sorting cards',()=>{
  assert.match(renderer,/function captureGridViewport/);assert.match(renderer,/function restoreGridViewport/);assert.match(renderer,/view\.viewportRestore=viewport/);assert.match(renderer,/view\.preserveCards=true/);assert.match(renderer,/renderGrid\(\{preserveCards:!view\.forceFreshCards&&\(view\.previewPainted\|\|Boolean\(view\.preserveCards\)\)\}\)/);assert.match(renderer,/viewport\.interaction!==gridScrollInteractionVersion/);assert.match(renderer,/selectSuccessorWithoutScrolling/);assert.match(renderer,/reconcileThumbnailCards\(ids,\{viewport\}\)/);assert.doesNotMatch(renderer.match(/async function addAssetsToCollectionWithoutGridRefresh[\s\S]*?\n\}/)?.[0]||'',/selectAndRevealSuccessor/);
});

test('previewable text extensions work for legacy file-kind assets',()=>{
  assert.match(main,/PREVIEWABLE_DOCUMENT_EXTENSIONS\.has\(asset\.extension\).*return !asset\.thumbnailPath/);assert.match(main,/if \(PREVIEWABLE_DOCUMENT_EXTENSIONS\.has\(asset\.extension\)\) return createDocumentThumbnail/);assert.match(main,/schedulePortfolioBackground\(warmThumbnailCache,1000\)/);assert.match(renderer,/function isTextPreviewDocument\(asset\)\{return TEXT_PREVIEW_DOCUMENT_EXTENSIONS\.has/);assert.match(renderer,/hasDocumentThumbnailPreview\(asset\)\) && Boolean\(asset\.thumbnailPath\)/);assert.match(renderer,/if\(state\.kind==='visual'\)state\.kind='all'/);assert.match(renderer,/documentFallback=hasDocumentThumbnailPreview\(asset\)/);
});

test('tagging incrementally reconciles Smart Folder cards while preserving thumbnail nodes',()=>{
  const tagHelper=renderer.match(/function applyTagsToAssetsOptimistically[\s\S]*?\nasync function addTagsToAssets/)?.[0]||'',collectionDelete=renderer.match(/async function removeCollectionWithoutGridRefresh[\s\S]*?\nasync function editCollectionAutoTags/)?.[0]||'',mainCollectionDelete=main.match(/ipcMain\.handle\('collection:remove'[\s\S]*?\n\}\);/)?.[0]||'';assert.match(tagHelper,/reconcileActive=Boolean\(state\.smartFolderId&&currentSmartFolderDependsOnTags\(\)\)/);assert.match(tagHelper,/previousIndices=reconcileActive\?\[\.\.\.currentViewIndices\(\)\]/);assert.match(tagHelper,/snapshotAssetForMetadataDelta/);assert.match(tagHelper,/applyMetadataViewDelta\(changes,\{previousIndices,reconcileActive\}\)/);assert.doesNotMatch(tagHelper,/renderGrid|reconcileThumbnailCards/);assert.match(renderer,/indices=view\?\.ready\?\[\.\.\.view\.indices\]:previousIndices\?\[\.\.\.previousIndices\]/);assert.doesNotMatch(collectionDelete,/renderGrid|reconcileThumbnailCards/);assert.match(collectionDelete,/renderSidebar\(false\)/);assert.match(mainCollectionDelete,/broadcastSidebar\(\)/);assert.doesNotMatch(mainCollectionDelete,/broadcast\(\)/);
});

test('large navigation paints a bounded preview before final results and patches metadata in place',()=>{
  assert.match(renderer,/indices=view\.ready\?view\.indices:view\.previewIndices/);assert.match(renderer,/onPreview:[^\n]*renderGrid/);assert.match(renderer,/onAssetsPatched/);assert.match(preload,/onAssetsPatched/);assert.match(main,/function broadcastAssetPatches/);const hashes=main.match(/async function warmContentHashes[\s\S]*?\n\}/)?.[0]||'';assert.match(hashes,/broadcastAssetPatches/);assert.doesNotMatch(hashes,/broadcast\(\)/);
});

test('thumbnail rotation patches affected cards without rebuilding the grid',()=>{
  assert.match(renderer,/function patchRotatedThumbnail/);
  assert.match(renderer,/preview\.classList\.toggle\('quarter-turned',quarterTurn\)/);
  assert.match(renderer,/card\.style\.setProperty\('--asset-ratio',ratio\)/);
  assert.match(renderer,/batchUpdateAssets\(ids,\{rotateBy:direction\},\{silent:true,returnAssets:true\}\)/);
  assert.match(renderer,/patchRotatedThumbnail\(asset\)/);
  const helper=renderer.match(/async function rotateThumbnailsWithoutGridRefresh[\s\S]*?\n\}/)?.[0]||'';
  assert.doesNotMatch(helper,/renderGrid\(/);
  assert.match(helper,/scheduleVirtualLayoutRefresh\(anchor\)/);
});

test('Ctrl-click deselection clears stale borders and repaints only changed thumbnail cards',()=>{
  assert.match(renderer,/function paintCardSelection/);
  assert.match(renderer,/card\.setAttribute\('aria-selected',String\(selected\)\)/);
  assert.match(renderer,/if\(state\.selectedIds\.has\(id\)\)\{state\.selectedIds\.delete\(id\);state\.selectedId=state\.selectedIds\.values\(\)\.next\(\)\.value\|\|null/);
  assert.match(renderer,/paintChangedSelectionCards\(\[previousPrimary,id,state\.selectedId\]\)/);
  assert.match(renderer,/scheduleSelectionInspector\(\);scheduleThumbnailViewportSweep\(\);return/);
  const ctrlBranch=renderer.match(/if \(event\.ctrlKey \|\| event\.metaKey\) \{[\s\S]*?scheduleThumbnailViewportSweep\(\);return;\n  \}/)?.[0]||'';
  assert.doesNotMatch(ctrlBranch,/filteredAssets\(/);
  assert.doesNotMatch(ctrlBranch,/updateCardSelectionStyles\(/);
  assert.doesNotMatch(ctrlBranch,/renderInspector\(/);
});

test('collection assignment and multi-selection context actions preserve batch intent', () => {
  assert.match(renderer, /application\/x-pigeon-assets/);
  assert.doesNotMatch(renderer, /title: 'Move Assets'/);
  assert.match(renderer, /addAssetsToCollectionWithoutGridRefresh\(ids,target,origin\.collectionId\)/);
  assert.match(renderer, /removeSelectedFromCurrentCollection/);
  assert.match(renderer, /data-context-action="remove-from-collection"/);
  assert.match(renderer, /event\.key === 'Delete' && !isInternalViewerOpen\(\)/);
  assert.match(renderer,/\{removeCollectionId:collectionId\}/);
  assert.match(renderer, /if \(!state\.selectedIds\.has\(id\)\) state\.selectedIds/);
  assert.match(renderer,/updateAssetsWithoutGridRefresh\(selectedIds/);
  assert.doesNotMatch(renderer, /data-context-action="crop"/);
  assert.match(renderer, /selectedImageIds/);
  assert.match(renderer, /Rotate \$\{selectedImageIds\.length\} images/);
  assert.match(renderer, /rotationTargetLabel \+ ' left/);
  assert.match(renderer, /rotationTargetLabel \+ ' right/);
  assert.match(renderer, /rotateThumbnailsWithoutGridRefresh\(selectedImageIds/);
  assert.match(libraryCore, /Object\.hasOwn\(operation, 'rotateBy'\)/);
});

test('internal viewer has lightweight context actions, keyboard close, compact footer and wheel zoom', () => {
  assert.match(html, /<section id="media-viewer"/);
  assert.doesNotMatch(html, /<dialog id="media-viewer"/);
  assert.match(html,/id="close-viewer" class="viewer-close-button"/);
  assert.match(renderer,/\$\('#close-viewer'\)\.addEventListener\('click',closeInternalViewer\)/);
  assert.doesNotMatch(html,/id="viewer-edit-toolbar"/);
  assert.doesNotMatch(html,/id="viewer-title"/);
  assert.match(html, /id="viewer-fit"/);
  assert.match(renderer,/showViewerContextMenu/);
  assert.match(renderer,/data-viewer-action/);
  assert.match(renderer,/viewer-hidden-filter/);
  assert.match(renderer,/\['Escape','Enter'\]\.includes\(event\.key\)/);
  assert.match(renderer,/event\.code === 'Space'/);
  assert.match(renderer,/viewerZoom/);
  assert.match(renderer,/\.viewer-stage'\)\.addEventListener\('wheel'/);
  assert.match(html,/id="viewer-image-surface"/);assert.match(renderer,/renderPixelatedSurface\(\$\('#viewer-image-surface'\),elements\.viewerImage/);assert.match(renderer,/host\.id==='viewer-image-surface'\?\{left:'0',top:'0',width:'100%',height:'100%'\}/);assert.match(renderer,/Math\.abs\(next-oldScale\)<1e-9\)return/);assert.match(renderer,/viewerPanStart=\{x:event\.clientX,y:event\.clientY,panX:viewerPan\.x/);assert.match(renderer,/function clampViewerPan/);assert.match(styles,/\.viewer-image-surface\{/);assert.match(styles,/\.media-viewer\.full-view \.viewer-stage img[^}]*object-fit:fill/);assert.doesNotMatch(styles,/\.media-viewer\.full-view \.viewer-stage img[^}]*object-fit:\s*none/);
  assert.match(styles,/\.media-viewer footer \{ height:28px/);
  assert.match(styles,/\.viewer-stage \{ height:calc\(100% - 28px\)/);
});

test('preferences provide local-first pages and persistent functional controls', () => {
  for (const page of ['general','sidebar','controls','preview','screenshot','shortcuts','notifications','password','auto-import','ai-search','ai-models','mcp','developer']) assert.match(html, new RegExp(`data-preference-page="${page}"`));
  assert.match(renderer, /applyPreferences/);
  assert.match(renderer, /pigeon\.preferences/);
  assert.match(preload, /updatePreferences/);
  assert.match(main, /preferences:update/);
  assert.match(styles, /preferences-shell/);
});

test('media protocol implements thumbnails and byte ranges for seekable local playback', () => {
  assert.match(main, /createVideoThumbnail/);
  assert.match(main, /startMediaServer/);assert.match(main,/Readable\.toWeb\(stream\)/);
  assert.match(main, /streamable = asset\.kind === 'video' \|\| asset\.kind === 'audio'/);
  assert.match(mediaStream, /Content-Range/);
  assert.match(mediaStream, /fs\.createReadStream\(source,\{start,end\}\)/);
  assert.doesNotMatch(mediaStream,/request\.on\('close'/);assert.match(mediaStream,/response\.once\('close'/);
  assert.match(main, /\.preview\.mp4/);
  assert.match(main, /libx264/);
  assert.match(main, /aes-256-gcm/);
  assert.match(main, /pbkdf2Sync/);
  assert.match(main, /duplicateAsset/);
  assert.match(imageDerivative,/pipeline\.extract/);
  assert.match(main, /ffmpegExecutable/);
  assert.match(main, /'-threads', '1'/);
  assert.match(main, /PriorityClass = 'BelowNormal'/);
  assert.match(main, /videoPreparationJobs\.has\(key\)/);
  assert.match(main, /\.partial\.mp4/);
  assert.match(main, /probeVideoDuration/);
  assert.match(main, /warmCompatibilityVideoCache/);
  assert.match(main, /proxyVersion === 3/);
  assert.doesNotMatch(renderer, /ensurePlayable\(id, \{ stream: true \}\)/);
  assert.doesNotMatch(html, /id="viewer-video"[^>]*\sautoplay/);
  assert.match(main, /scale=960:540:force_original_aspect_ratio=decrease/);
  assert.match(main, /await fsp\.rename\(partialPath, proxyPath\)/);
  assert.match(renderer, /recoverViewerVideo/);
  assert.match(renderer, /recoverInspectorVideo/);
  assert.match(renderer, /viewer-video-status/);
  assert.match(main, /watcherRefreshTimers/);
  assert.match(main, /scanProgress/);
  assert.match(main, /partialScan/);
  assert.match(main, /deferHash/);
  assert.match(main, /location\.unstable \? 2/);
  assert.match(main, /location\.scanning = false; location\.checking = false/);
  assert.match(main, /if \(asset\.kind === 'video'\) return !asset\.thumbnailPath \|\| !asset\.width \|\| !asset\.height \|\| !asset\.duration/);
  assert.match(renderer, /viewerVideo\.addEventListener\('error'/);
  assert.match(main, /status: 206/);
  assert.match(main, /content-range/);
  assert.match(main, /accept-ranges/);
});

test('asset duplication copies its preview and incrementally inserts and resorts one card',()=>{
  const duplicateSource=main.slice(main.indexOf('async function duplicateAsset'),main.indexOf('async function applyInlineCrop'));
  assert.match(main,/async function copyDuplicatePreview/);assert.match(main,/fsp\.copyFile\(source\.thumbnailPath,thumbnailTarget\)/);assert.match(duplicateSource,/watcherIgnoreUntil\.set/);assert.match(duplicateSource,/broadcastLocations\(\)/);assert.doesNotMatch(duplicateSource,/\bbroadcast\(\)/);assert.match(renderer,/function stageDuplicatedAssetCard/);assert.match(renderer,/cloneNode\(true\)/);assert.match(renderer,/async function duplicateAssetsWithoutGridRefresh/);assert.match(renderer,/reconcileThumbnailCards\(added,\{sidebar:false\}\)/);assert.match(renderer,/duplicateAssetsWithoutGridRefresh\(selectedIds\)/);
});

test('ordinary thumbnail drags are internal moves, while Alt-drag exports to other applications',()=>{
  assert.match(renderer,/application\/x-pigeon-origin/);
  assert.match(renderer,/nativeDrag=event\.altKey/);
  assert.match(renderer,/setDragImage\(ghost,36,36\)/);
  assert.match(renderer,/effectAllowed='copyMove'/);
  assert.match(renderer,/function libraryAssetIdsForPaths/);
  assert.match(renderer,/existingIds\.length===paths\.length/);
  assert.match(renderer,/movesLibraryAssets=internal\|\|paths\.length>0&&existingIds\.length===paths\.length/);
  assert.match(renderer,/removeCollectionId:sourceCollectionId/);
  assert.match(renderer,/moveAssetsToFolder/);
  assert.match(preload,/moveAssetsToFolder:/);
  assert.match(main,/assets:move-to-folder/);
  assert.match(main,/await fsp\.rename\(source,target\)/);
  assert.match(renderer,/reconcileThumbnailCards\(ids(?:,\{viewport\})?\)/);
  const collectionMove=renderer.match(/async function addAssetsToCollectionWithoutGridRefresh[\s\S]*?\n\}/)?.[0]||'';
  assert.doesNotMatch(collectionMove,/renderGrid\(/);
  const physicalDrop=renderer.match(/const enablePhysicalFolderDrop[\s\S]*?\n    \};/)?.[0]||'';
  assert.match(physicalDrop,/moveCollectionToFolder/);
});

test('collection drops replicate hierarchy and move files into indexed physical folders',()=>{
  assert.match(renderer,/application\/x-pigeon-collection/);assert.match(renderer,/Creating \$\{source\.name\} folder hierarchy/);assert.match(renderer,/window\.pigeon\.moveCollectionToFolder\(collectionId,row\.dataset\.locationId,subfolder\)/);
  assert.match(preload,/moveCollectionToFolder:/);assert.match(main,/collection:move-to-folder/);assert.match(main,/planCollectionFolderTransfer/);assert.match(main,/collection-folder-move:/);assert.match(main,/for\(const directory of plan\.directories\)\{report\(`Creating folder/);assert.match(main,/Moving file \$\{fileIndex\.toLocaleString\(\)\} of/);assert.match(main,/total=plan\.directories\.length\+plan\.files\.length/);assert.match(main,/moveAssetFiles\(\[entry\.assetId\],entry\.directory,\{locationId,decisionScope\}\)/);assert.match(main,/settings\.emptyFolders/);assert.match(main,/Unlock every protected collection/);
  assert.equal(fs.existsSync(path.join(root,'electron','collection-folder-transfer.js')),true);
});

test('refresh, robust facets, folder drops, media hover scrubbing, and expanded formats are wired', () => {
  assert.match(html, /id="refresh-button"/);
  assert.match(preload, /refreshSources:/);
  assert.match(main, /library:refresh-sources/);
  assert.match(main, /staleAssets/);
  assert.match(renderer, /sourceStatusChanged/);
  assert.match(renderer,/if\(sourceStatusChanged\)\{invalidateLibraryAggregates\(\);renderSidebar\(false\);for\(const card/);assert.doesNotMatch(renderer,/if\(sourceStatusChanged\)\{[^\n]*renderGrid/);
  assert.match(renderer, /rating: 'ratings', shape: 'shapes', color: 'colors'/);
  assert.match(renderer, /attachHoverMediaPreview/);
  assert.match(renderer, /media\.currentTime = desiredTime/);
  assert.match(html, /data-pref="videoHoverPreview"/);
  assert.match(html, /data-pref="audioHoverPreview"/);
  assert.match(main, /createAudioThumbnail/);
  assert.match(main, /showwavespic/);
  for (const extension of ['.af', '.psd', '.pdf', '.pspimage', '.ogg', '.mp3', '.wav']) assert.match(`${main}\n${fileTypesSource}`, new RegExp(extension.replace('.', '\\.')));
  assert.match(renderer, /enablePhysicalFolderDrop/);
  assert.match(renderer, /collectionId:\s*target\.id/);
  assert.match(main, /target\.locationId/);
  assert.match(main, /target\.collectionId/);
  assert.match(renderer, /data-title-field="dimensions"/);
  assert.match(main, /dimensions = videoLine\.match/);
  assert.match(icons, /layout:/);
  assert.match(icons, /inspector:/);
  assert.match(styles, /thumbnail-hover-media/);
});

test('sidebar trees share one scroller and preview failures terminate cleanly', () => {
  assert.match(html,/id="sidebar-tree-scroll"/);
  assert.match(styles,/\.sidebar-tree-scroll \{[^}]*overflow-y:auto/);
  assert.match(styles,/\.collection-list, #smart-folder-list \{ max-height:none; overflow:visible/);
  assert.match(styles,/\.location-list \{[^}]*overflow:visible/);
  assert.match(styles, /scrollbar-color:transparent transparent/);
  assert.match(styles, /\.asset-preview-failed/);
  assert.match(main, /thumbnailPreparationJobs/);
  assert.match(main, /Preview generation timed out/);
  assert.match(main, /thumbnailFailedModified === asset\.modified/);
  assert.match(main, /failed:\s*true/);
  assert.match(renderer, /Preview unavailable/);
  assert.match(renderer, /asset\.thumbnailPath \? asset\.previewUrl : asset\.mediaUrl/);
});

test('native PDF canvas is isolated from Pigeon main process',()=>{
  assert.match(main,/utilityProcess\.fork/);
  assert.match(main,/pdf-thumbnail-child\.js/);
  assert.match(main,/Isolated PDF preview process exited/);
  assert.doesNotMatch(packageJson,/"@napi-rs\/canvas"/);
  assert.match(fs.readFileSync(path.join(root,'electron','pdf-thumbnail-child.js'),'utf8'),/require\.resolve\('@napi-rs\/canvas'/);
});

test('all catchable unhandled exceptions are persisted across Electron processes',()=>{
  assert.match(main,/uncaughtExceptionMonitor/);
  assert.match(main,/main:unhandledRejection/);
  assert.match(main,/fatal-errors\.jsonl/);
  assert.match(main,/writeFatalDiagnostic/);
  assert.match(main,/ipcMain\.handle=\(channel,handler\)/);
  assert.match(main,/Unhandled IPC exception/);
  assert.match(main,/messageerror/);
  assert.match(main,/preload-error/);
  assert.match(main,/did-fail-load/);
  assert.match(main,/window-unresponsive/);
  assert.match(main,/webContents\.on\('console-message', \(event\)/);
  assert.doesNotMatch(main,/console-message', \(_event, details\)/);
  assert.match(preload,/preload:uncaughtException/);
  assert.match(preload,/preload:unhandledRejection/);
  assert.match(preload,/reportFatal:/);
  assert.match(renderer,/renderer:unhandledrejection/);
  assert.match(renderer,/renderer:error/);
  assert.match(renderer,/securitypolicyviolation/);
});

test('large indexing applies system-stability backpressure and crash recovery', () => {
  assert.match(main,/PDF_WORKER_LIMIT = 1/);
  assert.match(main,/LARGE_SCAN_WORKER_LIMIT = 2/);
  assert.match(main,/MIN_FREE_MEMORY_BYTES/);
  assert.match(main,/availableMemoryBytes\(\)/);
  assert.match(systemResources,/os\.freemem\(\)/);
  assert.match(systemResources,/vm_stat/);
  assert.match(main,/await worker\.terminate\(\)/);
  assert.match(main,/scanWorkActive/);
  assert.match(main,/waitForScanIdle/);
  assert.match(main,/resourceLimits: \{ maxOldGenerationSizeMb: 128 \}/);
  assert.match(main,/crashReporter\.start/);
  assert.match(main,/child-process-gone/);
  assert.match(main,/render-process-gone/);
  assert.match(database,/VACUUM INTO/);
  assert.match(main,/pigeon-\$\{reason\}-\$\{stamp\}\.db/);
  const backupImplementation=main.match(/async function writeBackup[\s\S]*?\n\}/)?.[0]||'';
  assert.doesNotMatch(backupImplementation,/serializeLibrary/);
  assert.match(main,/if\(scanWorkActive\(\)\)throw new Error\('Backup deferred until indexing completes'\)/);
  assert.match(main,/scheduleDeltaFlush/);
  assert.match(main,/persistAssetBatch/);
  assert.match(main,/utilityProcess\.fork/);
  assert.match(main,/databaseSaveInFlight/);
  assert.match(main,/pendingDatabaseSnapshot/);
  assert.match(main,/saveScanQueue/);
  assert.match(main,/loadScanQueue/);
  assert.match(main,/scan-queues/);
  assert.doesNotMatch(main,/scanCheckpoint = \{ root: location\.path, filePaths/);
  assert.match(main,/Date\.now\(\) - lastCheckpointAt >= 5000/);
  assert.match(main,/persistScanBatch/);
  assert.match(main,/save-batch/);
});

test('indexing keeps main and renderer interaction paths responsive', () => {
  assert.match(renderer,/function updateLocationProgressUI/);
  assert.match(renderer,/if\(structureChanged\)/);
  assert.match(renderer,/requestIdleCallback/);
  assert.match(renderer,/lastUserInteractionAt/);
  assert.match(renderer,/if\(done\).*scheduleScanGridRender/);
  assert.match(renderer,/else if\(wasEmpty&&result\.added\)scheduleScanGridRender/);
  assert.match(renderer,/view\.forceFreshCards=true/);
  assert.match(renderer,/!view\.forceFreshCards&&/);
  assert.match(renderer,/rendererAssetIndexes/);
  assert.match(renderer,/onScanAssets/);
  assert.match(preload,/onScanAssets/);
  assert.match(main,/broadcastScanAssets/);
  assert.match(main,/assetIndexes=new Map/);
  assert.match(main,/locationAssetCount/);
  assert.match(main,/let cursor=0/);
  assert.match(main,/scanLocation\(location\.id, \{ notify: true \}\)/);
  assert.doesNotMatch(main,/jobLibrary\.assets\.findIndex\(\(item\) => item\.id === asset\.id\)/);
  assert.doesNotMatch(main,/location\.assetCount = jobLibrary\.assets\.filter/);
  assert.doesNotMatch(renderer,/state\.library\.assets\.filter\(\(item\) => item\.stackId === asset\.stackId/);
  assert.match(renderer,/similarityRefreshPromise/);
  assert.match(renderer,/Date\.now\(\)-lastSimilarityRefreshAt<5000/);
  assert.match(main,/Date\.now\(\) - lastCheckpointAt >= 5000/);
  assert.match(main,/scheduleBroadcast\(250\)/);
});

test('huge folder trees are worker-built and bounded, console resizes/fullscreens, and laptop-safe threads are enforced', () => {
  assert.match(html, /class="nav-item" data-view="untagged"/);
  for (const id of ['diagnostics-resizer','diagnostics-fullscreen']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(preload,/buildFolderTree/);
  assert.match(main,/folder-tree:build/);
  assert.match(main,/MAX_BACKGROUND_THREADS = 4/);
  assert.match(renderer,/folderTreeLimits/);
  assert.match(renderer,/Show \$\{Math\.min\(500/);
  assert.match(renderer,/pigeon\.consoleHeight/);
  assert.match(styles,/diagnostics-console\.fullscreen/);
  assert.match(styles,/cursor:ns-resize/);
});

test('left panel item visibility context menu and inspector preview collapse are wired',()=>{
  for(const id of ['primary-library-nav','inspector-preview-section','toggle-inspector-preview','asset-palette'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(renderer,/primarySidebarItems/);
  assert.match(renderer,/showPrimarySidebarContextMenu/);
  assert.match(renderer,/data-toggle-sidebar-item/);
  assert.match(renderer,/applyPrimarySidebarVisibility/);
  assert.match(renderer,/clickEvent\.stopPropagation\(\)/);
  assert.match(renderer,/class="menu-check"/);
  assert.match(styles,/\.app-menu\.sidebar-visibility-menu \{ width:158px/);
  assert.match(styles,/grid-template-columns:minmax\(0,1fr\) 16px/);
  assert.match(renderer,/showUntagged: true/);
  assert.match(renderer,/showAnalytics: true/);
  for(const preference of ['showAll','showRecent','showOffline','showFiveStars'])assert.match(renderer,new RegExp(`${preference}:true`));
  for(const [view,key] of [['all','showAll'],['recent','showRecent'],['offline','showOffline'],['five-stars','showFiveStars']])assert.match(renderer,new RegExp(`\\['${view}'[^\\n]+ '${key}'|\\['${view}'[^\\n]+'${key}'`));
  assert.match(renderer,/role="menuitemcheckbox" aria-checked=/);
  const visibilityMenu=renderer.slice(renderer.indexOf('function showPrimarySidebarContextMenu'),renderer.indexOf('function showToast'));
  assert.match(visibilityMenu,/localStorage\.setItem\('pigeon\.preferences'/);assert.doesNotMatch(visibilityMenu,/selectView\(|selectedId|selectedIds/);
  assert.match(renderer,/for\(const target of \[\$\('#primary-library-nav'\),\$\('\.brand-menu'\)\]\)target\.addEventListener\('contextmenu'/);
  const analyticsAt=html.indexOf('data-view="analytics"'),recentAt=html.indexOf('data-view="recent"'),offlineAt=html.indexOf('data-view="offline"'),fiveStarsAt=html.indexOf('data-view="five-stars"'),smartFoldersAt=html.indexOf('data-section-toggle="smart-folders"');
  assert.ok(analyticsAt<recentAt&&recentAt<offlineAt&&offlineAt<fiveStarsAt&&fiveStarsAt<smartFoldersAt);
  for(const label of ['Recently Added','Offline Sources','Five Stars'])assert.equal((html.match(new RegExp(label,'g'))||[]).length,1);
  assert.match(renderer,/pigeon\.inspectorPreviewCollapsed/);
  assert.match(styles,/\.inspector-preview-section\.collapsed \.preview-card \{ display:none/);
  assert.doesNotMatch(styles,/\.inspector-preview-section\.collapsed \.color-row/);
});

test('appearance typography, unclipped portfolio switcher, and PDF previews are wired', () => {
  assert.match(html, /data-preference-page="appearance"/);
  for (const preference of ['appFontFamily','appFontSize','consoleFontFamily','consoleFontSize']) assert.match(html, new RegExp(`data-pref="${preference}"`));
  assert.match(renderer, /applyTypographyPreferences/);
  assert.match(renderer, /--app-font-scale', String\(appFontSize\/12\)/);
  assert.match(styles, /--app-font-family/);
  assert.match(styles, /--app-font-size: 13px/);
  assert.match(styles, /--app-font-scale: 1\.0833333333/);
  assert.match(renderer, /appFontSize: 13/);
  assert.match(styles, /\.nav-item \{[^}]*font-size:calc\(11\.5px \* var\(--app-font-scale\)\)/);
  assert.match(styles, /\.card-title-line \{[^}]*font-size:calc\(9\.5px \* var\(--app-font-scale\)\)/);
  assert.match(styles, /\.about-license-text \{[^}]*font:calc\(11\.5px \* var\(--app-font-scale\)\)\/1\.62/);
  assert.match(styles, /--console-font-family/);
  assert.match(styles, /\.portfolio-switcher \{ position: fixed/);
  assert.match(main, /pdf-thumbnail-child\.js/);
  assert.match(main, /Pigeon PDF preview/);
});

test('sidebar keyboard navigation, recursive exports, and update checks are wired', () => {
  assert.match(styles, /overflow-x:hidden; overflow-y:auto/);
  assert.match(styles, /height:0/);
  assert.match(renderer, /handleSidebarTreeKeys/);
  assert.match(renderer, /ArrowDown/);
  assert.match(renderer, /Export Referenced Files/);
  assert.match(renderer, /Export Smart Folder/);
  assert.match(renderer, /Check for Updates/);
  assert.match(preload, /exportGroup/);
  assert.match(preload, /checkForUpdates/);
  assert.match(main, /library:export-group/);
  assert.match(main, /app:check-for-updates/);
  assert.match(main, /autoUpdater\.downloadUpdate/);
  assert.match(main,/autoUpdater\.on\('download-progress',onDownloadProgress\)/);assert.match(main,/Downloading Pigeon \$\{version\}/);assert.match(main,/formatUpdateBytes\(latest\.transferred\)/);assert.match(main,/completed:latest\.transferred,total:latest\.total/);assert.match(main,/autoUpdater\.removeListener\('download-progress',onDownloadProgress\)/);assert.match(main,/Update download failed/);
});

test('telemetry console and resumable CPU-limited parallel indexing are wired', () => {
  for (const id of ['telemetry-panel','telemetry-summary','telemetry-list']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-console-tab="telemetry"/);
  assert.match(preload, /getTelemetry/);
  assert.match(main, /telemetry:get/);
  assert.match(main, /INDEX_CPU_LIMIT = 20/);
  assert.match(main, /INDEX_WORKER_COUNT/);
  assert.match(main, /scan-worker\.js/);
  assert.match(main, /scanCheckpoint/);
  assert.match(main, /resumePendingScans/);
  assert.match(main, /waitForIndexCpuBudget/);
  assert.match(renderer, /renderTelemetry/);
  assert.match(renderer, /setInterval\(refreshTelemetry, 1000\)/);
  assert.match(styles, /telemetry-summary/);
});

test('diagnostics controls and cross-portfolio grouping transfer are wired', () => {
  for (const id of ['diagnostics-copy-all','portfolio-transfer','portfolio-transfer-list','portfolio-transfer-move','portfolio-transfer-move-description','confirm-portfolio-transfer','batch-portfolio']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(preload, /removeDiagnostic/);
  assert.match(preload, /transferToPortfolio/);
  assert.match(main, /diagnostics:remove/);
  assert.match(main, /portfolio:transfer/);
  assert.match(main, /excludedFolders/);
  assert.match(main, /type === 'assets'/);
  assert.match(main, /stageAssetFiles/);
  assert.match(main, /temporaryTransfer: true/);
  assert.match(main, /asset\.deletedAt = asset\.deletedAt \|\| deletedAt/);
  assert.match(renderer, /Copy \/ move selected to portfolio/);
  assert.match(renderer, /batch-portfolio/);
  assert.match(renderer, /data-copy-diagnostic/);
  assert.match(renderer, /data-remove-diagnostic/);
  assert.match(renderer, /diagnostics-copy-all/);
  assert.match(renderer, /Add to other portfolio/);
  assert.match(renderer, /openPortfolioTransfer/);
  assert.match(styles, /--tree-step: 18px/);
  assert.match(styles, /--sidebar-width: 275px/);
  assert.match(styles, /border-left:1px solid #4d5561/);
});

test('SQLite persistence replaces library.json with automatic migration', () => {
  const database = fs.readFileSync(path.join(root, 'electron', 'database.js'), 'utf8');
  assert.match(database, /DatabaseSync/);
  assert.match(database, /PRAGMA journal_mode = WAL/);
  assert.match(database, /BEGIN IMMEDIATE/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS assets/);
  assert.match(database, /importLegacyJson/);
  assert.match(main, /database-worker\.js/);
  assert.match(main, /library\.db/);
  assert.doesNotMatch(main, /saveDataFile/);
  assert.doesNotMatch(main, /fsp\.writeFile\(saveDataFile/);
  assert.match(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), /embedded SQLite database/);
});

test('tree rows retain readable labels and diagnostics dock inline', () => {
  assert.match(styles, /grid-template-columns:14px 20px minmax\(0,1fr\) 40px/);
  assert.match(styles, /text-overflow:ellipsis/);
  assert.match(styles, /font-variant-numeric:tabular-nums/);
  assert.match(styles, /\.diagnostics-console \{ grid-row:4; position:relative/);
  assert.match(styles, /\.statusbar \{ grid-row: 5/);
  assert.doesNotMatch(styles, /\.diagnostics-console \{ position:fixed/);
  const mainStart = html.indexOf('<main class="main-panel">'), mainEnd = html.indexOf('</main>', mainStart), diagnosticsPosition = html.indexOf('id="diagnostics-console"');
  assert(diagnosticsPosition > mainStart && diagnosticsPosition < mainEnd);
});

test('portfolio-scoped threaded background work and diagnostics are wired', () => {
  assert.match(main, /async function cancelPortfolioBackground/);
  assert.match(main, /backgroundEpoch \+= 1/);
  assert.match(main, /THUMBNAIL_WORKER_COUNT/);
  assert.match(main, /BACKGROUND_HASH_WORKERS/);
  assert.match(main, /retryBackground/);
  assert.match(main, /baseDelay \* 2 \*\* attempt/);
  assert.match(main, /hash-worker\.js/);
  assert.match(main, /diagnostics:get/);
  assert.match(main, /diagnostics:log/);
  assert.match(main, /render-process-gone/);
  assert.match(preload, /getDiagnostics/);
  assert.match(preload, /onDiagnostic/);
  assert.match(renderer, /openDiagnosticsConsole/);
  assert.match(renderer, /terminal=Boolean\(task\.done\)\|\|\['completed','failed','warning'\]\.includes\(task\.status\)/);
  assert.match(main,/background-threads:set-paused/);assert.match(main,/waitForBackgroundThread/);assert.match(preload,/setAllBackgroundThreadsPaused/);
  for (const id of ['diagnostics-console','diagnostics-list','diagnostics-clear','diagnostics-open-file']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(styles, /\.diagnostics-console/);
  assert.equal(fs.existsSync(path.join(root, 'electron', 'hash-worker.js')), true);
});

test('password protection immediately hides collection and physical-folder descendants until temporary unlock',()=>{
  assert.match(main,/function collectionAncestors/);
  assert.match(main,/collectionAncestors\(id\)\.some/);
  assert.match(main,/unlockedCollections\.delete\(id\)/);
  assert.match(main,/unlockedFolders\.clear\(\)/);
  assert.match(main,/folder:set-password/);
  assert.match(main,/folder:unlock/);
  assert.match(main,/folder:unlock[^\n]*folderLocks\(\)\.filter/);
  assert.match(main,/folder:unlock[^\n]*if\(!rule\)return false/);
  assert.match(main,/folder:remove-password[^\n]*folderLocks\(\)\.filter/);
  assert.match(renderer,/effectiveFolderLockRule\(request\.locationId,request\.subfolder\)/);
  assert.match(main,/folder:lock-now/);assert.match(main,/function lockVisibilityResult/);assert.match(main,/return lockVisibilityResult\(\)/);assert.doesNotMatch(main,/folder:lock-now'[^\n]*broadcast\(\)/);assert.doesNotMatch(main,/collection:lock-now'[^\n]*broadcast\(\)/);assert.match(renderer,/function applyLockVisibilityResult/);
  assert.match(main,/matchingFolderLocks\(asset\)/);
  assert.match(main,/matchingFolderLockRules\(asset,folderLocks\(\),library\.locations\)/);
  assert.match(main,/folderLocks:publicFolderLocks\(\)/);
  assert.match(main,/settings:\{\.\.\.settings,folderLocks:publicFolderLocks\(\)\}/);
  assert.match(renderer,/onLibraryChanged\(\(library\) => \{\s*hideInternalViewer\(\)/);
  assert.match(renderer,/viewerImage\.removeAttribute\('src'\)/);
  assert.match(preload,/setFolderPassword/);
  assert.match(preload,/unlockFolder/);
  assert.match(renderer,/effectiveFolderLockRule/);
  assert.match(renderer,/Password protect folder/);
  assert.match(renderer,/lockFolderNow/);
  assert.match(renderer,/collection\.lockSourceId\|\|collection\.id/);
  assert.match(renderer,/folderLocked/);
});

test('folder and collection context menus expose consistent hierarchy and destructive actions',()=>{
  const locationMenu=renderer.match(/function showLocationContextMenu[\s\S]*?function activateSidebarTreeRow/)?.[0]||'',collectionMenu=renderer.match(/function showCollectionContextMenu[\s\S]*?const mapTiles/)?.[0]||'',assetMenu=renderer.match(/function showAssetContextMenu[\s\S]*?function setSidebarSectionExpanded/)?.[0]||'';
  assert.ok(locationMenu.indexOf('data-location-action="new-subfolder"')<locationMenu.indexOf('data-location-action="contact-sheet"'));assert.match(locationMenu,/createPhysicalSubfolder/);assert.match(renderer,/async function ensureFolderUnlocked\(location,subfolder=''\)/);assert.match(main,/folder-move:/);assert.match(main,/Moving files on disk/);assert.match(main,/Updating indexed file references/);assert.match(main,/pauseSupported:false/);assert.match(preload,/createPhysicalSubfolder/);assert.match(main,/folder:create-physical/);assert.match(locationMenu,/data-location-action="delete"/);assert.match(locationMenu,/Delete Folder/);assert.match(renderer,/function selectPhysicalFolder\(event,locationId,subfolder=''\)/);assert.match(renderer,/visiblePhysicalFolderKeys\(\)/);assert.match(renderer,/topLevelSelectedPhysicalFolders/);assert.match(renderer,/Delete \$\{selectedTargets\.length\} Selected Folders/);assert.match(styles,/location-folder-item\.multi-selected/);assert.match(preload,/deletePhysicalFolder/);assert.match(main,/folder:delete-physical/);assert.match(locationMenu,/View Analytics/);assert.match(collectionMenu,/View Analytics/);assert.doesNotMatch(`${locationMenu}${collectionMenu}`,/View (?:Folder|Collection) Analytics/);assert.ok(assetMenu.indexOf('remove-from-collection')<assetMenu.indexOf('Move reference to trash'));assert.doesNotMatch(assetMenu,/remove-from-collection[\s\S]{0,180}<hr/);
});

test('folder, collection, and Smart Folder collapse paints immediately before reconciliation',()=>{
  assert.match(renderer,/function paintFolderCollapseImmediately/);assert.match(renderer,/function toggleFolderCollapsed\(key\) \{ const collapsed=!isFolderCollapsed\(key\);paintFolderCollapseImmediately\(key,collapsed\);setFolderCollapsed\(key,collapsed\)/);assert.match(renderer,/function setHierarchyGroupCollapsed/);assert.match(renderer,/data-folder-lock/);assert.doesNotMatch(renderer,/data-total-collapse-key/);assert.match(renderer,/addEventListener\('click',[\s\S]{0,420},true\)/);assert.match(renderer,/control\.textContent=collapsed\?'＋':'−'/);assert.match(renderer,/sibling\.hidden=collapsed\|\|blockedDepth!==null/);assert.match(renderer,/ancestorHidden\|\|collapsed/);assert.match(renderer,/location-subfolder-list" \$\{rootCollapsed\?'hidden':''\}/);assert.doesNotMatch(renderer,/deferredHierarchyRenderFrame/);
});

test('show content from subfolders includes nested physical folders and collections but defaults off',()=>{
  assert.match(renderer,/includeSubfolderContent: localStorage\.getItem\('pigeon\.includeSubfolderContent'\) === 'true'/);assert.match(renderer,/collectionBranchIds\(state\.collectionId\)/);assert.match(renderer,/collectionIds\.has\(id\)/);assert.match(renderer,/collectionRecursiveCounts/);assert.match(renderer,/state\.includeSubfolderContent\?metrics\?\.collectionRecursiveCounts/);
});

test('nested collection trees, smart subfolders, and inline password forms are wired', () => {
  assert.match(libraryCore, /function createSmartFolder\(library, name, filters = \{\}, parentId = null\)/);
  assert.match(libraryCore, /function moveSmartFolder/);
  assert.match(main, /smart-folder:move/);
  assert.match(preload, /moveSmartFolder/);
  assert.match(renderer, /appendSmartFolders/);
  assert.match(renderer, /New Smart Subfolder/);
  assert.match(renderer, /inline-unlock-form/);
  assert.match(renderer, /activeInlinePasswordRequest/);
  assert.match(renderer, /setCollectionPassword\(request\.collectionId,input\.value/);
  assert.match(renderer, /setFolderPassword\(request\.locationId,request\.subfolder,input\.value/);
  assert.doesNotMatch(renderer, /title:\s*['`]Protect (?:Collection|Folder)/);
  for (const id of ['locked-content','inline-unlock-form','inline-unlock-password','inline-unlock-confirmation','inline-password-submit','inline-password-cancel','inline-unlock-error']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(styles, /\.locked-content/);
  assert.match(styles, /#inline-unlock-form \{ width:min\(220px,80vw\);/);
  assert.match(styles, /#inline-unlock-form\.protecting #inline-unlock-password,#inline-unlock-form\.protecting #inline-unlock-confirmation \{ grid-column:1\/-1; \}/);
  assert.match(renderer,/form\.classList\.toggle\('protecting',protecting\)/);
  assert.match(renderer,/form\.dataset\.requestSignature!==signature[^\n]*requestAnimationFrame\(\(\)=>\$\('#inline-unlock-password'\)\.focus\(\)\)/);
  assert.doesNotMatch(renderer,/elements\.status\.textContent=protecting[^\n]*requestAnimationFrame\(\(\)=>\$\('#inline-unlock-password'\)\.focus\(\)\)/);
  assert.match(renderer, /#inline-unlock-password'\)\.addEventListener\('keydown'/);
  assert.match(renderer, /#inline-unlock-confirmation'\)\.addEventListener\('keydown'/);
  assert.match(renderer, /#inline-unlock-form'\)\.requestSubmit\(\)/);
  assert.match(styles, /\.collection-item::before/);
});

test('availability refresh and inline About Pigeon view are wired', () => {
  assert.match(main, /fsp\.access\(targetPath, fs\.constants\.F_OK\)/);
  assert.doesNotMatch(main, /Test-Path -LiteralPath/);
  assert.match(renderer, /if \(location\?\.checking\) return false/);
  assert.match(renderer, /asset\?\.sourceMissing \|\| asset\?\.sourcePending \|\|/);
  for (const id of ['about-dialog','about-title','about-version','about-github']) assert.match(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(html,/<dialog id="about-dialog"/);
  assert.match(html,/about-dismiss-hint/);
  assert.match(html, /sees all/);
  assert.match(html, /Chris Visser/);
  assert.match(preload, /getAppInfo/);
  assert.match(preload, /openExternal/);
  assert.match(main, /app:info/);
  assert.match(main, /app:open-external/);
  assert.match(main, /url\.hostname !== 'github\.com'/);
  assert.match(renderer, /openAboutDialog/);
  assert.doesNotMatch(html,/<button data-menu-action="about"><span>About Pigeon<\/span><\/button>/);
  assert.match(renderer,/help: \[\['Tutorials'[\s\S]{0,240}\['About Pigeon', 'about', ''\]\]/);
  assert.match(renderer,/closeAboutView/);
  assert.match(renderer,/event\.key==='Escape'/);
  assert.match(renderer,/\$\('#about-dialog'\)\.addEventListener\('click',closeAboutView\)/);
  assert.match(icons, /github:/);
  assert.match(styles, /\.about-dialog \{ position:fixed; inset:0/);
  assert.match(html,/startup-brand about-brand/);
  assert.match(html,/id="about-title">pigeon<\/strong><span>sees all<\/span>/);
  assert.match(styles,/\.startup-brand \{ position:absolute; left:0; bottom:0/);
  assert.doesNotMatch(styles,/\.about-brand\.startup-brand/);
});

test('Preferences exposes applicable searchable feature shortcuts and wires their commands',()=>{
  for(const id of ['feature-shortcut-search','built-in-shortcut-groups','thumbnail-effect-reveal-shortcut','hover-audio-shortcut','privacy-effects-toggle-shortcut','quick-check-shortcut','show-checked-shortcut'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(renderer,/thumbnailEffectShortcut: 'W'/);assert.match(renderer,/privacyEffectsToggleShortcut: 'Alt\+W'/);
  assert.match(renderer,/defaultValue:'W'/);assert.match(renderer,/defaultValue:'Alt\+W'/);
  assert.match(renderer,/const builtInShortcutGroups=/);assert.match(renderer,/Ctrl\+Alt\+R/);assert.match(renderer,/facetShortcuts/);assert.match(renderer,/viewShortcuts/);assert.match(renderer,/Alt\+1':'grid'/);assert.match(renderer,/Ctrl\+Alt\+2/);assert.match(renderer,/renderBuiltInShortcuts/);assert.match(html,/data-preference-page="actions"/);assert.match(html,/data-preference-content="actions"/);assert.match(html,/Featured Shortcuts/);assert.doesNotMatch(html,/Portfolio Shortcuts/);
});

test('all thumbnails use the bounded retryable loader instead of an unmanaged eager path',()=>{
  assert.match(renderer,/\$\{visual\?`data-thumbnail-src=/);assert.match(renderer,/preview\.querySelector\(':scope > img\.thumbnail-loaded'\)/);assert.match(renderer,/activeThumbnailLoads\.set\(card/);assert.doesNotMatch(renderer,/thumbnail-eager/);
});

test('inspector tags sort alphabetically and cached grid nodes survive internal viewing',()=>{
  assert.match(renderer,/asset\.tags \|\| \[\]\)\]\.sort\(\(first,second\)=>first\.localeCompare/);const closeViewer=renderer.slice(renderer.indexOf('function closeInternalViewer'),renderer.indexOf('function toggleViewerFit'));assert.match(closeViewer,/elements\.grid\.classList\.remove\('hidden'\)/);assert.doesNotMatch(closeViewer,/renderGrid\(\)/);
});

test('large privacy surfaces use scaled blur and pixel mosaics',()=>{
  assert.match(renderer,/function renderPixelatedSurface/);assert.match(renderer,/bounds\.width\/320/);assert.match(renderer,/renderPixelatedSurface\(\$\('#viewer-image-surface'\)/);assert.match(renderer,/renderPixelatedSurface\(\$\('#inspector-preview-section \.preview-card'\)/);assert.match(renderer,/if\(!collapsed\)renderInspector\(\)/);assert.match(styles,/thumbnail-effect-strength\) \* 1\.5px/);assert.match(styles,/\.privacy-surface-pixel-canvas/);
});

test('preferences constrain both columns and keep navigation and actions reachable',()=>{
  assert.match(styles,/\.preferences-dialog \{ box-sizing:border-box/);assert.match(styles,/\.preferences-nav \{ min-height:0; overflow:hidden/);assert.match(styles,/\.preferences-nav nav \{ min-height:0; overflow-y:auto/);assert.match(styles,/\.preferences-main \{ min-width:0; min-height:0; height:100%; overflow:hidden/);
});

test('privacy supports true pixel mosaics and fully hidden thumbnails with reveal overrides',()=>{
  assert.match(html,/<option value="hidden">Hidden<\/option>/);assert.match(renderer,/\['blur','pixelate','hidden'\]\.includes/);assert.match(renderer,/function renderPixelatedCard/);assert.match(renderer,/canvas\.width=Math\.max\(2,Math\.ceil\(bounds\.width\/block\)\)/);assert.match(renderer,/context\.imageSmoothingEnabled=false/);assert.match(styles,/\.privacy-pixel-canvas/);assert.match(styles,/data-thumbnail-effect-mode="hidden"/);assert.match(styles,/opacity:0/);assert.match(styles,/privacy-effects-disabled[\s\S]*opacity:1!important/);
});

test('inspector privacy, Quick Check, aligned shortcuts, and developer telemetry overlay are wired',()=>{
  for(const id of ['meta-extension','developer-overlay','developer-overlay-metrics','developer-overlay-opacity','favorite-shortcut','location-shortcut'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(styles,/#meta-folder,#meta-file\{white-space:normal/);assert.match(styles,/\.asset-card\.quick-checked::before/);assert.match(styles,/\.preview-card\.privacy-effect-view|\.privacy-effect-view :is\(img,video,iframe\)/);assert.match(styles,/body\.privacy-effects-disabled \.privacy-effect-view :is\(img,video,iframe\)/);assert.match(styles,/\.shortcut-key-input\{width:150px/);assert.match(styles,/\.developer-overlay\{[^}]*right:calc\(var\(--inspector-width\) \+ 7px\)/);assert.match(styles,/\.developer-metric i\{[^}]*right:0/);assert.match(styles,/\.developer-opacity-control/);
  assert.match(renderer,/state\.showCheckedOnly/);assert.match(renderer,/asset\.quickChecked/);assert.match(renderer,/toggleQuickCheck/);assert.match(renderer,/toggleCheckedOnly/);assert.match(renderer,/toggleAllPrivacyEffects/);assert.match(renderer,/Ctrl\+Alt\+D/);assert.match(renderer,/toggleDeveloperOverlay/);assert.match(renderer,/setDeveloperOverlayOpacity/);assert.match(renderer,/pigeon\.developerOverlayOpacity/);assert.match(renderer,/queuedItems/);assert.match(renderer,/appearance:'palette'/);assert.match(renderer,/addEventListener\('dragenter',showCollectionDrop\)/);
  assert.match(libraryCore,/quickChecked: Boolean\(asset\.quickChecked\)/);assert.match(main,/'quickChecked'/);assert.match(main,/queuedItems/);
});

test('responsive tagging, search, multi-selection inspector, and right-aligned zoom controls are wired',()=>{
  assert.match(main,/function applyTagsInBackground/);assert.match(main,/options\.async&&operation\.addTags/);assert.match(renderer,/applyTagsToMatchingAssetsAsync/);assert.match(renderer,/searchRenderTimer=setTimeout/);assert.match(renderer,/searchRenderGeneration/);assert.match(styles,/\.batch-bar \{ display:none!important/);assert.match(html,/id="inspector-selection-count"/);assert.match(renderer,/data-context-action="tag"/);assert.match(renderer,/data-context-action="collection"/);assert.match(renderer,/const viewport=captureGridViewport\(\)/);assert.match(renderer,/reconcileThumbnailCards\(ids,\{viewport\}\)/);assert.match(html,/toolbar-zoom-group[\s\S]{0,1000}refresh-button/);assert.match(styles,/\.toolbar-zoom-group/);
});

test('custom shortcut actions combine configurable steps for the current selection',()=>{
  for(const id of ['new-shortcut-action','shortcut-actions-list','shortcut-action-dialog','shortcut-action-name','shortcut-action-key','shortcut-action-steps','add-shortcut-step','save-shortcut-action'])assert.match(html,new RegExp(`id="${id}"`));
  for(const label of ['Add Tags','Add to Collection','Set Rating','Add Description','Set Favourite','Clear Info'])assert.match(renderer,new RegExp(label));
  assert.match(renderer,/pigeon\.shortcutActions/);
  assert.match(renderer,/runShortcutAction/);
  assert.match(renderer,/shortcutActions\.find\(\(action\)=>action\.shortcut/);
  assert.match(renderer,/batchUpdateAssets\(ids,operationForShortcutStep/);
  assert.match(renderer,/function applyShortcutMetadataResult/);
  assert.match(renderer,/else applyShortcutMetadataResult\(step,result\)/);
  assert.match(renderer,/shortcutStepNeedsViewReconcile/);
  assert.match(libraryCore,/operation\.clearInfo/);
  assert.match(libraryCore,/Object\.hasOwn\(operation, 'note'\)/);
  assert.match(styles,/\.shortcut-action-dialog/);
});

test('Trash context menu deletes source files permanently or through the operating-system trash',()=>{
  assert.match(html,/data-pref="trashDeletionMode"/);
  assert.match(html,/Permanently delete files/);
  assert.match(html,/operating-system Recycle Bin/);
  assert.match(renderer,/trashDeletionMode: 'permanent'/);
  assert.match(renderer,/showTrashContextMenu/);
  assert.match(renderer,/data-trash-action="clear"/);
  assert.match(renderer,/showPrimarySidebarContextMenu\(event,\{trash:Boolean\(event\.target\.closest\('\[data-view="trash"\]'\)\)\}\)/);
  assert.match(preload,/emptyTrash: \(mode = 'permanent', ids = null\)/);
  assert.match(main,/shell\.trashItem\(asset\.path\)/);
  assert.match(main,/fsp\.rm\(asset\.path, \{ force: true \}\)/);
  assert.match(main,/failures\.push/);
});

test('Delete moves selections to Trash and deletes selected Trash source files',()=>{
  assert.match(renderer,/async function handleDeleteSelection/);
  assert.match(renderer,/if\(state\.view==='trash'\)\{await deleteTrashItems\(ids\);return;\}/);
  assert.match(renderer,/batchUpdateAssets\(unique,trash\?\{trash:true\}:\{restore:true\},\{silent:true,returnAssets:true\}\)/);
  assert.match(renderer,/emptyTrash\(mode,ids\)/);
  assert.match(renderer,/result\.deletedIds/);
  assert.match(main,/selectedIds=Array\.isArray\(request\.ids\)\?new Set\(request\.ids\):null/);
  assert.match(main,/!selectedIds\|\|selectedIds\.has\(asset\.id\)/);
  assert.match(main,/deletedIds: \[\.\.\.removed\]/);
});

test('Analytics and All Tags preserve the previous library position for back and forward navigation',()=>{
  assert.match(renderer,/captureNavigationSnapshot/);
  assert.match(renderer,/rememberTemporaryViewOrigin/);
  assert.match(renderer,/if\(view==='tags'\)rememberTemporaryViewOrigin\(\)/);
  assert.match(renderer,/selectedTagNames/);assert.match(renderer,/event\.shiftKey&&tagSelectionAnchor/);assert.match(renderer,/event\.ctrlKey\|\|event\.metaKey/);assert.match(renderer,/setTagRowSelection\(row,selected\)/);assert.match(renderer,/elements\.tagBrowser\.addEventListener\('pointerdown'/);assert.match(renderer,/selectTagRowWithEvent/);assert.match(renderer,/elements\.tagBrowser\.addEventListener\('click'/);assert.match(renderer,/renderedTagBrowserCatalog===catalog/);assert.match(renderer,/scheduleTagBrowserPrewarm/);assert.match(renderer,/confirmAndDeleteTags/);assert.match(renderer,/removeTagBrowserRows/);assert.match(preload,/deleteTags:/);assert.match(libraryCore,/function deleteTags/);assert.match(main,/persistAssetBatch\(result\.assets\)/);assert.match(styles,/tag-browser:not\(\.hidden\)[^}]*grid-template-columns/);
  assert.match(renderer,/function openAnalytics[^\n]*rememberTemporaryViewOrigin\(\)/);
  assert.match(renderer,/gridScrollTop:Math\.max\(0,Number\(elements\.gridWrap\.scrollTop\)\|\|0\)/);
  assert.match(renderer,/\['analytics','tags'\]\.includes\(state\.view\)&&navigationReturnState/);
  assert.match(renderer,/navigation-back'\)\.addEventListener\('click',returnFromTemporaryView\)/);
  assert.match(renderer,/navigation-forward'\)\.addEventListener\('click',forwardToTemporaryView\)/);
  assert.match(renderer,/close-analytics'\)\.addEventListener\('click',\(\)=>\{if\(!returnFromTemporaryView\(\)\)/);
});

test('right-panel threads and scoped analytics are wired', () => {
  for (const id of ['threads-panel', 'threads-panel-list', 'threads-live-count', 'threads-toggle-all', 'analytics-view', 'analytics-tabs', 'analytics-content', 'analytics-title']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-view="analytics"/);
  assert.match(preload, /onBackgroundProgress/);
  assert.match(main, /background:progress/);
  assert.match(main, /reportBackgroundProgress/);
  assert.match(main, /Adding files from/);
  assert.match(main, /thumbnail-generation/);
  assert.match(main, /Analyzing file fingerprints/);
  assert.match(renderer, /renderBackgroundProgress/);
  assert.match(renderer, /function analyticsAssets/);
  assert.match(renderer, /function renderAnalytics/);
  assert.match(renderer, /analyticsHeatmap/);
  assert.match(renderer, /conic-gradient/);
  assert.match(renderer, /View Analytics/);assert.doesNotMatch(renderer,/View (?:Folder|Collection) Analytics/);
  assert.match(renderer, /type: 'location'/);
  assert.match(renderer, /type: 'collection'/);
  assert.match(styles, /\.thread-progress-row/);
  assert.doesNotMatch(html,/id="background-progress"/);
  assert.match(styles, /\.analytics-heatmap/);
  assert.match(styles, /\.analytics-pie/);
});

test('the transparent VCSOC logo remains branded while the animated pigeon stays on every loading surface',async()=>{
  const logoPath=path.join(root,'pigeon-logo.png'),logoMetadata=await sharp(logoPath).metadata(),logoStats=await sharp(logoPath).stats(),animationPath=path.join(root,'pigeon-loading.gif'),animationMetadata=await sharp(animationPath,{animated:true}).metadata();assert.equal(logoMetadata.format,'png');assert.equal(logoMetadata.hasAlpha,true);assert.equal(logoStats.isOpaque,false);assert.equal(animationMetadata.format,'gif');assert.ok(animationMetadata.pages>1);assert.match(html,/id="startup-splash"[^\n]*src="\.\.\/pigeon-loading\.gif"/);assert.match(html,/id="portfolio-switch-loading"[^>]*>[\s\S]*?src="\.\.\/pigeon-loading\.gif"/);assert.match(html,/id="opening-location-animation"[^>]*src="\.\.\/pigeon-loading\.gif"/);assert.doesNotMatch(html,/status-progress-pigeon/);assert.match(renderer,/emptyFolderArt\.classList\.toggle\('hidden',loading\)/);assert.match(styles,/\.opening-location-animation\{[^}]*object-fit:contain/);assert.match(styles,/#grid-wrap:has\(\.opening-location-animation:not\(\.hidden\)\)\{background:#040405\}/);assert.match(styles,/\.portfolio-switch-loading\{[^}]*background:#040405/);assert.doesNotMatch(styles,/\.status-progress-pigeon\{/);assert.match(packageJson,/"pigeon-logo\.png"/);assert.match(packageJson,/"pigeon-loading\.gif"/);
});

test('Chrome and Edge Manifest V3 extension is installable and local-only', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'browser-extension', 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, 'service-worker.js');
  assert.equal(manifest.action.default_icon['32'],'icons/icon-32.png');assert.equal(manifest.icons['128'],'icons/icon-128.png');for(const size of [16,32,48,128])assert(fs.existsSync(path.join(root,'browser-extension','icons',`icon-${size}.png`)));
  assert(!JSON.stringify(manifest).includes('nativeMessaging'));
  const extensionWorker=fs.readFileSync(path.join(root,'browser-extension','service-worker.js'),'utf8');assert.match(extensionWorker,/127\.0\.0\.1:47635\/extension\/import/);assert.doesNotMatch(extensionWorker,/tabs\.create/);
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert(packageJson.build.extraResources.some((resource) => resource.to === 'browser-extension'));
});

test('plugin worker executes without require/process and returns declared operations', async () => {
  const pluginFile = path.join(require('node:os').tmpdir(), `pigeon-plugin-${Date.now()}.js`);
  fs.writeFileSync(pluginFile, "pigeon.emit({ type: 'tag', ids: [pigeon.assets[0].id], tag: 'plugin-tag' });");
  const result = await new Promise((resolve, reject) => {
    const worker = new Worker(path.join(root, 'electron', 'plugin-worker.js'), { workerData: { file: pluginFile, assets: [{ id: 'a', name: 'A', kind: 'image', tags: [] }] } });
    worker.on('message', (message) => { if (message.done) resolve(message); });
    worker.on('error', reject);
  });
  fs.rmSync(pluginFile, { force: true });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.operations, [{ type: 'tag', ids: ['a'], tag: 'plugin-tag' }]);
});

test('plugin worker blocks Node capability access', async () => {
  const pluginFile = path.join(require('node:os').tmpdir(), `pigeon-plugin-bad-${Date.now()}.js`);
  fs.writeFileSync(pluginFile, "require('node:fs').readFileSync('secret');");
  const result = await new Promise((resolve, reject) => {
    const worker = new Worker(path.join(root, 'electron', 'plugin-worker.js'), { workerData: { file: pluginFile, assets: [] } });
    worker.on('message', (message) => { if (message.done) resolve(message); });
    worker.on('error', reject);
  });
  fs.rmSync(pluginFile, { force: true });
  assert.match(result.error, /require is not defined/);
});

test('Help Tutorials provides a comic guided tour with complete navigation and privacy guidance',()=>{
  for(const id of ['tutorial-overlay','tutorial-highlight','tutorial-bubble','tutorial-back','tutorial-next','tutorial-end'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(renderer,/help: \[\['Tutorials', 'tutorials'/);assert.match(renderer,/function startTutorial\(/);assert.match(renderer,/function showTutorialStep\(/);assert.match(renderer,/Help → Tutorials/);
  assert.match(renderer,/Password-protect a collection/);assert.match(renderer,/Password protect folder/);assert.match(renderer,/Apply—and remove—privacy effects/);assert.match(renderer,/Blur or Pixelate/);assert.match(renderer,/state\.thumbnailEffectShortcut\|\|'W'/);assert.match(renderer,/state\.privacyEffectsToggleShortcut\|\|'Alt\+W'/);
  assert.match(renderer,/typeof step\.copy==='function'\?step\.copy\(\):step\.copy/);assert.match(renderer,/preferences\.thumbnailEffectRevealKey\|\|'Alt'/);assert.match(renderer,/preferences\.hoverAudioShortcut\|\|'Ctrl'/);
  assert.match(renderer,/Hover to preview motion/);assert.match(renderer,/GIF, or animated WebP/);assert.match(renderer,/temporaryShortcutPressed/);
  assert.match(renderer,/Open a whole hierarchy at once/);assert.match(renderer,/Select folders as a team/);assert.match(renderer,/Shift-click selects the visible range/);assert.match(renderer,/Threads show real work/);assert.match(renderer,/Clicking Update now opens this tab automatically/);assert.match(renderer,/Know what portfolio transfer means/);assert.match(renderer,/independent physical copies/);assert.match(renderer,/adds references to files where they already live/);
  assert.match(styles,/\.tutorial-dimmer/);assert.match(styles,/\.tutorial-highlight/);assert.match(styles,/\.tutorial-bubble/);assert.match(styles,/box-shadow:8px 9px 0/);
});

test('PNJ files are indexed as images and content-sniffed for full previews',()=>{
  const fileTypes=fs.readFileSync(path.join(root,'electron','file-types.js'),'utf8'),assetMime=fs.readFileSync(path.join(root,'electron','asset-mime.js'),'utf8');
  assert.match(fileTypes,/['"]\.pnj['"]/);assert.match(libraryCore,/extension\|\|'\'\)\.toUpperCase\(\)==='PNJ'\?'image'/);assert.match(main,/mimeTypeForFile\(candidate\)/);assert.match(main,/mimeTypeForExtension\(extension,body\)/);assert.match(assetMime,/image\/jpeg/);assert.match(assetMime,/image\/png/);
});

test('camera RAW thumbnails and full viewer proxies decode outside the UI thread',()=>{
  for(const extension of ['.cr2','.cr3','.nef','.arw','.dng','.raf','.rw2','.orf','.pef','.srw','.x3f'])assert.match(fileTypesSource,new RegExp(`'\\${extension}'`));
  assert.match(thumbnailWorker,/decodeRawCamera/);assert.match(thumbnailWorker,/import\('libraw-wasm'\)/);assert.match(thumbnailWorker,/raw\.imageData\(\)/);assert.match(thumbnailWorker,/raw\.thumbnailData\(\)/);assert.match(thumbnailWorker,/proxyVersion:rawCamera\?3/);assert.match(main,/RAW_IMAGE_EXTENSION_SET/);assert.match(main,/rawProxyTarget/);assert.match(main,/asset\.proxyVersion\s*=\s*thumbnail\.proxyVersion/);assert.match(main,/wantsProxy && asset\.proxyPath/);
});

test('HEIC and HEIF thumbnails use a bounded worker decoder and versioned cache retry',()=>{
  assert.match(thumbnailWorker,/decodeHeicToRaw/);assert.match(thumbnailWorker,/HEIC_IMAGE_EXTENSION_SET/);assert.match(heicPreview,/require\('heic-decode'\)/);assert.match(heicPreview,/MAX_HEIC_BYTES/);assert.match(heicPreview,/MAX_HEIC_PIXELS/);assert.match(heicPreview,/images\.dispose/);
  assert.match(main,/HEIC_PREVIEW_VERSION=1/);assert.match(main,/heicPreviewVersion/);assert.match(main,/thumbnailFailureVersion!==HEIC_PREVIEW_VERSION/);assert.match(main,/heic\?30000/);
});

test('focused file indexing and delayed hover playback are configurable',()=>{
  assert.match(html,/data-preference-page="indexing"/);assert.match(html,/data-pref="indexAllFiles"/);assert.match(html,/data-index-category="images"/);assert.match(html,/data-index-category="documents"/);assert.match(html,/Documents and Markdown/);assert.match(html,/Presentations and PowerPoint/);assert.match(html,/data-pref="hoverPreviewDelay"/);
  assert.match(renderer,/hoverPreviewDelay:250/);assert.match(renderer,/const scheduleStart=/);assert.match(renderer,/setTimeout\(\(\)=>\{startTimer=null;if\(pointerIsOverPreview\(\)\)start\(modifiers\);\},delay\)/);assert.match(renderer,/clearTimeout\(startTimer\);startTimer=null/);
  assert.match(main,/shouldIndexFile\(filePath,indexingPreferences\)/);assert.match(main,/preferences\.indexAllFiles===true/);assert.match(main,/previousPolicy!==nextPolicy/);assert.match(fileTypesSource,/DEFAULT_INDEX_CATEGORIES/);assert.match(fileTypesSource,/\.pptx/);assert.match(fileTypesSource,/\.markdown/);
});

test('thumbnail magnifier dismisses on pointer departure or browsing scroll without stale virtual-card ownership',()=>{
  const hideStart=renderer.indexOf('function hideDelegatedMagnifier'),hideEnd=renderer.indexOf('let pointerSelectedAssetId',hideStart),hideBody=renderer.slice(hideStart,hideEnd),openStart=renderer.indexOf("elements.grid.addEventListener('pointerover'"),openEnd=renderer.indexOf("elements.grid.addEventListener('pointerout'",openStart),openBody=renderer.slice(openStart,openEnd);
  assert.match(renderer,/for\(const eventName of \['wheel','scroll'\]\)elements\.gridWrap\.addEventListener\(eventName,hideDelegatedMagnifier,\{passive:true\}\)/);
  assert.match(renderer,/function pointerInsideActiveMagnifier\(event\)/);
  assert.match(renderer,/window\.addEventListener\('pointermove',\(event\)=>\{if\(activeMagnifierCard&&!pointerInsideActiveMagnifier\(event\)\)hideDelegatedMagnifier\(\);\},true\)/);
  assert.match(styles,/\.hover-fit-preview[^}]*pointer-events:none/);
  assert.match(hideBody,/activeMagnifierCard=null;clearTimeout\(hoverFitPreviewTimer\);hoverFitPreviewTimer=null/);
  assert.match(hideBody,/image\.onload=null;image\.removeAttribute\('src'\)/);
  assert.match(openBody,/if\(activeMagnifierCard===card&&loaded&&delayDone\)hoverPreview\.classList\.remove\('hidden'\)/);
});

test('portfolio switches remain covered until filtered cards and visible thumbnails settle',()=>{
  assert.match(renderer,/function portfolioSwitchViewReady/);assert.match(renderer,/state\.library\.assetStreamPending/);assert.match(renderer,/cooperativeAssetView\?\.signature!==signature\|\|!cooperativeAssetView\.ready/);assert.match(renderer,/asset-image-placeholder,\.asset-preview\[data-thumbnail-src\]/);assert.match(renderer,/schedulePortfolioSwitchReveal\(generation\)/);assert.doesNotMatch(renderer,/if\(portfolioSwitchLoading\)setPortfolioSwitchLoading\(false\);render/);
});

test('medium portfolio switches keep completed thumbnail results inside the virtual card budget',()=>{
  const start=renderer.indexOf('function currentAssetViewSnapshot'),end=renderer.indexOf('function applyVirtualCardPlacement',start),snapshot=renderer.slice(start,end);
  assert.match(snapshot,/if\(!ready\)return\{assets:allAssets\.slice\(0,VIRTUAL_ASSET_WINDOW\)/);
  assert.match(snapshot,/const indices=allAssets\.map\(\(asset\)=>rendererAssetIndexes\.get\(asset\.id\)\)/);
  assert.match(snapshot,/virtual=total>VIRTUAL_ASSET_WINDOW,metrics=virtual\?virtualGridMetrics\(total,indices\):null/);
  assert.match(snapshot,/assets:virtual\?indices\.slice\(windowRange\.start,windowRange\.end\)/);
});

test('Smart Folder metadata patches reconcile changed IDs without rebuilding the active view',()=>{
  assert.match(renderer,/function applyMetadataViewDelta\(changes,options=\{\}\)/);assert.match(renderer,/PigeonMetadataViewDelta\.reconcileIndices/);assert.match(renderer,/PigeonMetadataViewDelta\.keyedCardPlan/);assert.match(renderer,/PigeonMetadataViewDelta\.updateCounts/);assert.match(renderer,/deltaHandled=viewChanged&&applyMetadataViewDelta\(changes\)/);assert.match(renderer,/if\(viewChanged&&!deltaHandled\)\{invalidateTagCache\(\);invalidateAssetViewCache\(\);scheduleStreamGridRender\(\);\}/);
  const deltaBody=renderer.slice(renderer.indexOf('function reconcileActiveSmartFolderMetadataDelta'),renderer.indexOf('function applyMetadataViewDelta'));assert.doesNotMatch(deltaBody,/invalidateAssetViewCache|startCooperativeAssetView|renderGrid\(/);assert.match(deltaBody,/host\.appendChild\(card\)/);assert.match(deltaBody,/for\(const id of plan\.remove\)existingById\.get\(id\)\?\.remove\(\)/);
});

test('multi-selection ratings share the changed-ID delta path',()=>{
  assert.match(renderer,/ids\.length>1\?updateAssetsWithoutGridRefresh\(ids,\{rating\}\):updateSelected\(\{rating\}\)/);assert.match(renderer,/changes\.push\(\{index,before,after:asset,patch\}\)/);assert.match(renderer,/selectionAfterRemoval/);
});

test('virtual geometry is result-scoped, exact, dense, and shares one responsive placement model',()=>{
  assert.match(renderer,/identity=`\$\{viewIdentity\}\|\$\{model\.key\}`/);assert.match(renderer,/state\.virtualExtentPx=virtualLayout\.extentPx/);assert.doesNotMatch(renderer,/state\.virtualExtentPx=Math\.max\(state\.virtualExtentPx,virtualLayout\.extentPx\)/);assert.doesNotMatch(renderer,/requiredExtent=virtualLayout\.topPx/);assert.match(renderer,/metrics\.identity!==current\.identity\|\|metrics\.resultCount!==resultCount/);assert.match(renderer,/window\.PigeonVirtualLayout\.windowForScroll/);assert.match(renderer,/function applyVirtualCardPlacement/);assert.match(styles,/left:var\(--virtual-x\);top:var\(--virtual-y\);width:var\(--virtual-width\)/);assert.doesNotMatch(styles,/layout-justified \.asset-grid\.virtualized-grid \.asset-card\{flex:0 0 var\(--card-width\)/);assert.match(renderer,/function scheduleVirtualLayoutRefresh/);assert.match(renderer,/virtualGridResizeObserver\.observe\(elements\.grid\)/);
});

test('virtual scroll diagnostics attribute result bounds, extent, restoration and decode state',()=>{
  for(const field of ['layoutGeneration','layoutWidth','cardWidth','layoutDensity','windowStart','windowEnd','resultCount','estimatedExtentPx','fullVirtualExtentPx','actualScrollHeight','scrollTop','userScrollEpoch','pendingRestore','domCards','decodedCards','layout'])assert.match(renderer,new RegExp(`${field}:`));assert.match(renderer,/recordVirtualScrollState\('thumbnail-ready'\)/);assert.match(renderer,/gridScrollRestore\.cancel\(\);suppressGridScroll=false;if\(virtualScrollFrame!==null\)\{cancelAnimationFrame\(virtualScrollFrame\)/);
});

test('removing an indexed folder never modifies its physical folder or contents',()=>{
  const removeLocation=main.slice(main.indexOf("ipcMain.handle('library:remove-location'"),main.indexOf("ipcMain.handle('library:rescan'"));assert.match(removeLocation,/const removedFromDisk=false/);assert.doesNotMatch(removeLocation,/fsp\.(?:rm|rmdir|unlink|readdir)\(/);assert.match(renderer,/This removes its indexed references only/);assert.match(renderer,/physical folder and every file inside it remain unchanged/);
});

test('nested sidebar folders retain a fixed aligned count column',()=>{
  assert.match(styles,/\.collection-item, \.smart-folder-item, \.location-folder-item \{[^}]*minmax\(0,1fr\) 40px 18px !important/);assert.match(styles,/\.collection-item small, \.smart-folder-item small, \.location-folder-item small \{ width:40px; min-width:40px;[^}]*text-align:right/);
});

test('collection navigation applies its saved thumbnail size before revealing new cards',()=>{
  assert.match(renderer,/changed=Number\(\$\('#zoom-slider'\)\.value\)!==value;setThumbnailZoom\(value,\{persist:false,render:false\}\);return changed/);
  assert.match(renderer,/elements\.grid\.classList\.toggle\('navigation-sizing',restoreScopedThumbnailSize\(\)\)/);
  assert.match(renderer,/renderGrid\(\);elements\.grid\.classList\.remove\('navigation-sizing'\)/);
  assert.match(styles,/\.asset-grid\.navigation-sizing \{ visibility:hidden; \}/);
});

test('the configurable backtick default toggles a proportionally fitted monitor fullscreen viewer',()=>{
  assert.match(html,/id="fullscreen-viewer-shortcut"/);
  assert.match(renderer,/fullscreenViewerShortcut:'`'/);
  assert.match(renderer,/configuredShortcut === \(preferences\.fullscreenViewerShortcut\|\|'`'\)/);
  assert.match(renderer,/const id=isInternalViewerOpen\(\)\?state\.viewerAssetId:state\.selectedId/);
  assert.match(renderer,/if\(!isInternalViewerOpen\(\)\)openInternalViewer\(id\);else renderInternalViewer\(\)/);
  assert.match(renderer,/state\.viewerFit=true;state\.viewerZoom=1/);
  assert.match(renderer,/document\.documentElement\.requestFullscreen\(\)/);
  assert.match(renderer,/document\.fullscreenElement\?document\.exitFullscreen\(\):Promise\.resolve\(\)/);
  assert.match(renderer,/if\(isInternalViewerOpen\(\)\)closeInternalViewer\(\)/);
  const toggle=renderer.slice(renderer.indexOf('async function toggleBackquoteFullscreenViewer'),renderer.indexOf("document.addEventListener('fullscreenchange'"));
  assert.ok(toggle.indexOf('requestFullscreen()')<toggle.indexOf('openInternalViewer(id)'));
  assert.equal((toggle.match(/renderInternalViewer\(\)/g)||[]).length,1);
  assert.match(renderer,/const selectionChanged=state\.selectedId!==id/);
  assert.match(main,/--smoke-fullscreen-performance/);assert.match(main,/enterDispatchMs>100/);assert.match(main,/exitFirstGridPaintMs>350/);assert.match(main,/lastId!==`asset-\$\{result\.total-1\}`/);
  assert.match(styles,/\.viewer-stage img[^}]*object-fit:\s*contain/);
});

test('two selected images open synchronized side-by-side and overlay-slider comparison tools',()=>{
  for(const id of ['image-compare-view','compare-side-by-side','compare-overlay','compare-image-first','compare-image-second','compare-divider','compare-zoom'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(renderer,/function openImageCompare/);assert.match(renderer,/assets\.length!==2/);assert.match(renderer,/function applyImageCompareTransform/);assert.match(renderer,/imageCompareState\.pan\.x/);assert.match(renderer,/imageCompareState\.zoom/);assert.match(renderer,/setImageCompareMode\('overlay'\)/);assert.match(renderer,/updateImageCompareSplit/);
  assert.match(styles,/\.image-compare-stage\.side-by-side/);assert.match(styles,/\.image-compare-stage\.overlay \.compare-second\{clip-path:inset/);assert.match(styles,/\.compare-divider::before/);
});

test('fullscreen relayout pins a top viewport to the first virtual cards and long toolbar titles ellipsize',()=>{
  assert.match(renderer,/const pinnedToTop=elements\.gridWrap\.scrollTop<=1/);assert.match(renderer,/anchor=\{index:0,offset:0\};state\.virtualStart=0/);assert.match(renderer,/document\.addEventListener\('fullscreenchange'/);
  assert.match(styles,/\.toolbar-left h1\{min-width:0;flex:1 1 auto;overflow:hidden;white-space:nowrap;text-overflow:ellipsis\}/);
});

test('cloud placeholders remain pending and never enter scan, hash, or thumbnail reads',()=>{
  assert.match(main,/inspectCloudFiles\(batch/);assert.match(main,/placeholder: true/);assert.match(main,/const sourcePending = Boolean\(inspection\?\.placeholder\)/);assert.match(main,/if\(!\(await pathAvailable\(asset\.path\)\)\)\{markAssetSourcePending\(asset\)/);assert.match(main,/asset\.sourcePending\|\|asset\.sourceMissing\)return/);
});

test('asset transfers reuse one undated collection and folder per source portfolio',()=>{
  assert.match(main,/collectionName = `Transferred from \$\{sourcePortfolio\?\.name \|\| 'Portfolio'\}`/);assert.match(main,/target\.collections\.find\(\(item\) => item\.parentId === null/);assert.match(main,/safeTransferFilename\(collectionName\)/);assert.doesNotMatch(main,/Transferred from \$\{sourcePortfolio[^\n]+timestamp/);
});

test('Control startup chooses a portfolio before the main database and window load',()=>{
  assert.match(main,/startupPortfolioChooserProbe = smokeTest \? Promise\.resolve\(false\) : startupPortfolioChooserRequested\(\)/);assert.match(main,/startupModifierPowerShell/);assert.match(main,/showStartupPortfolioChooser/);const chooserAt=main.lastIndexOf('if(await startupPortfolioChooserProbe)'),selectionAt=main.lastIndexOf('activePortfolioId=selected.id'),windowAt=main.lastIndexOf('createWindow();');assert.ok(chooserAt>0&&selectionAt>chooserAt&&windowAt>selectionAt);assert.match(main,/if\(!selectedId\)\{app\.isQuitting=true;app\.quit\(\);return;\}/);assert.match(main,/--choose-portfolio/);
});

test('normal startup waits for renderer subscriptions before streaming the saved portfolio',()=>{
  assert.match(preload,/rendererReady:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('renderer:ready'\)/);
  assert.match(renderer,/rendererSubscriptionsReady='true';\s*window\.pigeon\.rendererReady\(\)/);
  assert.match(main,/ipcMain\.handle\('renderer:ready',[\s\S]*resolveRendererSubscriptionsReady/);
  assert.match(main,/did-finish-load'[\s\S]*await rendererSubscriptionsReady;\s*await loadLibraryInWorker\(\)/);
});

test('YouTube drops switch between linked inline playback and saved-quality downloads',()=>{
  assert.match(renderer,/youtubeAutoDownload:true/);
  assert.match(renderer,/data-pref="youtubeAutoDownload"/);
  assert.match(renderer,/youtubeDownloadQuality:'720'/);
  assert.match(renderer,/youtubeDownloadFormat:'mp4'/);
  assert.match(renderer,/youtubeChapterMode:'embed'/);
  assert.match(renderer,/data-pref="youtubeDownloadQuality"/);
  assert.match(renderer,/data-pref="youtubeDownloadFormat"/);
  assert.match(renderer,/data-pref="youtubeChapterMode"/);
  assert.match(html,/id="youtube-download-dialog"/);
  assert.match(renderer,/requestYouTubeDownloadOptions/);
  assert.match(preload,/importUrl: \(url, options = \{\}\)/);
  assert.match(renderer,/quality\.disabled=!enabled/);
  assert.match(html,/id="viewer-youtube"/);
  assert.match(renderer,/youtube-nocookie\.com\/embed/);
  assert.match(renderer,/Permanently Delete…/);
  assert.match(renderer,/deleteTrashItems\(selectedIds,'permanent'\)/);
  assert.match(main,/youtubeVideoId\(url\)/);
  assert.match(main,/youtubeDownloadQuality\|\|'720'/);
  assert.match(main,/requestedFormat==='mp3'/);
  assert.match(main,/requestedFormat==='thumbnail'/);
  assert.match(main,/downloadHighestQualityYouTubeThumbnail/);
  assert.match(renderer,/onThumbnailReady\([^\n]+\n  (?:if\(rebuiltAsset\)[^\n]+\n  )?const layoutAnchor=captureVirtualLayoutAnchor\(\)/);
  assert.match(main,/maxresdefault\.jpg/);
  assert.match(main,/imported\.sourceUrl=canonicalYouTubeUrl\(url\)/);
  assert.match(renderer,/Highest-quality thumbnail image/);
  assert.match(renderer,/largest available thumbnail image/);
  assert.match(main,/youtubeChapterMode\)==='split'/);
  assert.match(main,/result\.targets\?\.length/);
  assert.match(main,/Saved \$\{assets\.length\} chapter files/);
  assert.match(main,/youtubeAutoDownload!==false/);
  assert.match(main,/createLinkedYouTubeAsset/);
  assert.match(main,/YouTube download formats unavailable; saved a playable link instead/);
  assert.match(main,/no matching formats\|no playable\.\*format/);
  assert.match(main,/no valid url to decipher/);
  assert.match(main,/non 2xx/);
  assert.match(youtubeImport,/downloadYouTubeWithYtDlp/);
  assert.match(ytDlpImport,/youtube:player_client=web_embedded/);
  assert.match(ytDlpImport,/--http-chunk-size','1M/);
  assert.match(ytDlpImport,/--embed-chapters/);
  assert.match(ytDlpImport,/--split-chapters/);
  assert.match(ytDlpImport,/--extract-audio/);
  assert.match(ytDlpImport,/--audio-format','mp3/);
  assert.match(ytDlpImport,/--js-runtimes/);
  assert.match(youtubeImport,/Platform\.shim\.eval/);
  assert.match(youtubeImport,/contextCodeGeneration: \{ strings: false, wasm: false \}/);
  assert.match(packageJson,/"youtubei\.js": "\^18\.0\.0"/);
  assert.match(styles,/\.preference-page input\[type="checkbox"\][^{]*\{[^}]*appearance:none/);
  assert.match(styles,/input\[type="checkbox"\]:checked::before/);
  assert.match(styles,/input\[type="checkbox"\]:focus-visible/);
  assert.match(main,/mode:asset\.linkedYouTube\?'linked':'downloaded'/);
  assert.match(main,/broadcastScanAssets\(autoImportLocation,\[asset\],true\)/);
  assert.match(renderer,/startsWith\('extension-import:'\)/);
  assert.match(renderer,/Browser download failed/);
  assert.match(main,/mediaOnly:true/);
});

test('Pigeon-managed conflicts use a themed batch-aware Skip, Keep both, or Overwrite prompt',()=>{
  const conflicts=fs.readFileSync(path.join(root,'electron','file-conflicts.js'),'utf8');
  assert.match(renderer,/data-pref="autoRenameFileConflicts"/);assert.match(renderer,/Identical files always ask whether to Skip or Keep both/);assert.match(renderer,/safely renamed/);assert.match(main,/resolveManagedFileConflict/);assert.match(main,/decideIdenticalFileConflict/);assert.match(main,/file-conflict:prompt/);assert.match(preload,/onFileConflictPrompt/);assert.match(html,/id="file-conflict-dialog"/);assert.match(html,/Apply to all files/);assert.match(html,/id="file-conflict-overwrite"/);assert.match(renderer,/finishFileConflictPrompt\('overwrite'\)/);assert.match(main,/decisionScope\.decision/);assert.match(main,/replaceFileSafely/);assert.match(conflicts,/async function replaceFileSafely/);assert.match(main,/COPYFILE_EXCL/);assert.match(conflicts,/decision === 'overwrite'/);assert.match(conflicts,/filesAreIdentical/);assert.match(conflicts,/FILE_NAME_CONFLICT/);assert.match(conflicts,/uniqueConflictPath/);
});

test('inspector rename remains asset-bound and patches one card without repainting the grid',()=>{
  const renameSource=renderer.slice(renderer.indexOf('async function renameAssetFile'),renderer.indexOf('const IMAGE_PREVIEW_DOCUMENT_EXTENSIONS'));
  assert.match(html,/rename-session\.js/);assert.match(renderer,/inspectorRenameSession\.begin\(asset\.id/);assert.match(renderer,/renameAssetFile\(rename\.assetId,rename\.value\)/);assert.match(renderer,/The original file is no longer available/);assert.match(renameSource,/patchCardMetadata\(current/);assert.doesNotMatch(renameSource,/renderGrid\(/);assert.doesNotMatch(renameSource,/reconcileThumbnailCards\(/);
});

test('collection transfers reuse matching physical roots and Threads expose real durable progress',()=>{assert.match(main,/reuseRoot=path\.basename\(selectedDestination\)\.localeCompare/);assert.match(main,/Generating previews/);assert.match(main,/showProgress=\['plugin','similarity'\]\.includes\(type\)/);assert.match(renderer,/syncBackgroundThreadsForPortfolio/);assert.doesNotMatch(renderer,/task\.total>0&&task\.completed>=task\.total/);});

test('moves into locked collections or folders remove only affected thumbnails immediately',()=>{assert.match(main,/function mutationVisibilityResult\(changedAssets=\[\]\)/);assert.match(main,/hiddenIds\.push\(asset\.id\);rendererVisibleAssetIds\.delete\(asset\.id\)/);assert.match(main,/if\(options\.returnAssets\)return\{count,\.\.\.mutationVisibilityResult\(changedAssets\)\}/);assert.match(main,/\.\.\.mutationVisibilityResult\(moved\),locations/);assert.match(renderer,/function applyAssetMutationVisibility\(ids,result/);assert.match(renderer,/elements\.grid\.querySelector\(`\[data-asset-id="\$\{CSS\.escape\(id\)\}"\]`\)\?\.remove\(\);scheduleMasonry\(\);assetStreamState\.removeMany\(hiddenIds\)/);assert.match(renderer,/applyAssetMutationVisibility\(unique,result,\{viewport\}\)/);assert.match(renderer,/moveAssetsToFolder[\s\S]{0,600}applyAssetMutationVisibility\(ids,result,\{viewport\}\)/);assert.match(renderer,/result\?\.hiddenIds\?\.length\)applyAssetMutationVisibility\(ids,result/);assert.match(renderer,/else applyShortcutMetadataResult\(step,result\)/);assert.doesNotMatch(renderer,/returnAssets:index===action\.steps\.length-1/);});

test('live imports refresh clean cards, context menus clear the footer, and persistent Threads uses bottom inspector tabs',()=>{
  for(const id of ['inspector-details-panel','threads-panel','threads-panel-list','right-panel-details-tab','right-panel-threads-tab','active-thread-count','threads-toggle-all'])assert.match(html,new RegExp(`id="${id}"`));assert.match(html,/data-section-toggle="indexed-locations"[^>]*>[\s\S]*?<span>Folders<\/span>/);assert.doesNotMatch(html,/>Indexed Locations?<\//i);
  assert.match(renderer,/renderGrid\(\{preserveCards:!view\.forceFreshCards\}\)/);assert.match(renderer,/view\.forceFreshCards=true/);
  assert.match(renderer,/footerTop=document\.querySelector\('\.statusbar'\)/);assert.match(renderer,/positionMenu\(elements\.contextMenu,event\.clientX,event\.clientY\)/);assert.match(styles,/\.context-menu \{ z-index:120/);
  assert.match(renderer,/function activeBackgroundThreads/);assert.match(renderer,/function renderThreadsPanel/);assert.match(renderer,/terminal=Boolean\(task\.done\)/);assert.match(renderer,/--thread-progress:\$\{percent\.toFixed\(1\)\}%/);assert.match(renderer,/setAllBackgroundThreadsPaused/);assert.match(renderer,/reorderBackgroundThreads/);assert.match(styles,/\.right-panel-tabs[^}]*border-top/);assert.match(styles,/\.thread-progress-row::before/);assert.match(renderer,/right-panel-threads-tab'\)\.classList\.toggle\('has-active-threads',tasks\.length>0\)/);assert.match(styles,/right-panel-threads-tab\.has-active-threads[^}]*background:#6b3518/);
  assert.match(main,/readDownloadResponse/);assert.match(main,/onProgress:\(percent\)=>reportDownload/);assert.match(youtubeImport,/ffmpegPath,onProgress/);assert.match(youtubeImport,/downloadYouTubeWithYtDlp[^\n]+onProgress/);
});

test('overlapping folder roots and exact file paths are presented once and repaired without source deletion',()=>{
  const deduplication=fs.readFileSync(path.join(root,'electron','library-deduplication.js'),'utf8'),folderWorker=fs.readFileSync(path.join(root,'electron','folder-tree-worker.js'),'utf8');assert.match(main,/findLocationOverlap\(planned,resolved,type\)/);assert.match(main,/Pigeon allows one reference to each physical file/);assert.match(main,/deduplicateAssetsByPath\(library\)/);assert.match(main,/await persistLibrary\(library\)/);assert.match(main,/globalByPath\.get\(normalizedPathKey\(resolvedFile\)\)/);assert.match(main,/id: existing\?\.id \|\| makeId\(path\.resolve\(filePath\)\.toLowerCase\(\)\)/);assert.match(assetStreamState,/pathIndexes=new Map\(\)/);assert.match(main,/owner\.id!==location\.id/);assert.match(main,/locations:visibleLocations\(library\.locations\)/);assert.match(deduplication,/function owningLocation/);assert.match(deduplication,/merged\.collectionIds/);assert.match(deduplication,/merged\.tags/);assert.doesNotMatch(deduplication,/\brmSync\b|unlinkSync|trashItem/);assert.match(folderWorker,/excludedRoots/);assert.match(folderWorker,/if\s*\(isExcluded\(relativeSource\)\)\s*continue/);
});

test('thumbnail failures are bounded and detailed while paused threads and sidebar branches are removable',()=>{
  assert.match(main,/attempts:3[^\n]+label:`Preview \$\{asset\.filename\}`/);assert.match(main,/Thumbnail generation exhausted retries/);assert.match(main,/attempts:3,permissionDenied/);assert.match(preload,/removePausedBackgroundThread/);assert.match(main,/background-threads:remove-paused/);assert.match(renderer,/data-thread-delete/);assert.match(renderer,/removePausedBackgroundThread\(task\.id\)/);assert.match(styles,/\.thread-delete-button/);assert.match(renderer,/function hierarchyBranchCollapseKeys/);assert.match(renderer,/addEventListener\('dblclick'[^\n]+toggleHierarchyBranch\(row\)/);
});

test('permission-denied scans retain placeholders and use native authorization without app passwords',()=>{
  const scanWorker=fs.readFileSync(path.join(root,'electron','scan-worker.js'),'utf8'),permissionAccess=fs.readFileSync(path.join(root,'electron','permission-access.js'),'utf8');assert.match(scanWorker,/errorCode: error\.code/);assert.match(main,/asset\.permissionDenied=true/);assert.match(main,/permissions:required/);assert.match(main,/permissions:grant/);assert.match(main,/fs\.constants\.R_OK/);assert.match(preload,/onPermissionRequired/);assert.match(preload,/grantPermissionAccess/);assert.match(renderer,/card-permission-pill/);assert.match(renderer,/rebuildThumbnailsWithPermission/);assert.match(renderer,/Use system authentication/);assert.match(styles,/\.card-permission-pill/);assert.match(permissionAccess,/\/usr\/bin\/pkexec/);assert.match(permissionAccess,/\/usr\/bin\/setfacl/);assert.doesNotMatch(permissionAccess,/safeStorage|password/i);
});

test('thumbnail rebuilds stream cache-safe cards and live progress instead of waiting for a second pass',()=>{
  assert.match(main,/async function rebuildThumbnails/);assert.match(main,/beginBackgroundRun\('thumbnail-rebuild',crypto\.randomUUID\(\)\)/);assert.match(main,/label:'Rebuilding thumbnails'/);assert.match(main,/mainWindow\.webContents\.send\('thumbnail:ready',\{id:asset\.id,rebuiltAsset/);assert.match(main,/rebuiltAsset\.previewUrl=`\$\{rebuiltAsset\.previewUrl\}&rebuild=\$\{Date\.now\(\)\}-\$\{completed\}`/);assert.match(main,/streamed:true/);assert.match(renderer,/function replaceRebuiltThumbnailCard/);assert.match(renderer,/card\.replaceWith\(replacement\)/);assert.match(renderer,/if\(rebuiltAsset\)\{applyThumbnailRebuildResult\(\{assets:\[rebuiltAsset\]\}\)/);assert.match(renderer,/result\?\.streamed\?result:applyThumbnailRebuildResult\(result\)/);assert.match(renderer,/invalidateVirtualLayoutGeometry\(\);reconcileThumbnailCards/);assert.match(renderer,/scheduleThumbnailViewportSweep\(\);scheduleVirtualLayoutRefresh\(layoutAnchor\)/);
});

test('portable Pigeon Collections export hierarchies and selected assets through a validated native archive',()=>{assert.match(html,/id="pigeon-export-dialog"/);assert.match(html,/id="pigeon-collection-dialog"/);assert.match(renderer,/Export as Pigeon Collection…/);assert.match(renderer,/openPigeonExportDialog/);assert.match(renderer,/onPigeonCollectionOpened/);assert.match(preload,/exportPigeonCollection/);assert.match(preload,/importPigeonCollection/);assert.match(main,/pigeonCollectionArgument/);assert.match(main,/open-file/);assert.match(main,/second-instance/);assert.match(pigeonCollection,/FORMAT_VERSION=1/);assert.match(pigeonCollection,/maxCompressionRatio/);assert.match(pigeonCollection,/entryIsSymlink/);assert.match(pigeonCollection,/sha256/);assert.match(packageJson,/application\/x-pigeon/);});

test('explicit thumbnail rebuilds use a bounded responsive worker pool',()=>{const rebuild=main.slice(main.indexOf('async function rebuildThumbnails'),main.indexOf("ipcMain.handle('assets:rebuild-thumbnails'"));assert.match(rebuild,/workerCount=Math\.min/);assert.match(rebuild,/Promise\.all\(Array\.from\(\{length:workerCount\},worker\)\)/);assert.match(rebuild,/waitForIndexCpuBudget\(run\)/);assert.match(rebuild,/failures\.push/);assert.match(rebuild,/thumbnail:ready/);});

test('visual assets convert and edit non-destructively while dimensions and collection memberships are visible',()=>{
  for(const format of ['png','jpeg','webp'])assert.match(imageDerivative,new RegExp(`'${format}'`));for(const effect of ['grayscale','negative','sepia','brightness','contrast']){assert.match(imageDerivative,new RegExp(effect));assert.match(html,new RegExp(`edit-${effect}`));}assert.match(main,/EDITABLE_PREVIEW_EXTENSIONS[^\n]*'SNAGX'[^\n]*'LRPREV'/);assert.match(main,/renderImageDerivative/);assert.match(main,/editable-preview\.png/);assert.match(main,/if\(!asset\.sourceMissing&&!asset\.sourcePending&&asset\.path/);assert.match(main,/asset:save-image-edits/);assert.match(main,/asset:convert-image/);assert.match(preload,/saveImageEdits/);assert.match(preload,/prepareImageEdit/);assert.match(preload,/convertImage/);assert.match(renderer,/Convert to…/);assert.doesNotMatch(renderer,/Convert to PNG…/);assert.match(renderer,/showConvertContextSubmenu/);assert.match(renderer,/isEditableVisualAsset/);assert.match(html,/option value="dimensions">Dimensions/);assert.match(assetIndexesSource,/dimensions:\(Number\(asset\.width\)\|\|0\)\*\(Number\(asset\.height\)\|\|0\)/);assert.match(html,/id="collection-membership-pills"/);assert.match(renderer,/renderInspectorCollectionMemberships/);assert.match(styles,/\.collection-pill/);assert.match(html,/data-editor-view="actual"[^>]*>1:1/);assert.match(html,/data-editor-view="width"/);assert.match(html,/data-editor-view="fit" class="active"/);assert.match(html,/id="rotate-left-shortcut"/);assert.match(html,/id="rotate-right-shortcut"/);assert.match(renderer,/rotateLeftShortcut:'\['/);assert.match(renderer,/rotateRightShortcut:'\]'/);assert.match(main,/asset:prepare-image-edit/);assert.match(main,/asset:ai-remove-preview/);assert.match(preload,/previewAiRemoval/);assert.match(html,/data-tool="ai-remove"/);assert.match(styles,/\.ai-removal-review/);const aiRemovalServer=fs.readFileSync(path.join(root,'electron','plugin-examples','ai-removal','server.py'),'utf8');assert.match(aiRemovalServer,/onnxruntime/);assert.match(aiRemovalServer,/lama_fp32\.onnx/);assert.match(aiRemovalServer,/result = np\.clip\(result\.transpose\(1, 2, 0\), 0, 255\)\.astype\(np\.uint8\)/);assert.doesNotMatch(aiRemovalServer,/result\.transpose\(1, 2, 0\) \* 255/);assert.match(aiRemovalServer,/host="127\.0\.0\.1"/);assert.match(aiRemovalServer,/--prepare-model/);assert.match(packageJson,/electron\/\*\*\/\*/);assert.match(html,/<aside class="annotation-toolbar"/);assert.match(html,/id="annotation-layer-list"/);assert.match(html,/id="annotation-layer-bend"/);assert.match(renderer,/\.annotation-canvas'\)\.addEventListener\('wheel'/);assert.match(renderer,/function addTextAnnotation/);assert.match(renderer,/function addRectangleAnnotation/);assert.match(renderer,/annotationMiddlePan/);assert.match(renderer,/finishAnnotationMiddlePan/);assert.match(renderer,/updateSelectedLayerGeometry/);assert.match(renderer,/updateEditorResize/);assert.match(html,/id="edit-resize-width"/);assert.match(html,/id="annotation-layer-x"/);assert.match(imageDerivative,/normalizedResize/);assert.match(renderer,/openPluginManager/);assert.match(html,/id="plugin-manager-dialog"/);assert.match(html,/Plugin Manager…/);assert.doesNotMatch(html,/data-menu-group="plugin"/);assert.match(renderer,/annotation-resize-handle/);assert.match(renderer,/annotation-rotate-handle/);assert.match(renderer,/function paintAiRemovalMask/);assert.match(renderer,/function paintAnnotationLayer/);assert.match(renderer,/paintAnnotationLayer\(item\);renderAnnotationLayerList\(\)/);assert.match(renderer,/startPluginProgressUpdates/);assert.match(html,/id="ai-removal-progress"/);assert.match(html,/id="ai-removal-progress-time"/);assert.match(styles,/\.ai-removal-progress\{/);assert.match(styles,/@keyframes ai-removal-progress/);assert.match(renderer,/function setAiRemovalProgress/);assert.match(renderer,/function editorAssetId\(\)\{return state\.annotationAssetId\|\|state\.selectedId;\}/);assert.match(renderer,/function patchThumbnailPreviewSource\(asset\)/);assert.match(renderer,/if\(patch\.previewUrl\)patchThumbnailPreviewSource\(asset\)/);assert.match(renderer,/rendererAssetDerivatives\.upsert\(asset\);patchThumbnailPreviewSource\(asset\)/);assert.match(renderer,/state\.selectedId=id;state\.annotationAssetId=id/);assert.match(renderer,/previewAiRemoval\(assetId,/);assert.match(renderer,/acceptAiRemoval\(assetId,/);assert.match(renderer,/saveImageEdits\(assetId,/);assert.match(renderer,/AI object removal started · progress is shown in the editor/);assert.match(renderer,/if\(!plugin\.enabled\)\{await window\.pigeon\.setPluginEnabled\(plugin\.id,true\)/);assert.match(renderer,/requestAnimationFrame\(\(\)=>requestAnimationFrame\(resolve\)\)/);assert.match(renderer,/Install & set up automatically/);assert.match(renderer,/Import ONNX/);assert.match(renderer,/refreshAiRemovalEditorStatus/);assert.match(pluginManager,/Downloading Simple LaMa ONNX/);assert.match(pluginManager,/content-range/);assert.match(pluginManager,/ensureRunning/);assert.match(pluginManager,/bundledChanged/);assert.match(pluginManager,/await refreshBundled\(plugin\)/);assert.match(pluginManager,/migrateLegacy/);assert.match(main,/plugins:remove-model/);assert.match(renderer,/event\.clientX-rect\.left/);assert.match(renderer,/getCoalescedEvents/);assert.match(renderer,/applyMagnifierRotation/);assert.match(styles,/\.annotation-toolbar\{grid-column:2/);assert.match(styles,/\.annotation-layer\{/);assert.match(imageDerivative,/function annotationSvg/);assert.match(imageDerivative,/textPath/);assert.match(imageDerivative,/rotate\(\$\{rotation\}/);
});
