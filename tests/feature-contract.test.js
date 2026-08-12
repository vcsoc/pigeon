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
const libraryCore = fs.readFileSync(path.join(root, 'electron', 'library-core.js'), 'utf8');
const database = fs.readFileSync(path.join(root, 'electron', 'database.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const worldLand = fs.readFileSync(path.join(root, 'src', 'world-land.js'), 'utf8');
const icons = fs.readFileSync(path.join(root, 'src', 'icons.js'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

test('UI exposes collection, smart-folder, batch, trash, media, metadata and editing surfaces', () => {
  for (const id of ['collection-list', 'smart-folder-list', 'batch-bar', 'duplicates-count', 'trash-count', 'inspector-video', 'inspector-audio', 'sidebar-resizer', 'inspector-resizer', 'batch-stack', 'batch-unstack', 'settings-dialog', 'text-entry-dialog', 'smart-folder-dialog', 'smart-folder-name', 'smart-folder-rules', 'favorite-shortcut', 'portfolio-switcher', 'portfolio-switcher-search', 'portfolio-switcher-list', 'portfolio-select', 'switch-portfolio', 'new-portfolio', 'rename-portfolio', 'delete-portfolio', 'encrypt-locked-folders', 'confirm-folder-moves', 'rotate-left', 'rotate-right', 'tag-suggestions', 'tag-autocomplete', 'tag-assignment-dialog', 'batch-tag-input', 'viewer-crop-overlay', 'map-view', 'location-map', 'map-search-input', 'map-globe-mode', 'map-street-mode', 'map-save', 'location-shortcut', 'duplicate-controls', 'duplicate-similarity', 'show-all-duplicate-groups', 'thumbnail-title-line-1', 'thumbnail-title-line-2', 'thumbnail-title-line-3', 'tag-browser', 'media-viewer', 'viewer-video', 'asset-histogram', 'annotation-view']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing ${id}`);
  }
});

test('thumbnail marquee selection auto-scrolls while background scans remain consolidated and responsive',()=>{
  assert.match(html,/id="selection-marquee"/);assert.match(styles,/\.selection-marquee/);assert.match(renderer,/function updateMarqueeSelection/);assert.match(renderer,/function runMarqueeAutoScroll/);assert.match(renderer,/setPointerCapture/);assert.match(renderer,/scrollSpeed/);assert.match(renderer,/paintChangedSelectionCards\(changed\)/);
  assert.match(main,/\['database','thumbnail','index-scan','fingerprint'\]/);assert.match(main,/offset\+=100/);assert.match(main,/const scanBroadcastQueues=new Map/);assert.match(main,/setTimeout\(drain,16\)/);assert.match(renderer,/collectionCounts=new Map/);
});

test('destructive sidebar confirmations identify the exact collection, Smart Folder, or indexed folder',()=>{
  assert.match(renderer,/title: `Delete “\$\{collection\.name\}”\?`/);assert.match(renderer,/collection “\$\{collection\.name\}”/);
  assert.match(renderer,/title: `Delete “\$\{folder\.name\}”\?`/);assert.match(renderer,/Smart Folder “\$\{folder\.name\}”/);
  assert.match(renderer,/title: `Remove “\$\{location\.name\}”\?`/);assert.match(renderer,/\$\{location\.path\}/);
});

test('sidebar-only creation, universal worker progress, and immediate inspector tag suggestions are wired',()=>{
  assert.match(main,/function broadcastSidebar/);assert.match(main,/collection:create[\s\S]{0,180}broadcastSidebar\(\)/);assert.match(main,/smart-folder:create[\s\S]{0,180}broadcastSidebar\(\)/);assert.match(preload,/onSidebarChanged/);assert.match(renderer,/window\.pigeon\.onSidebarChanged/);
  assert.match(main,/showProgress=!\['database','thumbnail','index-scan','fingerprint'\]\.includes\(type\)/);assert.match(main,/if\(showProgress\)reportBackgroundProgress/);assert.match(main,/worker complete/);
  assert.match(renderer,/if\(input===elements\.tags\)/);assert.match(renderer,/addTagsToAssets\(targets,\[tag\]\)/);assert.match(renderer,/event\.key === 'Enter'.*applyTagSuggestion/);
});

test('trash progress, PDF first-page refresh, sidebar ordering, reset icon, and larger branding are wired',()=>{
  assert.match(main,/Clearing Trash/);assert.match(main,/reportBackgroundProgress\(progressId/);assert.match(main,/pdfPreviewVersion!==2/);assert.match(main,/timeout: asset\.extension==='PDF'\?35000:11000/);
  assert.match(fs.readFileSync(path.join(root,'electron','pdf-thumbnail-child.js'),'utf8'),/standardFontDataUrl/);
  assert.match(preload,/reorderSidebarItems/);assert.match(preload,/setSidebarSort/);assert.match(main,/sidebar:reorder-items/);assert.match(main,/sidebar:set-sort/);assert.match(renderer,/sidebarSortedSiblings/);assert.match(renderer,/data-sidebar-sort/);
  assert.match(html,/id="clear-filters"[^>]*Reset all filters/);assert.match(renderer,/\['#clear-filters','refresh'\]/);assert.match(styles,/width:270px/);assert.match(styles,/font-size:72px/);assert.match(styles,/font-size:29px/);
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
  assert.match(renderer,/Object\.assign\(asset,patch\);patchCardMetadata\(asset,patch\);renderInspector\(\)/);
  assert.match(renderer,/searchRenderFrame=requestAnimationFrame/);
  assert.match(styles,/grid-wrap\.navigation-pending::after/);
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
  for (const api of ['setCollectionAutoTags', 'setFolderAutoTags', 'copyText', 'copyAssets', 'pasteAssets', 'pathForDroppedFile', 'importDroppedFiles', 'searchMap', 'suggestMap', 'createPortfolio', 'renamePortfolio', 'switchPortfolio', 'removePortfolio', 'createCollection', 'batchUpdateAssets', 'findDuplicates', 'autoTag', 'importUrl', 'importClipboard', 'captureScreen', 'backupLibrary', 'configureSync', 'syncNow', 'exportAnnotated', 'runPlugin', 'openAssetWith', 'ensurePlayable', 'setWindowZoom', 'setCollectionPassword', 'unlockCollection', 'lockCollectionNow', 'removeCollectionPassword', 'renameAssetFile', 'applyInlineCrop', 'resetInlineEdits', 'duplicateAsset', 'stackAssets', 'unstackAssets']) assert.match(preload, new RegExp(`${api}:`));
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
  assert.match(renderer,/state\.selectedIds=new Set\(ids\)/);
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
  assert.match(renderer, /batchUpdateAssets\(state\.mapSelectionIds/);
  assert.match(main, /nominatim\.openstreetmap\.org/);
  assert.match(main, /photon\.komoot\.io/);
  assert.match(main, /tile\.openstreetmap\.org/);
  assert.match(main, /pigeon-map/);
});

test('justified rows, tag autocomplete, and viewer editing controls are wired', () => {
  assert.match(renderer, /layout-justified/);
  assert.match(renderer, /justified-basis/);
  assert.match(renderer, /renderTagSuggestions/);
  assert.match(renderer, /allExistingTags/);
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

test('startup uses the transparent Pigeon logo everywhere', async () => {
  assert.match(html, /id="startup-splash"[^>]*>[\s\S]*?pigeon-logo\.png/);
  assert.match(html, /rel="icon"[^>]*pigeon-logo\.png/);
  assert.match(styles, /\.startup-splash \{[^}]*background: var\(--bg\)/);
  assert.match(styles,/\.app-shell\.startup-active > :not\(\.startup-splash\)/);
  assert.match(html,/startup-brand[\s\S]*?<strong>pigeon<\/strong><span>sees all<\/span>/);
  assert.match(styles,/\.startup-brand \{ position:absolute; left:0; bottom:0/);
  assert.match(styles,/\.startup-brand img \{[^}]*width:270px/);
  assert.match(styles,/\.startup-brand strong \{[^}]*font-size:72px/);
  assert.match(styles,/\.startup-brand span \{[^}]*font-size:29px/);
  assert.match(styles, /\.brand-mark \{[^}]*background: transparent/);
  assert.doesNotMatch(html, /pigeon\.png/);
  assert.match(main, /icon: path\.join\([^\n]*'pigeon-logo\.png'/);
  assert.match(packageJson, /"icon": "pigeon-logo\.png"/);
  const logo = sharp(path.join(root, 'pigeon-logo.png'));
  assert.equal((await logo.metadata()).hasAlpha, true);
  assert.equal((await logo.stats()).isOpaque, false);
  assert.match(renderer, /finishStartupSplash/);
  assert.match(renderer, /STARTUP_SPLASH_MINIMUM_MS=2000/);
  assert.match(styles, /\.startup-brand img \{[^}]*width:270px/);
  assert.match(styles, /border: 0/);
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
  assert.match(renderer, /pigeon\.collapsedSidebarSections/);
  assert.match(renderer, /pigeon\.collapsedFolders/);
  assert.match(renderer, /toggleFolderCollapsed/);
  assert.match(renderer, /collectionCollapseKey/);
  assert.match(renderer, /locationCollapseKey/);
  assert.match(styles, /\.folder-tree-toggle/);
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

test('rotated justified thumbnails, centered metadata, untagged view, and durable collection auto-tags are wired', () => {
  assert.match(styles, /layout-justified \.asset-preview\.quarter-turned img/);
  assert.match(styles, /width: var\(--rotated-image-width/);
  assert.match(styles, /\.card-titles \{[^}]*justify-items: center/);
  assert.match(styles, /\.card-title-line \{[^}]*text-align: center/);
  assert.match(html, /data-view="untagged"/);
  assert.match(html, /id="untagged-count"/);
  assert.match(renderer, /state\.view === 'untagged'/);
  assert.match(renderer, /!\['trash', 'duplicates', 'untagged'\]\.includes/);
  assert.match(main, /autoTagsReconciled/);
  assert.match(main, /applyConfiguredCollectionTags\(duplicate\)/);
  assert.match(main, /target\.collectionId[\s\S]*applyConfiguredCollectionTags\(asset\)/);
  assert.match(main, /Object\.prototype\.hasOwnProperty\.call\(patch, 'collectionIds'\)/);
  assert.match(renderer, /appliedTags = result\.tags \|\| tags/);
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
  assert.match(renderer,/reconcileThumbnailCards\(changed\)/);
  assert.match(renderer,/card\.remove\(\)/);
  assert.match(renderer,/elements\.grid\.appendChild\(card\)/);
  assert.match(renderer,/renderSidebar\(false\)/);
  const helper=renderer.match(/async function addAssetsToCollectionWithoutGridRefresh[\s\S]*?\n\}/)?.[0]||'';
  assert.doesNotMatch(helper,/renderGrid\(/);
  assert.match(main,/if \(!options\.silent\) broadcast\(\)/);
});

test('thumbnail rotation patches affected cards without rebuilding the grid',()=>{
  assert.match(renderer,/function patchRotatedThumbnail/);
  assert.match(renderer,/preview\.classList\.toggle\('quarter-turned',quarterTurn\)/);
  assert.match(renderer,/card\.style\.setProperty\('--asset-ratio',ratio\)/);
  assert.match(renderer,/batchUpdateAssets\(ids,\{rotateBy:direction\},\{silent:true,returnAssets:true\}\)/);
  assert.match(renderer,/patchRotatedThumbnail\(asset\)/);
  const helper=renderer.match(/async function rotateThumbnailsWithoutGridRefresh[\s\S]*?\n\}/)?.[0]||'';
  assert.doesNotMatch(helper,/renderGrid\(/);
  assert.match(helper,/scheduleMasonry\(\)/);
});

test('Ctrl-click deselection clears stale borders and repaints only changed thumbnail cards',()=>{
  assert.match(renderer,/function paintCardSelection/);
  assert.match(renderer,/card\.setAttribute\('aria-selected',String\(selected\)\)/);
  assert.match(renderer,/if\(state\.selectedIds\.has\(id\)\)\{state\.selectedIds\.delete\(id\);state\.selectedId=state\.selectedIds\.values\(\)\.next\(\)\.value\|\|null/);
  assert.match(renderer,/paintChangedSelectionCards\(\[previousPrimary,id,state\.selectedId\]\)/);
  assert.match(renderer,/scheduleSelectionInspector\(\);return/);
  const ctrlBranch=renderer.match(/if \(event\.ctrlKey \|\| event\.metaKey\) \{[\s\S]*?scheduleSelectionInspector\(\);return;\n  \}/)?.[0]||'';
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
  assert.match(renderer, /\{ removeCollectionId: collectionId \}/);
  assert.match(renderer, /if \(!state\.selectedIds\.has\(id\)\) state\.selectedIds/);
  assert.match(renderer, /batchUpdateAssets\(selectedIds/);
  assert.doesNotMatch(renderer, /data-context-action="crop"/);
  assert.match(renderer, /selectedImageIds/);
  assert.match(renderer, /Rotate \$\{selectedImageIds\.length\} images/);
  assert.match(renderer, /rotationTargetLabel \+ ' left/);
  assert.match(renderer, /rotationTargetLabel \+ ' right/);
  assert.match(renderer, /rotateThumbnailsWithoutGridRefresh\(selectedImageIds/);
  assert.match(libraryCore, /Object\.hasOwn\(operation, 'rotateBy'\)/);
});

test('internal viewer is chrome-free with context actions, keyboard close, compact footer and wheel zoom', () => {
  assert.match(html, /<section id="media-viewer"/);
  assert.doesNotMatch(html, /<dialog id="media-viewer"/);
  assert.doesNotMatch(html,/id="close-viewer"/);
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
  assert.match(main, /startMediaServer/);
  assert.match(main, /streamable = asset\.kind === 'video' \|\| asset\.kind === 'audio'/);
  assert.match(main, /Content-Range/);
  assert.match(main, /fs\.createReadStream\(source, \{ start, end \}\)/);
  assert.match(main, /\.preview\.mp4/);
  assert.match(main, /libx264/);
  assert.match(main, /aes-256-gcm/);
  assert.match(main, /pbkdf2Sync/);
  assert.match(main, /duplicateAsset/);
  assert.match(main, /pipeline\.extract/);
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

test('internal drag moves collections and physical folders with targeted reconciliation',()=>{
  assert.match(renderer,/application\/x-pigeon-origin/);
  assert.match(renderer,/effectAllowed = 'move'/);
  assert.match(renderer,/removeCollectionId:sourceCollectionId/);
  assert.match(renderer,/moveAssetsToFolder/);
  assert.match(preload,/moveAssetsToFolder:/);
  assert.match(main,/assets:move-to-folder/);
  assert.match(main,/await fsp\.rename\(source,target\)/);
  assert.match(renderer,/reconcileThumbnailCards\(ids\)/);
  const collectionMove=renderer.match(/async function addAssetsToCollectionWithoutGridRefresh[\s\S]*?\n\}/)?.[0]||'';
  assert.doesNotMatch(collectionMove,/renderGrid\(/);
  const physicalDrop=renderer.match(/const enablePhysicalFolderDrop[\s\S]*?\n    \};/)?.[0]||'';
  assert.doesNotMatch(physicalDrop,/renderGrid\(/);
});

test('refresh, robust facets, folder drops, media hover scrubbing, and expanded formats are wired', () => {
  assert.match(html, /id="refresh-button"/);
  assert.match(preload, /refreshSources:/);
  assert.match(main, /library:refresh-sources/);
  assert.match(main, /staleAssets/);
  assert.match(renderer, /rating: 'ratings', shape: 'shapes', color: 'colors'/);
  assert.match(renderer, /attachHoverMediaPreview/);
  assert.match(renderer, /media\.currentTime = desiredTime/);
  assert.match(html, /data-pref="videoHoverPreview"/);
  assert.match(html, /data-pref="audioHoverPreview"/);
  assert.match(main, /createAudioThumbnail/);
  assert.match(main, /showwavespic/);
  for (const extension of ['.af', '.psd', '.pdf', '.pspimage', '.ogg', '.mp3', '.wav']) assert.match(main, new RegExp(extension.replace('.', '\\.')));
  assert.match(renderer, /enablePhysicalFolderDrop/);
  assert.match(renderer, /collectionId: target\.id/);
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
  assert.match(main, /failed: true/);
  assert.match(renderer, /Preview unavailable/);
  assert.match(renderer, /asset\.thumbnailPath \? asset\.previewUrl : asset\.mediaUrl/);
});

test('native PDF canvas is isolated from Pigeon main process',()=>{
  assert.match(main,/utilityProcess\.fork/);
  assert.match(main,/pdf-thumbnail-child\.js/);
  assert.match(main,/Isolated PDF preview process exited/);
  assert.doesNotMatch(packageJson,/"@napi-rs\/canvas"/);
  assert.match(fs.readFileSync(path.join(root,'electron','pdf-thumbnail-child.js'),'utf8'),/pdfjs-dist\/node_modules\/@napi-rs\/canvas/);
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
  assert.match(preload,/preload:uncaughtException/);
  assert.match(preload,/preload:unhandledRejection/);
  assert.match(preload,/reportFatal:/);
  assert.match(renderer,/renderer:unhandledrejection/);
  assert.match(renderer,/renderer:error/);
  assert.match(renderer,/securitypolicyviolation/);
});

test('large indexing applies system-stability backpressure and crash recovery', () => {
  assert.match(main,/PDF_WORKER_LIMIT = 2/);
  assert.match(main,/LARGE_SCAN_WORKER_LIMIT = 4/);
  assert.match(main,/MIN_FREE_MEMORY_BYTES/);
  assert.match(main,/os\.freemem\(\)/);
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
  assert.match(main,/if\(scanWorkActive\(\)\)\{scheduleSave\(\);return;\}/);
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
  assert.match(renderer,/else if\(wasEmpty&&added\)scheduleScanGridRender/);
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

test('huge folder trees are worker-built and bounded, console resizes/fullscreens, and twelve threads are allowed', () => {
  assert.match(html, /class="nav-item" data-view="untagged"/);
  for (const id of ['diagnostics-resizer','diagnostics-fullscreen']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(preload,/buildFolderTree/);
  assert.match(main,/folder-tree:build/);
  assert.match(main,/MAX_BACKGROUND_THREADS = 12/);
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
  assert.match(renderer,/pigeon\.inspectorPreviewCollapsed/);
  assert.match(styles,/\.inspector-preview-section\.collapsed \.preview-card \{ display:none/);
  assert.doesNotMatch(styles,/\.inspector-preview-section\.collapsed \.color-row/);
});

test('appearance typography, unclipped portfolio switcher, and PDF previews are wired', () => {
  assert.match(html, /data-preference-page="appearance"/);
  for (const preference of ['appFontFamily','appFontSize','consoleFontFamily','consoleFontSize']) assert.match(html, new RegExp(`data-pref="${preference}"`));
  assert.match(renderer, /applyTypographyPreferences/);
  assert.match(styles, /--app-font-family/);
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
  assert.match(renderer, /Export Collection/);
  assert.match(renderer, /Export Smart Folder/);
  assert.match(renderer, /Check for Updates/);
  assert.match(preload, /exportGroup/);
  assert.match(preload, /checkForUpdates/);
  assert.match(main, /library:export-group/);
  assert.match(main, /app:check-for-updates/);
  assert.match(main, /autoUpdater\.downloadUpdate/);
});

test('telemetry console and resumable CPU-limited parallel indexing are wired', () => {
  for (const id of ['telemetry-panel','telemetry-summary','telemetry-list']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-console-tab="telemetry"/);
  assert.match(preload, /getTelemetry/);
  assert.match(main, /telemetry:get/);
  assert.match(main, /INDEX_CPU_LIMIT = 30/);
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
  for (const id of ['diagnostics-copy-all','portfolio-transfer','portfolio-transfer-list','portfolio-transfer-move','confirm-portfolio-transfer']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(preload, /removeDiagnostic/);
  assert.match(preload, /transferToPortfolio/);
  assert.match(main, /diagnostics:remove/);
  assert.match(main, /portfolio:transfer/);
  assert.match(main, /excludedFolders/);
  assert.match(renderer, /data-copy-diagnostic/);
  assert.match(renderer, /data-remove-diagnostic/);
  assert.match(renderer, /diagnostics-copy-all/);
  assert.match(renderer, /Add to other portfolio/);
  assert.match(renderer, /openPortfolioTransfer/);
  assert.match(styles, /--tree-step: 18px/);
  assert.match(styles, /--sidebar-width: 275px/);
  assert.match(styles, /repeating-linear-gradient/);
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
  assert.match(styles, /grid-template-columns:12px 18px minmax\(110px,1fr\) 34px/);
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
  assert.match(renderer, /task\.completed >= task\.total/);
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
  assert.match(main,/folder:lock-now/);
  assert.match(main,/matchingFolderLocks\(asset\)/);
  assert.match(main,/settings:\{\.\.\.settings,folderLocks:publicFolderLocks\(\)\}/);
  assert.match(preload,/setFolderPassword/);
  assert.match(preload,/unlockFolder/);
  assert.match(renderer,/effectiveFolderLockRule/);
  assert.match(renderer,/Password protect folder/);
  assert.match(renderer,/lockFolderNow/);
  assert.match(renderer,/collection\.lockSourceId\|\|collection\.id/);
  assert.match(renderer,/folderLocked/);
});

test('nested collection trees, smart subfolders, and inline unlocking are wired', () => {
  assert.match(libraryCore, /function createSmartFolder\(library, name, filters = \{\}, parentId = null\)/);
  assert.match(libraryCore, /function moveSmartFolder/);
  assert.match(main, /smart-folder:move/);
  assert.match(preload, /moveSmartFolder/);
  assert.match(renderer, /appendSmartFolders/);
  assert.match(renderer, /New Smart Subfolder/);
  assert.match(renderer, /New Subfolder/);
  assert.match(renderer, /inline-unlock-form/);
  assert.doesNotMatch(renderer, /async function selectCollection\(id\)[\s\S]{0,180}ensureCollectionUnlocked/);
  for (const id of ['locked-content','inline-unlock-form','inline-unlock-password','inline-unlock-error']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(styles, /\.locked-content/);
  assert.match(styles, /\.collection-item::before/);
});

test('availability refresh and inline About Pigeon view are wired', () => {
  assert.match(main, /fsp\.access\(targetPath, fs\.constants\.F_OK\)/);
  assert.doesNotMatch(main, /Test-Path -LiteralPath/);
  assert.match(renderer, /if \(location\?\.checking\) return false/);
  assert.doesNotMatch(renderer, /asset\?\.sourcePending \|\|/);
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
  assert.match(renderer,/closeAboutView/);
  assert.match(renderer,/event\.key==='Escape'/);
  assert.match(renderer,/\$\('#about-dialog'\)\.addEventListener\('click',closeAboutView\)/);
  assert.match(icons, /github:/);
  assert.match(styles, /\.about-dialog \{ position:fixed; inset:0/);
  assert.match(html,/startup-brand about-brand/);
  assert.match(html,/id="about-title">pigeon<\/strong><span>sees all<\/span>/);
  assert.match(styles,/\.about-brand/);
});

test('custom shortcut actions combine configurable steps for the current selection',()=>{
  for(const id of ['new-shortcut-action','shortcut-actions-list','shortcut-action-dialog','shortcut-action-name','shortcut-action-key','shortcut-action-steps','add-shortcut-step','save-shortcut-action'])assert.match(html,new RegExp(`id="${id}"`));
  for(const label of ['Add Tags','Add to Collection','Set Rating','Add Description','Set Favourite','Clear Info'])assert.match(renderer,new RegExp(label));
  assert.match(renderer,/pigeon\.shortcutActions/);
  assert.match(renderer,/runShortcutAction/);
  assert.match(renderer,/shortcutActions\.find\(\(action\)=>action\.shortcut/);
  assert.match(renderer,/batchUpdateAssets\(ids,operationForShortcutStep/);
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
  assert.match(renderer,/batchUpdateAssets\(ids,\{trash:true\}\)/);
  assert.match(renderer,/emptyTrash\(preferences\.trashDeletionMode,ids\)/);
  assert.match(renderer,/result\.deletedIds/);
  assert.match(main,/selectedIds=Array\.isArray\(request\.ids\)\?new Set\(request\.ids\):null/);
  assert.match(main,/!selectedIds\|\|selectedIds\.has\(asset\.id\)/);
  assert.match(main,/deletedIds: \[\.\.\.removed\]/);
});

test('Analytics and All Tags preserve the previous library position for back and forward navigation',()=>{
  assert.match(renderer,/captureNavigationSnapshot/);
  assert.match(renderer,/rememberTemporaryViewOrigin/);
  assert.match(renderer,/if\(view==='tags'\)rememberTemporaryViewOrigin\(\)/);
  assert.match(renderer,/function openAnalytics[^\n]*rememberTemporaryViewOrigin\(\)/);
  assert.match(renderer,/gridScrollTop:Math\.max\(0,Number\(elements\.gridWrap\.scrollTop\)\|\|0\)/);
  assert.match(renderer,/\['analytics','tags'\]\.includes\(state\.view\)&&navigationReturnState/);
  assert.match(renderer,/navigation-back'\)\.addEventListener\('click',returnFromTemporaryView\)/);
  assert.match(renderer,/navigation-forward'\)\.addEventListener\('click',forwardToTemporaryView\)/);
  assert.match(renderer,/close-analytics'\)\.addEventListener\('click',\(\)=>\{if\(!returnFromTemporaryView\(\)\)/);
});

test('global background progress and scoped analytics are wired', () => {
  for (const id of ['background-progress', 'background-progress-fill', 'analytics-view', 'analytics-tabs', 'analytics-content', 'analytics-title']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-view="analytics"/);
  assert.match(preload, /onBackgroundProgress/);
  assert.match(main, /background:progress/);
  assert.match(main, /reportBackgroundProgress/);
  assert.match(main, /Adding files from/);
  assert.match(main, /Building media previews/);
  assert.match(main, /Analyzing file fingerprints/);
  assert.match(renderer, /renderBackgroundProgress/);
  assert.match(renderer, /function analyticsAssets/);
  assert.match(renderer, /function renderAnalytics/);
  assert.match(renderer, /analyticsHeatmap/);
  assert.match(renderer, /conic-gradient/);
  assert.match(renderer, /View Folder Analytics/);
  assert.match(renderer, /type: 'location'/);
  assert.match(renderer, /type: 'collection'/);
  assert.match(styles, /\.background-progress/);
  assert.match(styles, /\.analytics-heatmap/);
  assert.match(styles, /\.analytics-pie/);
});

test('Chrome and Edge Manifest V3 extension is installable and local-only', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'browser-extension', 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, 'service-worker.js');
  assert(!JSON.stringify(manifest).includes('nativeMessaging'));
  assert.match(fs.readFileSync(path.join(root, 'browser-extension', 'service-worker.js'), 'utf8'), /pigeon:\/\/import/);
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
