const state = {
  library: { locations: [], assets: [] },
  view: 'all',
  locationId: null,
  locationSubfolder: '',
  includeSubfolderContent: localStorage.getItem('pigeon.includeSubfolderContent') === 'true',
  collectionId: null,
  smartFolderId: null,
  selectedId: null,
  selectedIds: new Set(),
  selectionAnchorId: null,
  duplicateIds: new Set(),
  duplicateGroups: [],
  duplicateSimilarity: Math.max(35, Math.min(100, Number(localStorage.getItem('pigeon.duplicateSimilarity')) || 78)),
  duplicateSourceId: null,
  expandedStackIds: new Set(),
  similarIds: null,
  query: '',
  kind: 'visual',
  filters: {
    extensions: new Set(),
    ratings: new Set(),
    shapes: new Set(),
    locations: new Set(),
    tags: new Set(),
    colors: new Set()
  },
  openFacet: null,
  layout: 'grid',
  renderLimit: 480,
  virtualStart: 0,
  virtualMetrics: null,
  streamGeneration: 0,
  navigationRestoredPortfolioId: null,
  gridScrollTop: 0,
  uiZoom: 1,
  favoriteShortcut: '',
  locationShortcut: '',
  thumbnailEffectShortcut: 'B',
  thumbnailEffectRevealPressed: false,
  postMoveRevealUntil: 0,
  mapOpen: false,
  mapMode: 'globe',
  mapSelectionIds: [],
  mapPoint: null,
  mapCenter: { lat: 18, lon: 0 },
  mapZoom: 3,
  mapGlobeZoom: 1,
  encryptLockedFolders: false,
  confirmFolderMoves: true,
  thumbnailTitleLines: ['name', 'none', 'none'],
  tagDraftAssetId: null,
  viewerAssetId: null,
  viewerFit: true,
  viewerZoom: 1,
  viewerReturnScrollTop: 0,
  viewerCropMode: false,
  viewerCrop: null,
  annotationTool: 'rect',
  workingAnnotations: [],
  workingEdits: { rotate: 0, flip: false, brightness: 1, crop: null },
  analyticsScope: { type: 'portfolio', id: null, subfolder: '' },
  analyticsTab: 'overview',
  contactSheetIds: [],
  contactSheetLabels: true
};

const defaultTreeLevelColors=['#cbd0d8','#82b9ff','#78d5b0','#e2bd72','#d594dd','#ef8f8f'];
const preferenceDefaults = { theme: 'dark', treeLevelColors: [...defaultTreeLevelColors], thumbnailEffectMode:'blur',thumbnailEffectStrength:12,thumbnailEffectRevealKey:'Alt', trashDeletionMode: 'permanent', appFontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', appFontSize: 11, consoleFontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', consoleFontSize: 10, language: 'English', interfaceZoom: Number(localStorage.getItem('pigeon.windowZoom')) || 1, transparency: true, coloredTreeLevels: true, showCounts: true, launchOnLogin: false, lowResourceMode: true, hardwareAcceleration: true, videoProxiesOnDemand: true, showUncategorized: true, showUntagged: true, showFavorites: true, showTags: true, showDuplicates: true, showTrash: true, showAnalytics: true, showSmartFolders: true, showCollections: true, showLocations: true, wheelBehavior: 'scroll', hoverZoom: false, doubleClick: 'viewer', spacebar: 'preview', imageRendering: 'smooth', rememberViewerPosition: true, defaultImageSize: 'fit', transparentGrid: false, showAdditionalMetadata:false, videoHoverPreview: true, audioHoverPreview: true, videoAutoplay: false, videoMuted: true, videoLoopShort: false, screenshotFormat: 'PNG', screenshotNotify: true, screenshotTag: true, screenshotClipboard: false, soundEffects: false, popupNotifications: true, notifyDuplicates: false, notifyExtension: true, autoImport: false, autoImportFolder: '', localAiSearch: false, mcpEnabled: false, mcpAssets: true, mcpFolders: true, mcpTags: true, mcpSmartFolders: false };
let preferences = (() => { try { const saved={ ...preferenceDefaults, ...JSON.parse(localStorage.getItem('pigeon.preferences') || '{}') };saved.treeLevelColors=Array.isArray(saved.treeLevelColors)&&saved.treeLevelColors.length?[...saved.treeLevelColors]:[...defaultTreeLevelColors];return saved; } catch { return { ...preferenceDefaults,treeLevelColors:[...defaultTreeLevelColors] }; } })();
if (!localStorage.getItem('pigeon.videoAutoplayOptIn')) preferences.videoAutoplay = false;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const iconSvg = (name, className) => window.pigeonIcon(name, className);
const itemIcon = (item, fallback) => item?.icon || fallback;
const subfolderIconKey = (locationId, subfolder) => `${locationId}:${subfolder}`;
function applyStaticIcons() {
  const views = { all:'all', uncategorized:'folder-open', untagged:'tag', favorites:'heart', tags:'tags', duplicates:'duplicate', trash:'trash', analytics:'analytics', recent:'recent', offline:'offline', 'five-stars':'star' };
  for (const [view, icon] of Object.entries(views)) { const target = document.querySelector(`[data-view="${view}"] .nav-icon`); if (target) target.innerHTML = iconSvg(icon); }
  const preferenceIcons = { general:'settings', sidebar:'folder', controls:'filter', preview:'eye', screenshot:'camera', shortcuts:'key', notifications:'bell', password:'lock', 'auto-import':'download', 'ai-search':'search', 'ai-models':'smart', mcp:'link', developer:'code' };
  for (const [page, icon] of Object.entries(preferenceIcons)) { const button = document.querySelector(`[data-preference-page="${page}"]`); if (!button || button.querySelector('svg')) continue; button.innerHTML = `${iconSvg(icon)}<span>${button.textContent.replace(/^[^A-Za-z]+/, '')}</span>`; }
  const buttonIcons = [['#app-menu-button','menu'],['#navigation-back','back'],['#navigation-forward','forward'],['#refresh-button','refresh'],['#subfolder-content-toggle','folder-tree'],['#settings-button','settings'],['#quick-action-button','bolt'],['#layout-button','layout'],['#order-by-button','menu'],['#inspector-toggle','inspector'],['#filter-button','filter'],['#pin-button','pin'],['#sidebar-collapse','sidebar'],['#add-button','plus'],['#rescan-button','refresh'],['#save-smart-folder','plus'],['#add-collection','plus'],['#add-folder-mini','plus'],['#clear-filters','refresh']]; for (const [selector, icon] of buttonIcons) { const button = $(selector); if (button) button.innerHTML = iconSvg(icon); }
  const searchIcon = $('.search-box > span:first-child'), cameraIcon = $('.search-camera'); if (searchIcon) searchIcon.innerHTML = iconSvg('search'); if (cameraIcon) cameraIcon.innerHTML = iconSvg('camera');
}
const elements = {
  grid: $('#asset-grid'), empty: $('#empty-state'), tagBrowser: $('#tag-browser'), locationList: $('#location-list'),
  title: $('#view-title'), count: $('#view-count'), search: $('#search-input'),
  inspector: $('#inspector'), inspectorPlaceholder: $('#inspector-placeholder'), inspectorContent: $('#inspector-content'),
  inspectorImage: $('#inspector-image'), inspectorVideo: $('#inspector-video'), inspectorAudio: $('#inspector-audio'), inspectorFileIcon: $('#inspector-file-icon'), format: $('#inspector-format'), offline: $('#inspector-offline'),
  assetName: $('#asset-name'), note: $('#asset-note'), tags: $('#asset-tags'), tagPills: $('#tag-pills'), rating: $('#rating-row'),
  metaLocation: $('#meta-location'), metaFile: $('#meta-file'), metaSize: $('#meta-size'), metaModified: $('#meta-modified'),
  metaDimensions: $('#meta-dimensions'), metaColor: $('#meta-color'), metaHash: $('#meta-hash'), metaCamera: $('#meta-camera'), metaExposure: $('#meta-exposure'), metaGeo: $('#meta-geo'),
  mapView: $('#map-view'), mapCanvas: $('#location-map'), histogram: $('#asset-histogram'), palette: $('#asset-palette'),
  status: $('#status-text'), addMenu: $('#add-menu'), toast: $('#toast'), gridWrap: $('#grid-wrap'),
  facetPopover: $('#facet-popover'), appMenu: $('#app-menu'), appSubmenu: $('#app-submenu'), contextMenu: $('#asset-context-menu'),
  batchBar: $('#batch-bar'), batchCount: $('#batch-count'), annotationView: $('#annotation-view'), annotationStage: $('#annotation-stage'),
  mediaViewer: $('#media-viewer'), viewerImage: $('#viewer-image'), viewerVideo: $('#viewer-video'), viewerAudio: $('#viewer-audio'), viewerFile: $('#viewer-file'), viewerTextReader: $('#viewer-text-reader'), viewerTextContent: $('#viewer-text-content'),
  viewerMinimap: $('#viewer-minimap'), viewerMinimapImage: $('#viewer-minimap-image'), viewerMinimapViewport: $('#viewer-minimap-viewport'),
  sentinel: $('#grid-sentinel'), emptyTitle: $('#empty-title'), emptyDescription: $('#empty-description'), emptyActions: $('#empty-actions'),
  analyticsView: $('#analytics-view'), analyticsContent: $('#analytics-content'), backgroundProgress: $('#background-progress'), lockedContent: $('#locked-content'), contactSheetView: $('#contact-sheet-view'), contactSheetPages: $('#contact-sheet-pages')
};
let masonryFrame,navigationPaintFrame=null,navigationRenderGeneration=0,searchRenderFrame=null,marqueeSelection=null,marqueeScrollFrame=null,suppressMarqueeClick=false,hoverFitPreviewTimer=null;
const pendingThumbnailCards=new Set();let thumbnailSettleTimer=null,thumbnailLoadsActive=0,thumbnailScrollUntil=0;const MAX_THUMBNAIL_LOADS=4;
function scheduleSettledThumbnailLoads(){clearTimeout(thumbnailSettleTimer);thumbnailSettleTimer=setTimeout(drainThumbnailLoads,Math.max(180,thumbnailScrollUntil-Date.now()));}
function drainThumbnailLoads(){if(Date.now()<thumbnailScrollUntil){scheduleSettledThumbnailLoads();return;}while(thumbnailLoadsActive<MAX_THUMBNAIL_LOADS&&pendingThumbnailCards.size){const card=pendingThumbnailCards.values().next().value;pendingThumbnailCards.delete(card);if(!card.isConnected)continue;const preview=card.querySelector('.asset-preview'),source=preview?.dataset.thumbnailSrc;if(!preview||!source)continue;thumbnailLoadsActive+=1;preview.removeAttribute('data-thumbnail-src');const image=new Image();image.alt='';image.decoding='async';image.style.transform=preview.dataset.thumbnailTransform||'';const finish=()=>{thumbnailLoadsActive-=1;setTimeout(drainThumbnailLoads,24);};image.onload=async()=>{try{await image.decode();}catch{}if(image.naturalWidth&&card.isConnected){image.classList.add('thumbnail-loaded');preview.appendChild(image);card.querySelector('.asset-image-placeholder')?.remove();if(preview.classList.contains('quarter-turned'))fitRotatedThumbnail(image);scheduleMasonry();}else card.classList.add('thumbnail-load-failed');finish();};image.onerror=()=>{card.classList.add('thumbnail-load-failed');finish();};image.src=source;}}
const thumbnailVisibilityObserver=new IntersectionObserver((entries)=>{for(const entry of entries){if(entry.isIntersecting)pendingThumbnailCards.add(entry.target);else pendingThumbnailCards.delete(entry.target);}scheduleSettledThumbnailLoads();},{root:elements.gridWrap,rootMargin:'360px 0px'});
const rotatedThumbnailObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const preview = entry.target, image = preview.querySelector(':scope > img'); if (!image) continue;
    const width = preview.clientWidth, height = preview.clientHeight; if (!width || !height) continue;
    preview.style.setProperty('--rotated-image-width', `${height}px`); preview.style.setProperty('--rotated-image-height', `${width}px`);
  }
  scheduleMasonry();
});
let resizeTimer;
let lastFilenameClick = { assetId: null, time: 0 };
let startupSplashFinished = false,startupReady=false;
const startupStartedAt=performance.now(),STARTUP_SPLASH_MINIMUM_MS=2000;
const startupSplashDeadline = setTimeout(() => {startupReady=true;finishStartupSplash();},10000);
function finishStartupSplash() {
  startupReady=true;if(startupSplashFinished)return; const remaining=Math.max(0,STARTUP_SPLASH_MINIMUM_MS-(performance.now()-startupStartedAt));
  if(remaining){setTimeout(finishStartupSplash,remaining);return;} startupSplashFinished=true;clearTimeout(startupSplashDeadline);
  const splash=$('#startup-splash');if(!splash)return; splash.classList.add('finishing');setTimeout(()=>{splash.classList.add('hidden');$('.app-shell').classList.remove('startup-active');},180);
}
let streamRenderTimer,scanRenderHandle=null,lastUserInteractionAt=0;
const rendererAssetIndexes=new Map();
for(const eventName of ['pointerdown','keydown','wheel','input'])window.addEventListener(eventName,()=>{lastUserInteractionAt=performance.now();},{capture:true,passive:true});
let annotationStart;
let viewerPanStart;
let viewerCropDrag;
let suppressGridScroll = false;
const savedLayout = localStorage.getItem('pigeon.layout');
if (['grid', 'justified', 'list'].includes(savedLayout)) state.layout = savedLayout;
const savedThumbnailSize = Number(localStorage.getItem('pigeon.thumbnailSize'));
if (Number.isFinite(savedThumbnailSize) && savedThumbnailSize >= Number($('#zoom-slider').min) && savedThumbnailSize <= Number($('#zoom-slider').max)) { $('#zoom-slider').value=String(savedThumbnailSize);document.documentElement.style.setProperty('--card-width',`${savedThumbnailSize}px`); }
document.documentElement.style.setProperty('--justified-row-height', `${Math.max(52, Math.min(320, Number($('#zoom-slider').value) * .58))}px`);
const savedSidebarWidth = Number(localStorage.getItem('pigeon.sidebarWidth'));
const savedInspectorWidth = Number(localStorage.getItem('pigeon.inspectorWidth'));
if (Number.isFinite(savedSidebarWidth) && savedSidebarWidth >= 260 && savedSidebarWidth <= 480) document.documentElement.style.setProperty('--sidebar-width', `${savedSidebarWidth}px`);
if (Number.isFinite(savedInspectorWidth) && savedInspectorWidth >= 220 && savedInspectorWidth <= 600) document.documentElement.style.setProperty('--inspector-width', `${savedInspectorWidth}px`);
const savedWindowZoom = Number(localStorage.getItem('pigeon.windowZoom'));
state.uiZoom = Number.isFinite(savedWindowZoom) ? Math.max(.6, Math.min(2, savedWindowZoom)) : 1;
state.favoriteShortcut = localStorage.getItem('pigeon.favoriteShortcut') || '';
state.locationShortcut = localStorage.getItem('pigeon.locationShortcut') || '';
state.thumbnailEffectShortcut=localStorage.getItem('pigeon.thumbnailEffectShortcut')||'B';
let shortcutActions = (() => { try { const value=JSON.parse(localStorage.getItem('pigeon.shortcutActions')||'[]'); return Array.isArray(value)?value:[]; } catch { return []; } })();
state.encryptLockedFolders = localStorage.getItem('pigeon.encryptLockedFolders') === 'true';
state.confirmFolderMoves = localStorage.getItem('pigeon.confirmFolderMoves') !== 'false';
const thumbnailTitleFields = new Set(['none', 'name', 'filename', 'dimensions', 'type', 'size', 'rating', 'date', 'folder', 'tags']);
state.thumbnailTitleLines = state.thumbnailTitleLines.map((fallback, index) => { const value = localStorage.getItem(`pigeon.thumbnailTitleLine${index + 1}`); return thumbnailTitleFields.has(value) ? value : fallback; });
window.pigeon.setWindowZoom(state.uiZoom);

function libraryCoreSafe(library) { return { locations: [], assets: [], collections: [], smartFolders: [], portfolios: [], activePortfolioId: null, settings: {}, ...library }; }
const persistentViews = new Set(['all', 'uncategorized', 'untagged', 'favorites', 'tags', 'duplicates', 'trash', 'analytics', 'recent', 'offline', 'five-stars']);
let navigationReturnState=null,navigationForwardState=null;
function captureNavigationSnapshot(){return{view:state.view,locationId:state.locationId,locationSubfolder:state.locationSubfolder,collectionId:state.collectionId,smartFolderId:state.smartFolderId,kind:state.kind,query:state.query,filters:Object.fromEntries(Object.entries(state.filters).map(([name,values])=>[name,[...values]])),gridScrollTop:Math.max(0,Number(elements.gridWrap.scrollTop)||0),title:elements.title.textContent,duplicateSourceId:state.duplicateSourceId};}
function applyNavigationSnapshot(saved){if(!saved)return false;state.view=persistentViews.has(saved.view)?saved.view:'all';state.locationId=saved.locationId&&state.library.locations.some((item)=>item.id===saved.locationId)?saved.locationId:null;state.locationSubfolder=state.locationId?String(saved.locationSubfolder||''):'';state.collectionId=saved.collectionId&&state.library.collections.some((item)=>item.id===saved.collectionId)?saved.collectionId:null;state.smartFolderId=saved.smartFolderId&&state.library.smartFolders.some((item)=>item.id===saved.smartFolderId)?saved.smartFolderId:null;state.kind=['visual','all','image','video','audio','document','font','file'].includes(saved.kind)?saved.kind:'visual';state.query=String(saved.query||'').slice(0,500);elements.search.value=state.query;for(const[name,values]of Object.entries(state.filters)){values.clear();for(const value of Array.isArray(saved.filters?.[name])?saved.filters[name]:[])values.add(value);}state.duplicateSourceId=state.view==='duplicates'?saved.duplicateSourceId||null:null;state.gridScrollTop=Math.max(0,Number(saved.gridScrollTop)||0);elements.title.textContent=restoredNavigationTitle({...saved,locationId:state.locationId,collectionId:state.collectionId,smartFolderId:state.smartFolderId,view:state.view});clearSelection();resetRenderLimit();render();updateNavigationButtons();return true;}
function rememberTemporaryViewOrigin(){if(!['analytics','tags'].includes(state.view))navigationReturnState=captureNavigationSnapshot();navigationForwardState=null;updateNavigationButtons();}
function updateNavigationButtons(){$('#navigation-back').disabled=!navigationReturnState;$('#navigation-forward').disabled=!navigationForwardState;}
function returnFromTemporaryView(){if(!navigationReturnState)return false;navigationForwardState=captureNavigationSnapshot();const target=navigationReturnState;navigationReturnState=null;return applyNavigationSnapshot(target);}
function forwardToTemporaryView(){if(!navigationForwardState)return false;navigationReturnState=captureNavigationSnapshot();const target=navigationForwardState;navigationForwardState=null;return applyNavigationSnapshot(target);}
function navigationKey(portfolioId = state.library.activePortfolioId) { return portfolioId ? `pigeon.navigation.${portfolioId}` : null; }
function saveNavigationState() {
  const key = navigationKey();
  if (!key || state.navigationRestoredPortfolioId !== state.library.activePortfolioId || state.library.loading) return;
  if(['analytics','tags'].includes(state.view)&&navigationReturnState){localStorage.setItem(key,JSON.stringify(navigationReturnState));return;}
  const filters = Object.fromEntries(Object.entries(state.filters).map(([name, values]) => [name, [...values]]));
  localStorage.setItem(key, JSON.stringify({ view: state.view, locationId: state.locationId, locationSubfolder: state.locationSubfolder, collectionId: state.collectionId, smartFolderId: state.smartFolderId, kind: state.kind, query: state.query, filters, gridScrollTop: state.gridScrollTop, title: elements.title.textContent, duplicateSourceId: state.duplicateSourceId }));
}
function restoredNavigationTitle(saved) {
  if (saved.locationId) { const location = state.library.locations.find((item) => item.id === saved.locationId); return saved.locationSubfolder?.split('/').pop() || location?.name || 'Location'; }
  if (saved.collectionId) return state.library.collections.find((item) => item.id === saved.collectionId)?.name || 'Collection';
  if (saved.smartFolderId) return state.library.smartFolders.find((item) => item.id === saved.smartFolderId)?.name || 'Smart folder';
  const labels = { all: 'All', uncategorized: 'Uncategorized', untagged: 'Untagged', favorites: 'Favorites', tags: 'All Tags', duplicates: 'Duplicates', trash: 'Trash', analytics: 'Analytics', recent: 'Recently added', offline: 'Offline sources', 'five-stars': '5 stars' };
  return saved.title || labels[saved.view] || 'All';
}
function restoreNavigationState() {
  const portfolioId = state.library.activePortfolioId, key = navigationKey(portfolioId); let saved;
  try { saved = key ? JSON.parse(localStorage.getItem(key) || 'null') : null; } catch { saved = null; }
  const locationId = saved?.locationId && state.library.locations.some((item) => item.id === saved.locationId) ? saved.locationId : null;
  const collectionId = saved?.collectionId && state.library.collections.some((item) => item.id === saved.collectionId) ? saved.collectionId : null;
  const smartFolderId = saved?.smartFolderId && state.library.smartFolders.some((item) => item.id === saved.smartFolderId) ? saved.smartFolderId : null;
  state.view = persistentViews.has(saved?.view) ? saved.view : 'all'; state.locationId = locationId; state.locationSubfolder = locationId ? String(saved?.locationSubfolder || '') : ''; state.collectionId = collectionId; state.smartFolderId = smartFolderId;
  state.kind = ['visual', 'all', 'image', 'video', 'audio', 'document', 'font', 'file'].includes(saved?.kind) ? saved.kind : 'visual'; state.query = String(saved?.query || '').slice(0, 500); elements.search.value = state.query;
  for (const [name, values] of Object.entries(state.filters)) { values.clear(); for (const value of Array.isArray(saved?.filters?.[name]) ? saved.filters[name] : []) values.add(value); }
  state.duplicateSourceId = state.view === 'duplicates' ? saved?.duplicateSourceId || null : null;
  state.gridScrollTop = Math.max(0, Number(saved?.gridScrollTop) || 0); elements.title.textContent = restoredNavigationTitle({ ...saved, locationId, collectionId, smartFolderId, view: state.view }); state.navigationRestoredPortfolioId = portfolioId;
}
function locationFor(asset) { return state.library.locations.find((location) => location.id === asset.locationId); }
function isOffline(asset) { const location = locationFor(asset); if (location?.checking) return false; return Boolean(asset?.sourceMissing || location?.online === false); }
function protectedUrl(url) { return state.collectionId && url ? `${url}&collection=${encodeURIComponent(state.collectionId)}` : url; }
function rotationTransform(asset, thumbnail = false) { const rotation = Number(asset.rotation) || 0; return rotation ? `rotate(${rotation}deg) scale(${thumbnail && rotation % 180 ? .82 : 1})` : ''; }
function thumbnailTitle(asset, field) {
  if (field === 'name') return asset.name || asset.filename;
  if (field === 'filename') return asset.filename;
  if (field === 'dimensions') return asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'Dimensions unavailable';
  if (field === 'type') return `${asset.kind} · ${asset.extension}`;
  if (field === 'size') return formatBytes(asset.size);
  if (field === 'rating') return asset.rating ? `${'★'.repeat(asset.rating)}${'☆'.repeat(5 - asset.rating)}` : 'Unrated';
  if (field === 'date') return formatDate(asset.modified);
  if (field === 'folder') { const parts = String(asset.path || '').replace(/\\/g, '/').split('/'); return parts.length > 1 ? parts[parts.length - 2] : '';
  }
  if (field === 'tags') return (asset.tags || []).join(', ') || 'No tags';
  return '';
}
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes, index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value < 10 && index ? value.toFixed(1) : Math.round(value)} ${units[index]}`;
}
function formatDate(value) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }
function iconFor(kind) { return ({ video:'▶', audio:'♫', font:'Aa', document:'▤', file:'◆' })[kind] || '◆'; }
function formatMediaTime(seconds) { const safe = Math.max(0, Number(seconds) || 0), hours = Math.floor(safe / 3600), minutes = Math.floor(safe % 3600 / 60), remainder = Math.floor(safe % 60); return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`; }
let hoveredVideoSoundSync=null;window.pigeon.onHoverControl?.((pressed)=>hoveredVideoSoundSync?.(pressed));
function attachHoverMediaPreview(card, asset) {
  const animatedImage=asset.kind==='image'&&['GIF','WEBP'].includes(String(asset.extension).toUpperCase());
  if(isOffline(asset)||(!animatedImage&&!['video','audio'].includes(asset.kind)))return;
  const enabled=()=>animatedImage||asset.kind==='video'?preferences.videoHoverPreview:preferences.audioHoverPreview;
  const preview=card.querySelector('.asset-preview'),protectedMotion=Boolean(asset.thumbnailEffect&&(animatedImage||asset.kind==='video'));let media=null,desiredTime=null,controlHeld=false,hovering=false;const syncHoverVideoSound=(pressed=controlHeld)=>{controlHeld=pressed;if(media instanceof HTMLVideoElement)media.muted=!controlHeld;};const keyDown=(event)=>{if(event.key!=='Control'||event.repeat)return;controlHeld=true;syncHoverVideoSound();};const keyUp=(event)=>{if(event.key!=='Control')return;controlHeld=false;syncHoverVideoSound();};
  const seekFromPointer = (event) => {
    if (!media) return; const rect = preview.getBoundingClientRect(), ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), duration = Number.isFinite(media.duration) ? media.duration : Number(asset.duration) || 0;
    desiredTime = duration * ratio; if (duration) { try { media.currentTime = desiredTime; } catch {} }
    preview.style.setProperty('--scrub-position', `${ratio * 100}%`); const time = preview.querySelector('.media-scrub-time'); if (time) time.textContent = formatMediaTime(desiredTime);
  };
  const start=(event,revealEvent=false)=>{if(!enabled()||media||(protectedMotion&&!state.thumbnailEffectRevealPressed&&!revealEvent))return;controlHeld=Boolean(event?.ctrlKey);if(animatedImage){media=document.createElement('img');media.className='thumbnail-hover-media animated-image';media.alt='';media.src=protectedUrl(asset.mediaUrl);preview.appendChild(media);preview.classList.add('animated-hovering');return;}media=document.createElement(asset.kind);media.className=`thumbnail-hover-media ${asset.kind}`;media.src=asset.mediaUrl;media.preload='metadata';media.loop=true;media.muted=asset.kind==='video';media.playsInline=true;preview.appendChild(media);if(asset.kind==='video'){syncHoverVideoSound();hoveredVideoSoundSync=syncHoverVideoSound;window.pigeon.monitorHoverControl(true);window.addEventListener('keydown',keyDown,true);window.addEventListener('keyup',keyUp,true);}preview.classList.add('media-hovering');media.addEventListener('loadedmetadata',()=>{if(desiredTime!==null)media.currentTime=desiredTime;media.play().catch(()=>{});},{once:true});media.play().catch(()=>{});};
  const stop=()=>{if(!media)return;window.removeEventListener('keydown',keyDown,true);window.removeEventListener('keyup',keyUp,true);if(hoveredVideoSoundSync===syncHoverVideoSound){hoveredVideoSoundSync=null;window.pigeon.monitorHoverControl(false);}controlHeld=false;if(!animatedImage){media.muted=true;media.pause();media.removeAttribute('src');media.load();}media.remove();media=null;desiredTime=null;preview.classList.remove('media-hovering','animated-hovering');preview.style.removeProperty('--scrub-position');};
  const revealDown=(event)=>{if(protectedMotion&&hovering&&revealShortcutPressed(event))start(event,true);},revealUp=(event)=>{if(protectedMotion&&revealShortcutPressed(event))stop();},enter=(event)=>{hovering=true;if(protectedMotion){window.addEventListener('keydown',revealDown,true);window.addEventListener('keyup',revealUp,true);}start(event);},leave=()=>{hovering=false;window.removeEventListener('keydown',revealDown,true);window.removeEventListener('keyup',revealUp,true);stop();};
  preview.addEventListener('pointerenter', enter); preview.addEventListener('pointermove', seekFromPointer); preview.addEventListener('pointerleave', leave); card.addEventListener('dragstart', leave);
}
function shapeFor(asset) {
  if (!asset.width || !asset.height) return 'unknown';
  const ratio = asset.width / asset.height;
  if (ratio >= 2.4) return 'panoramic';
  if (ratio >= 1.12) return 'horizontal';
  if (ratio <= 0.42) return 'tall';
  if (ratio <= 0.88) return 'vertical';
  return 'square';
}
function colorDistance(first, second) {
  const channels = (value) => [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  const [r1, g1, b1] = channels(first), [r2, g2, b2] = channels(second);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}
function hasActiveFilters() { return Object.values(state.filters).some((values) => values?.size); }
function serializedFilters() {
  return {
    extensions: [...state.filters.extensions], ratings: [...state.filters.ratings], tags: [...state.filters.tags],
    locationIds: [...state.filters.locations], query: state.query, favorite: state.view === 'favorites' || undefined,
    collectionIds: state.collectionId ? [state.collectionId] : []
  };
}
function matchesSmartRule(asset, rule) {
  const values = rule.field === 'tags' ? asset.tags || [] : rule.field === 'collection' ? asset.collectionIds || [] : [rule.field === 'name' ? asset.filename || asset.name : rule.field === 'type' ? asset.kind : rule.field === 'folder' ? asset.path : rule.field === 'rating' ? Number(asset.rating) || 0 : rule.field === 'favorite' ? String(Boolean(asset.favorite)) : rule.field === 'privacyEffect' ? String(Boolean(asset.thumbnailEffect)) : ''];
  const expected = String(rule.value || '').toLowerCase(), operator = rule.operator || 'contains';
  if (operator === 'null') return values.length === 0 || values.every((value) => !String(value).trim()); if (operator === 'not-null') return values.some((value) => String(value).trim());
  if (rule.field === 'rating' && ['less-than','less-than-equal','greater-than','greater-than-equal'].includes(operator)) { const actual = Number(values[0]), target = Number(rule.value); if (!Number.isFinite(target)) return false; if (operator === 'less-than') return actual < target; if (operator === 'less-than-equal') return actual <= target; if (operator === 'greater-than') return actual > target; return actual >= target; }
  const tests = values.map((value) => { const actual = String(value).toLowerCase(); if (operator === 'equals') return actual === expected; if (operator === 'excludes') return !actual.includes(expected); if (operator === 'begins') return actual.startsWith(expected); if (operator === 'ends') return actual.endsWith(expected); if (operator === 'regex') { try { return new RegExp(rule.value, 'i').test(String(value)); } catch { return false; } } return actual.includes(expected); });
  return operator === 'excludes' ? tests.every(Boolean) : tests.some(Boolean);
}
function matchesSavedFilters(asset, filters = {}) {
  if (filters.rules?.length) { const matches = filters.rules.map((rule) => matchesSmartRule(asset, rule)); if (filters.ruleMatch === 'any' ? !matches.some(Boolean) : !matches.every(Boolean)) return false; }
  if (filters.extensions?.length && !filters.extensions.includes(String(asset.extension || '').toLowerCase())) return false;
  if (filters.ratings?.length && !filters.ratings.includes(asset.rating || 0)) return false;
  if (filters.tags?.length && !filters.tags.some((tag) => (asset.tags || []).includes(tag))) return false;
  if (filters.locationIds?.length && !filters.locationIds.includes(asset.locationId)) return false;
  if (filters.collectionIds?.length && !filters.collectionIds.some((id) => (asset.collectionIds || []).includes(id))) return false;
  if (filters.favorite && !asset.favorite) return false;
  return !filters.query || [asset.filename, asset.path, asset.note, ...(asset.tags || [])].join(' ').toLowerCase().includes(filters.query.toLowerCase());
}
function refreshDuplicateIds() {
  const groups = new Map();
  for (const asset of state.library.assets) {
    if (!asset.contentHash) continue;
    const key = asset.contentHash;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(asset.id);
  }
  if (!state.duplicateGroups.length) state.duplicateGroups = [...groups.values()].filter((ids) => ids.length > 1);
  state.duplicateIds = new Set(state.duplicateGroups.flat());
}
let similarityRefreshGeneration = 0, similarityRefreshPromise = null, lastSimilarityRefreshAt = 0;
async function refreshSimilarityGroups(renderAfter = true) {
  if (!renderAfter&&!state.duplicateSourceId&&Date.now()-lastSimilarityRefreshAt<5000) return;
  const generation=++similarityRefreshGeneration,sourceId=state.duplicateSourceId,request=(async()=>{
    try {
      const groups=await window.pigeon.findSimilarGroups(state.duplicateSimilarity,sourceId);
      if(generation!==similarityRefreshGeneration||sourceId!==state.duplicateSourceId)return;
      state.duplicateGroups=groups;state.duplicateIds=new Set(groups.flat());
      lastSimilarityRefreshAt=Date.now();if(renderAfter&&state.view==='duplicates'){resetRenderLimit();render();}
      else $('#duplicates-count').textContent=state.duplicateIds.size;
    } catch(error){if(generation===similarityRefreshGeneration)showToast(error.message);}
    finally{if(similarityRefreshPromise===request)similarityRefreshPromise=null;}
  })();similarityRefreshPromise=request;return request;
}

function thumbnailSizeScopeKey(){if(state.collectionId)return`collection:${state.collectionId}`;if(state.smartFolderId)return`smart:${state.smartFolderId}`;if(state.locationId)return`location:${state.locationId}:${state.locationSubfolder||''}`;return`view:${state.view}`;}
function thumbnailSizeStorage(){return`pigeon.thumbnailSizes.${state.library.activePortfolioId||'default'}`;}
function thumbnailSizeSettings(){try{return JSON.parse(localStorage.getItem(thumbnailSizeStorage())||'{}');}catch{return{};}}
function portfolioThumbnailDefault(){const value=Number(thumbnailSizeSettings().default);return Number.isFinite(value)?value:240;}
function restoreScopedThumbnailSize(){const settings=thumbnailSizeSettings(),value=Number(settings.scopes?.[thumbnailSizeScopeKey()]??settings.default??240);setThumbnailZoom(value,{persist:false,render:false});}
function assetOrderScopeKey(){if(state.collectionId)return`collection:${state.collectionId}`;if(state.smartFolderId)return`smart:${state.smartFolderId}`;if(state.locationId)return`location:${state.locationId}:${state.locationSubfolder||''}`;return`view:${state.view}`;}
function currentAssetOrder(){return state.library.settings?.assetOrders?.[assetOrderScopeKey()]||{field:'modified',direction:'desc'};}
function filteredAssets() {
  let assets = state.library.assets.filter((asset) => !asset.locked);
  assets = assets.filter((asset) => state.view === 'trash'&&!state.locationId&&!state.collectionId&&!state.smartFolderId ? Boolean(asset.deletedAt) : !asset.deletedAt);
  if (state.locationId) {
    assets = assets.filter((asset) => asset.locationId === state.locationId);
    const location = state.library.locations.find((item) => item.id === state.locationId);
    if (location?.type === 'folder') {
      const root = String(location.path || '').replace(/\\/g, '/').replace(/\/$/, ''), selectedFolder = `${root}${state.locationSubfolder ? `/${state.locationSubfolder}` : ''}`.toLowerCase();
      assets = assets.filter((asset) => { const source = String(asset.path || '').replace(/\\/g, '/').toLowerCase(), parent = source.slice(0, source.lastIndexOf('/')); return state.includeSubfolderContent ? source.startsWith(`${selectedFolder}/`) : parent === selectedFolder; });
    }
  }
  else if (state.collectionId) assets = assets.filter((asset) => (asset.collectionIds || []).includes(state.collectionId));
  else if (state.smartFolderId) {
    const smartFolder = (state.library.smartFolders || []).find((item) => item.id === state.smartFolderId);
    if (smartFolder) assets = assets.filter((asset) => matchesSavedFilters(asset, smartFolder.filters));
  }
  else if (state.view === 'uncategorized') assets = assets.filter((asset) => !(asset.tags || []).length && !(asset.collectionIds || []).length);
  else if (state.view === 'untagged') assets = assets.filter((asset) => !(asset.tags || []).length);
  else if (state.view === 'favorites') assets = assets.filter((asset) => asset.favorite);
  else if (state.view === 'offline') assets = assets.filter(isOffline);
  else if (state.view === 'five-stars') assets = assets.filter((asset) => asset.rating === 5);
  else if (state.view === 'recent') assets = assets.filter((asset) => Date.now() - asset.indexedAt < 1000 * 60 * 60 * 24 * 7);
  else if (state.view === 'duplicates') assets = assets.filter((asset) => state.duplicateIds.has(asset.id));
  if (state.similarIds) assets = assets.filter((asset) => state.similarIds.has(asset.id));
  if (!['trash', 'duplicates', 'untagged'].includes(state.view) && !state.filters.extensions.size && state.kind === 'visual') assets = assets.filter((asset) => asset.kind === 'image' || asset.kind === 'video');
  else if (!['trash', 'duplicates', 'untagged'].includes(state.view) && !state.filters.extensions.size && state.kind !== 'all') assets = assets.filter((asset) => asset.kind === state.kind);
  if (state.filters.extensions.size) assets = assets.filter((asset) => state.filters.extensions.has(asset.extension.toLowerCase()));
  if (state.filters.ratings.size) assets = assets.filter((asset) => state.filters.ratings.has(asset.rating || 0));
  if (state.filters.shapes.size) assets = assets.filter((asset) => state.filters.shapes.has(shapeFor(asset)));
  if (state.filters.locations.size) assets = assets.filter((asset) => state.filters.locations.has(asset.locationId));
  if (state.filters.tags.size) assets = assets.filter((asset) => [...state.filters.tags].some((tag) => (asset.tags || []).some((assetTag) => assetTag.toLowerCase() === tag.toLowerCase())));
  if (state.filters.colors.size) assets = assets.filter((asset) => asset.dominantColor && [...state.filters.colors].some((color) => colorDistance(color, asset.dominantColor) < 105));
  if (state.query.trim()) {
    const query = state.query.trim().toLowerCase();
    assets = assets.filter((asset) => [asset.filename, asset.path, asset.note, ...(asset.tags || [])].join(' ').toLowerCase().includes(query));
  }
  const order=currentAssetOrder(),factor=order.direction==='asc'?1:-1,sorted=assets.sort((a,b)=>{const first=order.field==='name'?String(a.name||a.filename||'').toLowerCase():Number(a[order.field])||0,second=order.field==='name'?String(b.name||b.filename||'').toLowerCase():Number(b[order.field])||0,difference=typeof first==='string'?first.localeCompare(second):first-second;return difference*factor||String(a.id).localeCompare(String(b.id));});
  if (state.view === 'duplicates'||state.smartFolderId) return sorted;
  const seenStacks = new Set();
  return sorted.filter((asset) => {
    if (!asset.stackId || state.expandedStackIds.has(asset.stackId)) return true;
    if (seenStacks.has(asset.stackId)) return false;
    seenStacks.add(asset.stackId); return true;
  });
}

async function ensureCollectionUnlocked(collection) {
  if (!collection?.locked) return true;
  const password = await requestText({ title: `Unlock ${collection.name}`, label: 'Password', type: 'password', confirmText: 'Unlock' });
  if (password === null) return false;
  const unlocked = await window.pigeon.unlockCollection(collection.lockSourceId||collection.id, password);
  if (!unlocked) { showToast('Incorrect password'); return false; }
  collection.locked = false;
  return true;
}
async function editCollectionAutoTags(collection) {
  const current = state.library.settings?.collectionAutoTags?.[collection.id]?.tags || [];
  const tags = await requestTagSet({ title: current.length ? 'Edit Folder Auto-Tag' : 'Set Folder Auto-Tag', message: `These tags apply to all current and future contents of “${collection.name}”, including nested collections.`, tags: current, confirmText: current.length ? 'Save' : 'Create' });
  if (tags === null) return;
  const result = await window.pigeon.setCollectionAutoTags(collection.id, tags), appliedTags = result.tags || tags,updates=new Map((result.assets||[]).map((asset)=>[asset.id,asset]));
  state.library.settings = state.library.settings || {}; state.library.settings.collectionAutoTags = state.library.settings.collectionAutoTags || {};
  if (appliedTags.length) state.library.settings.collectionAutoTags[collection.id] = { collectionId: collection.id, tags: appliedTags, updatedAt: Date.now() }; else delete state.library.settings.collectionAutoTags[collection.id];
  const descendants = new Set([collection.id]); let descendantsChanged = true; while (descendantsChanged) { descendantsChanged = false; for (const item of state.library.collections || []) if (item.parentId && descendants.has(item.parentId) && !descendants.has(item.id)) { descendants.add(item.id); descendantsChanged = true; } }
  const changed=[];for(const asset of state.library.assets)if(updates.has(asset.id)){Object.assign(asset,updates.get(asset.id));changed.push(asset.id);}const smartMayChange=currentSmartFolderDependsOnTags();if(state.smartFolderId&&smartMayChange){reconcileThumbnailCards(changed,{sidebar:false});renderSidebar(false);}else{patchTagMetadataCards(changed);renderSidebar(false);renderInspector();}showToast(appliedTags.length ? `${appliedTags.length} automatic tag${appliedTags.length === 1 ? '' : 's'} applied to ${result.updated} item${result.updated === 1 ? '' : 's'}` : 'Folder Auto-Tag removed');
}
function showCollectionContextMenu(event, collection) {
  const autoTags = state.library.settings?.collectionAutoTags?.[collection.id]?.tags || [], hasChildren = state.library.collections.some((item) => item.parentId === collection.id), collapseKey = collectionCollapseKey(collection.id);
  elements.contextMenu.innerHTML = `<button data-folder-action="new-subfolder">${iconSvg('folder')}<span>New Subfolder…</span></button><button data-folder-action="contact-sheet">${iconSvg('layout')}<span>Contact Sheet…</span></button><button data-folder-action="duplicate">${iconSvg('duplicate')}<span>Duplicate structure</span></button>${hasChildren ? `<button data-folder-action="expand">${iconSvg('folder-open')}<span>${isFolderCollapsed(collapseKey) ? 'Expand' : 'Collapse'} Folder</span></button>` : ''}<button data-folder-action="order">${iconSvg('menu')}<span>Order this level by…</span><small>›</small></button><button data-folder-action="analytics">${iconSvg('analytics')}<span>View Folder Analytics</span></button><button data-folder-action="export">${iconSvg('download')}<span>Export Collection…</span></button><button data-folder-action="transfer">${iconSvg('portfolio')}<span>Add to other portfolio…</span></button><hr /><button data-folder-action="rename">${iconSvg('edit')}<span>Rename Collection</span></button><button data-folder-action="auto-tag">${iconSvg('tags')}<span>${autoTags.length ? 'Edit Auto-Tag…' : 'Set Auto-Tag…'}</span>${autoTags.length ? `<small>${autoTags.length}</small>` : ''}</button><button data-folder-action="change-icon">${iconSvg('palette')}<span>Change Icon…</span></button>${collection.lock ? (collection.locked ? '<button data-folder-action="unlock"><span>Unlock folder…</span></button>' : '<button data-folder-action="lock-now"><span>Lock folder now</span></button><button data-folder-action="remove-password"><span>Remove password…</span></button>') : '<button data-folder-action="password"><span>Password protect folder…</span></button>'}<hr /><button data-folder-action="delete"><span>Delete folder</span></button>`;
  elements.contextMenu.classList.remove('hidden');
  positionMenu(elements.contextMenu, event.clientX, event.clientY);
  elements.contextMenu.querySelectorAll('[data-folder-action]').forEach((button) => button.addEventListener('click', async () => {
    const action = button.dataset.folderAction;if(action==='order'){showBranchOrderMenu(button,{type:'collections',branch:collection.parentId,label:collection.name});return;} hideContextMenu();
    try {
      if (action === 'expand') { toggleFolderCollapsed(collapseKey); return; }
      if (action === 'new-subfolder') { setFolderCollapsed(collapseKey, false); await createCollectionPrompt(collection.id); renderSidebar(); return; }
      if(action==='contact-sheet'){openContactSheet(state.library.assets.filter((asset)=>!asset.deletedAt&&(asset.collectionIds||[]).includes(collection.id)).map((asset)=>asset.id),collection.name);return;}
      if(action==='duplicate'){const result=await window.pigeon.duplicateGroupStructure('collection',collection.id);showToast(`Created ${result.name} without contents`);return;}
      if (action === 'analytics') { openAnalytics({ type: 'collection', id: collection.id }); return; }
      if (action === 'export') { const result = await window.pigeon.exportGroup('collection', collection.id); if (result) showToast(`Exported ${result.files} file${result.files === 1 ? '' : 's'}`); return; }
      if (action === 'transfer') { openPortfolioTransfer({ type: 'collection', id: collection.id, name: collection.name }); return; }
      if (action === 'change-icon') { openIconPicker({ type: 'collection', id: collection.id, current: collection.icon, fallback: 'collection' }); return; }
      if (action === 'auto-tag') { await editCollectionAutoTags(collection); return; }
      if (action === 'rename') { const name = await requestText({ title: 'Rename Collection', label: 'Collection name', value: collection.name, confirmText: 'Rename' }); if (name?.trim()) await window.pigeon.renameCollection(collection.id, name.trim()); }
      if (action === 'password') {
        const password = await requestText({ title: 'Protect Collection', message: 'Use at least four characters.', label: 'Password', type: 'password', confirmText: 'Continue' });
        if (password === null || password.length < 4) return;
        const confirmation = await requestText({ title: 'Confirm Password', label: 'Password', type: 'password', confirmText: 'Protect' });
        if (password !== confirmation) { showToast('Passwords do not match'); return; }
        await window.pigeon.setCollectionPassword(collection.id, password, state.encryptLockedFolders);
      }
      if (action === 'unlock') await selectCollection(collection.id);
      if (action === 'lock-now') { await window.pigeon.lockCollectionNow(collection.id); if (state.collectionId === collection.id) selectView('all'); }
      if (action === 'remove-password') { const password = await requestText({ title: 'Remove Collection Password', label: 'Current password', type: 'password', confirmText: 'Remove Password' }); if (password !== null && !(await window.pigeon.removeCollectionPassword(collection.id, password))) showToast('Incorrect password'); }
      if (action === 'delete' && await requestConfirmation({ title: `Delete “${collection.name}”?`, message: `Delete the collection “${collection.name}”${hasChildren ? ' and all of its nested collections' : ''}? Assets remain indexed.`, confirmText: 'Delete' })) await window.pigeon.removeCollection(collection.id);
    } catch (error) { showToast(error.message); }
  }));
}
const mapTiles = new Map();
let worldLandTexture;
let mapRenderFrame;
let mapDrag;
let mapSearchTimer;
let navigationSaveTimer;
let mapSuggestionGeneration = 0;
let mapSuggestions = [];
let tagAssignmentTargetIds = [];
let textEntryResolve;
let textEntryConfirmation = false;
let textEntryTagMode = false;
let textEntryTagValues = new Map();
let iconPickerTarget = null;
const DEG = Math.PI / 180;
function createWorldLandTexture() {
  if (worldLandTexture) return worldLandTexture;
  const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 720;
  const context = canvas.getContext('2d'); context.fillStyle = '#ffffff';
  const polygons = (window.PIGEON_WORLD_LAND || []).flatMap((geometry) => geometry.type === 'MultiPolygon' ? geometry.coordinates.map((polygon) => polygon[0]) : geometry.type === 'Polygon' ? [geometry.coordinates[0]] : []);
  for (const polygon of polygons) {
    if (!polygon.length) continue;
    const unwrapped = []; let previous = polygon[0][0], offset = 0;
    for (const [rawLon, lat] of polygon) { let lon = rawLon + offset; while (lon - previous > 180) { offset -= 360; lon -= 360; } while (lon - previous < -180) { offset += 360; lon += 360; } previous = lon; unwrapped.push([lon, lat]); }
    for (const shift of [-360, 0, 360]) { context.beginPath(); unwrapped.forEach(([lon, lat], index) => { const x = (lon + shift + 180) / 360 * canvas.width, y = (90 - lat) / 180 * canvas.height; if (index) context.lineTo(x,y); else context.moveTo(x,y); }); context.closePath(); context.fill(); }
  }
  worldLandTexture = { canvas, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
  return worldLandTexture;
}
function scheduleMapRender() { if (mapRenderFrame) return; mapRenderFrame = requestAnimationFrame(() => { mapRenderFrame = null; renderMap(); }); }
function sizeMapCanvas() {
  const canvas = elements.mapCanvas, rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  return { width: rect.width, height: rect.height, dpr };
}
function globeVector(lat, lon) {
  const latitude = lat * DEG, delta = (lon - state.mapCenter.lon) * DEG, center = state.mapCenter.lat * DEG;
  return {
    x: Math.cos(latitude) * Math.sin(delta),
    y: Math.cos(center) * Math.sin(latitude) - Math.sin(center) * Math.cos(latitude) * Math.cos(delta),
    z: Math.sin(center) * Math.sin(latitude) + Math.cos(center) * Math.cos(latitude) * Math.cos(delta)
  };
}
function projectGlobe(lat, lon, width, height) {
  const vector = globeVector(lat, lon), radius = Math.min(width, height) * .42 * state.mapGlobeZoom;
  return { x: width / 2 + vector.x * radius, y: height / 2 - vector.y * radius, visible: vector.z >= 0, radius };
}
function globePointFromCanvas(x, y, width, height) {
  const radius = Math.min(width, height) * .42 * state.mapGlobeZoom, nx = (x - width / 2) / radius, ny = -(y - height / 2) / radius;
  if (nx * nx + ny * ny > 1) return null;
  const z = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), center = state.mapCenter.lat * DEG;
  const lat = Math.asin(ny * Math.cos(center) + z * Math.sin(center));
  const lon = state.mapCenter.lon * DEG + Math.atan2(nx, z * Math.cos(center) - ny * Math.sin(center));
  return { lat: lat / DEG, lon: ((lon / DEG + 540) % 360) - 180 };
}
function worldPixel(lat, lon, zoom) {
  const size = 256 * 2 ** zoom, safeLat = Math.max(-85.0511, Math.min(85.0511, lat));
  return { x: (lon + 180) / 360 * size, y: (1 - Math.log(Math.tan(safeLat * DEG) + 1 / Math.cos(safeLat * DEG)) / Math.PI) / 2 * size, size };
}
function geoFromWorld(x, y, zoom) {
  const size = 256 * 2 ** zoom, lon = x / size * 360 - 180, n = Math.PI - 2 * Math.PI * y / size;
  return { lat: Math.atan(Math.sinh(n)) / DEG, lon: ((lon + 540) % 360) - 180 };
}
function drawMapMarker(context, point, label = '') {
  context.save(); context.translate(point.x, point.y); context.fillStyle = '#ff5969'; context.strokeStyle = 'white'; context.lineWidth = 2;
  context.beginPath(); context.arc(0, -7, 7, 0, Math.PI * 2); context.fill(); context.stroke(); context.beginPath(); context.moveTo(-4, -2); context.lineTo(0, 7); context.lineTo(4, -2); context.fill();
  if (label) { context.font = '10px sans-serif'; const width = context.measureText(label).width + 12; context.fillStyle = 'rgba(22,24,28,.88)'; context.fillRect(10, -20, Math.min(width, 260), 22); context.fillStyle = '#fff'; context.fillText(label.slice(0, 38), 16, -6); }
  context.restore();
}
function drawProjectedLand(context, width, height, radius) {
  const texture = createWorldLandTexture(), resolution = Math.max(220, Math.min(512, Math.round(radius * 1.45)));
  const canvas = document.createElement('canvas'); canvas.width = resolution; canvas.height = resolution;
  const output = canvas.getContext('2d'), image = output.createImageData(resolution, resolution), pixels = image.data, center = state.mapCenter.lat * DEG;
  for (let py = 0; py < resolution; py += 1) for (let px = 0; px < resolution; px += 1) {
    const x = (px + .5) / resolution * 2 - 1, y = -((py + .5) / resolution * 2 - 1), distance = x * x + y * y; if (distance > 1) continue;
    const z = Math.sqrt(1 - distance), lat = Math.asin(y * Math.cos(center) + z * Math.sin(center)), lon = state.mapCenter.lon * DEG + Math.atan2(x, z * Math.cos(center) - y * Math.sin(center));
    const textureX = Math.max(0, Math.min(texture.canvas.width - 1, Math.floor((((lon / DEG + 540) % 360) - 180 + 180) / 360 * texture.canvas.width)));
    const textureY = Math.max(0, Math.min(texture.canvas.height - 1, Math.floor((90 - lat / DEG) / 180 * texture.canvas.height)));
    if (!texture.data[(textureY * texture.canvas.width + textureX) * 4 + 3]) continue;
    const light = Math.max(0, Math.min(1, .34 + .66 * (-x * .28 + y * .3 + z * .84))), index = (py * resolution + px) * 4;
    pixels[index] = 47 + Math.round(light * 35); pixels[index + 1] = 105 + Math.round(light * 55); pixels[index + 2] = 69 + Math.round(light * 35); pixels[index + 3] = 244;
  }
  output.putImageData(image, 0, 0); context.drawImage(canvas, width / 2 - radius, height / 2 - radius, radius * 2, radius * 2);
}
function drawGlobe(context, width, height) {
  const center = projectGlobe(state.mapCenter.lat, state.mapCenter.lon, width, height), radius = center.radius;
  context.save(); context.shadowColor = 'rgba(62,151,255,.48)'; context.shadowBlur = Math.max(18, radius * .13); context.fillStyle = '#07182b'; context.beginPath(); context.arc(width / 2, height / 2, radius, 0, Math.PI * 2); context.fill(); context.restore();
  const gradient = context.createRadialGradient(width / 2 - radius * .32, height / 2 - radius * .36, radius * .06, width / 2, height / 2, radius); gradient.addColorStop(0, '#4a8cbd'); gradient.addColorStop(.48, '#235e91'); gradient.addColorStop(.82, '#123b65'); gradient.addColorStop(1, '#06182c');
  context.fillStyle = gradient; context.beginPath(); context.arc(width / 2, height / 2, radius, 0, Math.PI * 2); context.fill();
  context.save(); context.beginPath(); context.arc(width / 2, height / 2, radius, 0, Math.PI * 2); context.clip();
  drawProjectedLand(context, width, height, radius); context.strokeStyle = 'rgba(180,220,255,.18)'; context.lineWidth = 1;
  const drawLine = (points) => { context.beginPath(); let drawing = false; for (const [lat, lon] of points) { const point = projectGlobe(lat, lon, width, height); if (!point.visible) { drawing = false; continue; } if (!drawing) { context.moveTo(point.x, point.y); drawing = true; } else context.lineTo(point.x, point.y); } context.stroke(); };
  for (let lat = -60; lat <= 60; lat += 30) drawLine(Array.from({ length: 145 }, (_, i) => [lat, -180 + i * 2.5]));
  for (let lon = -180; lon < 180; lon += 30) drawLine(Array.from({ length: 69 }, (_, i) => [-85 + i * 2.5, lon]));
  context.restore(); context.strokeStyle = 'rgba(180,220,255,.45)'; context.lineWidth = 2; context.beginPath(); context.arc(width/2,height/2,radius,0,Math.PI*2); context.stroke();
  if (state.mapPoint) { const marker = projectGlobe(state.mapPoint.lat, state.mapPoint.lon, width, height); if (marker.visible) drawMapMarker(context, marker, state.mapPoint.address); }
}
function drawStreetMap(context, width, height) {
  const zoom = Math.round(state.mapZoom), center = worldPixel(state.mapCenter.lat, state.mapCenter.lon, zoom), startX = center.x - width / 2, startY = center.y - height / 2;
  const minTileX = Math.floor(startX / 256), maxTileX = Math.floor((startX + width) / 256), minTileY = Math.max(0, Math.floor(startY / 256)), maxTileY = Math.min(2 ** zoom - 1, Math.floor((startY + height) / 256));
  context.fillStyle = '#d7d7d2'; context.fillRect(0,0,width,height);
  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
    const wrappedX = ((tileX % 2 ** zoom) + 2 ** zoom) % 2 ** zoom, key = `${zoom}/${wrappedX}/${tileY}`, dx = tileX * 256 - startX, dy = tileY * 256 - startY;
    let image = mapTiles.get(key);
    if (!image) { image = new Image(); image.onload = () => { if (state.mapOpen && state.mapMode === 'street') renderMap(); }; image.src = `pigeon-map://tile/${key}.png`; mapTiles.set(key, image); }
    if (image.complete && image.naturalWidth) context.drawImage(image, dx, dy, 256, 256); else { context.strokeStyle = '#babbb5'; context.strokeRect(dx,dy,256,256); }
  }
  if (state.mapPoint) { const markerWorld = worldPixel(state.mapPoint.lat, state.mapPoint.lon, zoom); let dx = markerWorld.x - center.x; const worldSize = markerWorld.size; if (dx > worldSize / 2) dx -= worldSize; if (dx < -worldSize / 2) dx += worldSize; drawMapMarker(context, { x: width/2 + dx, y: height/2 + markerWorld.y - center.y }, state.mapPoint.address); }
}
function renderMap() {
  if (!state.mapOpen) return;
  const { width, height, dpr } = sizeMapCanvas(), context = elements.mapCanvas.getContext('2d'); context.setTransform(dpr,0,0,dpr,0,0); context.clearRect(0,0,width,height);
  if (state.mapMode === 'globe') drawGlobe(context,width,height); else drawStreetMap(context,width,height);
  elements.mapCanvas.dataset.zoom = state.mapMode === 'globe' ? state.mapGlobeZoom.toFixed(2) : String(Math.round(state.mapZoom));
  $('#map-globe-mode').classList.toggle('active', state.mapMode === 'globe'); $('#map-street-mode').classList.toggle('active', state.mapMode === 'street');
  $('#map-coordinates').textContent = state.mapPoint ? `${state.mapPoint.lat.toFixed(5)}, ${state.mapPoint.lon.toFixed(5)}${state.mapPoint.address ? ` · ${state.mapPoint.address}` : ''}` : 'Click the map to choose a location';
  $('#map-save').disabled = !state.mapPoint;
}
function openMapView(ids) {
  const imageIds = [...new Set(ids || [])].filter((id) => state.library.assets.find((asset) => asset.id === id)?.kind === 'image');
  if (!imageIds.length) { showToast('Select one or more images first'); return; }
  if (isInternalViewerOpen()) hideInternalViewer();
  state.mapSelectionIds = imageIds; state.mapOpen = true;
  const existing = imageIds.map((id) => state.library.assets.find((asset) => asset.id === id)?.geo).filter(Boolean);
  if (existing.length) { state.mapPoint = { lat: existing.reduce((sum,item)=>sum+item.lat,0)/existing.length, lon: existing.reduce((sum,item)=>sum+item.lon,0)/existing.length, address: existing[0].address || '' }; state.mapCenter = { lat: state.mapPoint.lat, lon: state.mapPoint.lon }; }
  else state.mapPoint = null;
  elements.mapView.classList.remove('hidden'); elements.grid.classList.add('hidden'); elements.empty.classList.add('hidden'); elements.tagBrowser.classList.add('hidden'); elements.sentinel.classList.add('hidden');
  $('#map-selection-count').textContent = `${imageIds.length} selected`; $('#map-search-input').value = state.mapPoint?.address || ''; populateMapResults([]); requestAnimationFrame(renderMap);
}
function closeMapView() { state.mapOpen = false; clearTimeout(mapSearchTimer); elements.mapView.classList.add('hidden'); renderGrid(); }

function collapsedFolderStorageKey() { return `pigeon.collapsedFolders.${state.library.activePortfolioId || 'default'}`; }
function collapsedFolders() { try { return new Set(JSON.parse(localStorage.getItem(collapsedFolderStorageKey()) || '[]')); } catch { return new Set(); } }
function isFolderCollapsed(key) { return collapsedFolders().has(key); }
function setFolderCollapsed(key, collapsed) { const folders = collapsedFolders(); if (collapsed) folders.add(key); else folders.delete(key); localStorage.setItem(collapsedFolderStorageKey(), JSON.stringify([...folders])); }
function toggleFolderCollapsed(key) { setFolderCollapsed(key, !isFolderCollapsed(key)); renderSidebar(false); scheduleFolderTreeBuild(); }
const collectionCollapseKey = (id) => `collection:${id}`;
const smartFolderCollapseKey = (id) => `smart-folder:${id}`;
const locationCollapseKey = (id, subfolder = '') => subfolder ? `subfolder:${id}:${subfolder.toLowerCase()}` : `location:${id}`;
const folderAutoTagKey = (locationId, subfolder = '') => `${locationId}:${String(subfolder).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase()}`;
function folderAutoTagRule(locationId, subfolder = '') { return state.library.settings?.folderAutoTags?.[folderAutoTagKey(locationId, subfolder)] || null; }
function folderLockRule(locationId,subfolder=''){return state.library.settings?.folderLocks?.[folderAutoTagKey(locationId,subfolder)]||null;}
function effectiveFolderLockRule(locationId,subfolder=''){const folder=String(subfolder).replace(/\\/g,'/').replace(/^\/+|\/+$/g,'').toLowerCase();return Object.values(state.library.settings?.folderLocks||{}).filter((rule)=>rule.locationId===locationId&&(!rule.subfolder||folder===rule.subfolder||folder.startsWith(`${rule.subfolder}/`))).sort((a,b)=>b.subfolder.length-a.subfolder.length)[0]||null;}
async function ensureFolderUnlocked(location,subfolder=''){const rule=effectiveFolderLockRule(location.id,subfolder);if(!rule?.locked)return true;const password=await requestText({title:`Unlock ${subfolder?subfolder.split('/').pop():location.name}`,label:'Password',type:'password',confirmText:'Unlock'});if(password===null)return false;if(!(await window.pigeon.unlockFolder(rule.locationId,rule.subfolder,password))){showToast('Incorrect password');return false;}rule.locked=false;return true;}
async function editFolderAutoTags(location, subfolder = '') {
  const current = folderAutoTagRule(location.id, subfolder)?.tags || [], label = subfolder ? subfolder.split('/').pop() : location.name;
  const tags = await requestTagSet({ title: current.length ? 'Edit Folder Auto-Tag' : 'Set Folder Auto-Tag', message: `These tags apply to all current and future contents of “${label}”, including every subfolder.`, tags: current, confirmText: current.length ? 'Save' : 'Create' });
  if (tags === null) return;
  const result = await window.pigeon.setFolderAutoTags(location.id, subfolder, tags),updates=new Map((result.assets||[]).map((asset)=>[asset.id,asset])),changed=[];for(const asset of state.library.assets)if(updates.has(asset.id)){Object.assign(asset,updates.get(asset.id));changed.push(asset.id);}if(state.smartFolderId&&currentSmartFolderDependsOnTags()){reconcileThumbnailCards(changed,{sidebar:false});renderSidebar(false);}else{patchTagMetadataCards(changed);renderSidebar(false);renderInspector();}showToast(tags.length ? `${tags.length} automatic tag${tags.length === 1 ? '' : 's'} applied to ${result.updated} item${result.updated === 1 ? '' : 's'}` : 'Folder Auto-Tag removed');
}
function showLocationContextMenu(event, location, subfolder = '', row = null) {
  const rule = folderAutoTagRule(location.id, subfolder),lockRule=folderLockRule(location.id,subfolder), iconKey = subfolder ? subfolderIconKey(location.id, subfolder) : location.id, currentIcon = subfolder ? state.library.settings?.itemIcons?.[iconKey] : location.icon, collapseKey = locationCollapseKey(location.id, subfolder);
  elements.contextMenu.innerHTML = `<button data-location-action="contact-sheet">${iconSvg('layout')}<span>Contact Sheet…</span></button><button data-location-action="duplicate">${iconSvg('duplicate')}<span>Duplicate folder structure</span></button><button data-location-action="rescan">${iconSvg('refresh')}<span>Rescan Folder</span></button><button data-location-action="analytics">${iconSvg('analytics')}<span>View Folder Analytics</span></button><button data-location-action="transfer">${iconSvg('portfolio')}<span>Add to other portfolio…</span></button><button data-location-action="search">${iconSvg('search')}<span>Search in Folder</span></button>${subfolder ? `<button data-location-action="show">${iconSvg('eye')}<span>Show Subfolder Content</span></button>` : ''}<button data-location-action="expand">${iconSvg('folder-open')}<span>${isFolderCollapsed(collapseKey) ? 'Expand' : 'Collapse'} Folder</span></button><button data-location-action="order">${iconSvg('menu')}<span>Order this level by…</span><small>›</small></button><hr /><button data-location-action="copy">${iconSvg('link')}<span>Copy Folder Path</span></button><button data-location-action="auto-tag">${iconSvg('tags')}<span>${rule ? 'Edit Auto-Tag…' : 'Set Auto-Tag…'}</span>${rule ? `<small>${rule.tags.length}</small>` : ''}</button><hr /><button data-location-action="change-icon">${iconSvg('palette')}<span>Change Icon…</span></button>${lockRule?(lockRule.locked?'<button data-location-action="unlock"><span>Unlock folder…</span></button>':'<button data-location-action="lock-now"><span>Lock folder now</span></button><button data-location-action="remove-password"><span>Remove password…</span></button>'):'<button data-location-action="password"><span>Password protect folder…</span></button>'}${subfolder ? '' : `<hr /><button data-location-action="remove">${iconSvg('trash')}<span>Remove Folder</span></button>`}`;
  elements.contextMenu.classList.remove('hidden'); positionMenu(elements.contextMenu, event.clientX, event.clientY);
  elements.contextMenu.querySelectorAll('[data-location-action]').forEach((button) => button.addEventListener('click', async () => {
    const action = button.dataset.locationAction;if(action==='order'){showBranchOrderMenu(button,{type:'folders',branch:`${location.id}:${subfolder.split('/').slice(0,-1).join('/')}`,label:subfolder?subfolder.split('/').pop():location.name});return;} hideContextMenu();
    if(action==='contact-sheet'){const prefix=String(subfolder||'').replace(/\\/g,'/').toLowerCase();openContactSheet(state.library.assets.filter((asset)=>{if(asset.deletedAt||asset.locationId!==location.id)return false;if(!prefix)return true;const relative=String(asset.path).replace(/\\/g,'/').slice(String(location.path).replace(/\\/g,'/').length+1).toLowerCase();return relative.startsWith(`${prefix}/`);}).map((asset)=>asset.id),subfolder?subfolder.split('/').pop():location.name);}
    if(action==='duplicate'){const result=await window.pigeon.duplicateGroupStructure('folder',location.id,subfolder);showToast(`Created ${result.name} without files`);}
    if (action === 'rescan') { showToast(`Rescanning ${subfolder ? subfolder.split('/').pop() : location.name}…`); await window.pigeon.rescan(location.id); showToast('Folder rescan complete'); }
    if (action === 'analytics') openAnalytics({ type: 'location', id: location.id, subfolder });
    if (action === 'transfer') openPortfolioTransfer({ type: 'folder', id: location.id, subfolder, name: subfolder ? subfolder.split('/').pop() : location.name });
    if (action === 'search') { selectLocation(location.id, subfolder); elements.search.focus(); }
    if (action === 'show') selectLocation(location.id, subfolder);
    if (action === 'expand') toggleFolderCollapsed(collapseKey);
    if (action === 'copy') { const target = subfolder ? `${location.path}/${subfolder}` : location.path; await window.pigeon.copyText(target); showToast('Folder path copied'); }
    if (action === 'auto-tag') await editFolderAutoTags(location, subfolder);
    if (action === 'change-icon') openIconPicker({ type: subfolder ? 'subfolder' : 'location', id: iconKey, current: currentIcon, fallback: subfolder ? 'folder' : 'folder-open' });
    if(action==='password'){const password=await requestText({title:'Protect Folder',message:'All contents and subfolders will be hidden immediately.',label:'Password',type:'password',confirmText:'Continue'});if(password===null||password.length<4)return;const confirmation=await requestText({title:'Confirm Password',label:'Password',type:'password',confirmText:'Protect'});if(password!==confirmation){showToast('Passwords do not match');return;}await window.pigeon.setFolderPassword(location.id,subfolder,password);}
    if(action==='unlock'){if(await ensureFolderUnlocked(location,subfolder))render();}
    if(action==='lock-now'){await window.pigeon.lockFolderNow(location.id,subfolder);if(state.locationId===location.id&&(!subfolder||state.locationSubfolder===subfolder||state.locationSubfolder.startsWith(`${subfolder}/`)))selectView('all','All');}
    if(action==='remove-password'){const password=await requestText({title:'Remove Folder Password',label:'Current password',type:'password',confirmText:'Remove Password'});if(password!==null&&!(await window.pigeon.removeFolderPassword(location.id,subfolder,password)))showToast('Incorrect password');}
    if (action === 'remove' && await requestConfirmation({ title: `Remove “${location.name}”?`, message: `Remove the indexed folder “${location.name}” from Pigeon?\n\n${location.path}\n\nYour original files will not be changed.`, confirmText: 'Remove' })) await window.pigeon.removeLocation(location.id);
  }));
}

function activateSidebarTreeRow(row) { if (row.dataset.collectionId) selectCollection(row.dataset.collectionId); else if (row.dataset.smartFolderId) selectSmartFolder(row.dataset.smartFolderId); else if (row.dataset.locationId) selectLocation(row.dataset.locationId, row.dataset.subfolder ? decodeURIComponent(row.dataset.subfolder) : ''); }
function handleSidebarTreeKeys(event) { const row = event.target.closest('.collection-item,.smart-folder-item,.location-root-button,.location-folder-item'); if (!row) return; const tree = row.closest('#collection-list,#smart-folder-list,#location-list'), rows = [...tree.querySelectorAll('.collection-item,.smart-folder-item,.location-root-button,.location-folder-item')].filter((item) => item.offsetParent !== null), index = rows.indexOf(row), collapse = row.querySelector('[data-collapse-key]'); let target = null; if (event.key === 'ArrowDown') target = rows[index + 1] || rows[0]; if (event.key === 'ArrowUp') target = rows[index - 1] || rows.at(-1); if (event.key === 'Home') target = rows[0]; if (event.key === 'End') target = rows.at(-1); if (event.key === 'ArrowRight' && collapse) { if (isFolderCollapsed(collapse.dataset.collapseKey)) toggleFolderCollapsed(collapse.dataset.collapseKey); else target = rows[index + 1]; } if (event.key === 'ArrowLeft' && collapse && !isFolderCollapsed(collapse.dataset.collapseKey)) toggleFolderCollapsed(collapse.dataset.collapseKey); if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateSidebarTreeRow(row); return; } if (target) { event.preventDefault(); target.focus(); target.scrollIntoView({ block: 'nearest' }); } }
function wireSidebarKeyboard() { for (const tree of [$('#collection-list'),$('#smart-folder-list'),$('#location-list')]) { if (tree.dataset.keyboardWired) continue; tree.dataset.keyboardWired = 'true'; tree.addEventListener('keydown', handleSidebarTreeKeys); } }
const folderTreeCache = new Map(), folderTreeLimits = new Map(); let folderTreeGeneration = 0, folderTreeTimer = null;
function scheduleFolderTreeBuild() { clearTimeout(folderTreeTimer); const generation = ++folderTreeGeneration; folderTreeTimer = setTimeout(async () => { const limits = Object.fromEntries(state.library.locations.map((location)=>[location.id,folderTreeLimits.get(location.id)||300])); try { const result = await window.pigeon.buildFolderTree({ collapsedKeys:[...collapsedFolders()], limits }); if (generation !== folderTreeGeneration) return; folderTreeCache.clear(); for (const entry of result) folderTreeCache.set(entry.locationId,entry); renderSidebar(false); } catch (error) { window.pigeon.logDiagnostic('error','Folder tree calculation failed',error.message); } }, 80); }
function setSidebarDropMarker(button,zone){button.classList.remove('drop-before','drop-inside','drop-after');button.classList.add(`drop-${zone}`);button.dataset.dropZone=zone;}
function clearSidebarDropMarker(button){button.classList.remove('drop-before','drop-inside','drop-after');delete button.dataset.dropZone;}
function sidebarDropZone(event,button){const rect=button.getBoundingClientRect(),ratio=(event.clientY-rect.top)/rect.height;return ratio<.38?'before':ratio>.62?'after':'inside';}
function sidebarSortValue(type,branch,fallback='manual'){return state.library.settings?.sidebarBranchSort?.[`${type}:${branch??'root'}`]||state.library.settings?.sidebarSort?.[type]||fallback;}
function compareSidebarItems(a,b,sort){return sort==='name-asc'?a.name.localeCompare(b.name):sort==='name-desc'?b.name.localeCompare(a.name):sort==='updated-asc'?(a.updatedAt||a.createdAt||0)-(b.updatedAt||b.createdAt||0):sort==='updated-desc'?(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0):sort==='created-asc'?(a.createdAt||0)-(b.createdAt||0):sort==='created-desc'?(b.createdAt||0)-(a.createdAt||0):(a.order??0)-(b.order??0)||a.name.localeCompare(b.name);}
function sidebarSortedSiblings(items,parentId,type){const sort=sidebarSortValue(type,parentId),siblings=items.filter((item)=>item.parentId===parentId);return siblings.sort((a,b)=>compareSidebarItems(a,b,sort));}
const branchSortOptions=[['manual','Manual order'],['name-asc','Name · A to Z'],['name-desc','Name · Z to A'],['updated-desc','Date modified · newest'],['updated-asc','Date modified · oldest'],['created-desc','Date added · newest'],['created-asc','Date added · oldest']];
function showBranchOrderMenu(anchor,{type,branch,label}){const menu=$('#sidebar-order-submenu'),current=sidebarSortValue(type,branch),rect=anchor.getBoundingClientRect();menu.innerHTML=`<div class="context-menu-title">Order level containing ${escapeHtml(label)}</div>${branchSortOptions.map(([value,text])=>`<button data-branch-sort="${value}"><span>${text}</span><span class="menu-check">${current===value?'✓':''}</span></button>`).join('')}`;menu.querySelectorAll('[data-branch-sort]').forEach((button)=>button.addEventListener('click',async()=>{hideContextMenu();state.library.settings=state.library.settings||{};state.library.settings.sidebarBranchSort={...(state.library.settings.sidebarBranchSort||{}),[`${type}:${branch??'root'}`]:button.dataset.branchSort};renderSidebar(false);await window.pigeon.setSidebarBranchSort(type,branch,button.dataset.branchSort);}));menu.classList.remove('hidden');const left=rect.right+menu.offsetWidth<=window.innerWidth-8?rect.right:rect.left-menu.offsetWidth;menu.style.left=`${Math.max(8,left)}px`;menu.style.top=`${Math.max(8,Math.min(rect.top,window.innerHeight-menu.offsetHeight-8))}px`;}
function renderSidebar(rebuildFolderTree = false) {
  const activePortfolio = (state.library.portfolios || []).find((item) => item.id === state.library.activePortfolioId);
  $('#active-portfolio-name').textContent = activePortfolio?.name || 'My Portfolio';
  document.title = `Pigeon — ${activePortfolio?.name || 'Portfolio'}`;
  const assets = state.library.assets,visibleAssets=assets.filter((asset)=>!asset.deletedAt&&!asset.locked),collectionCounts=new Map();for(const asset of visibleAssets)for(const id of asset.collectionIds||[])collectionCounts.set(id,(collectionCounts.get(id)||0)+1);
  $('#all-count').textContent = visibleAssets.length;
  $('#uncategorized-count').textContent = visibleAssets.filter((asset) => !(asset.tags || []).length && !(asset.collectionIds || []).length).length;
  $('#untagged-count').textContent = visibleAssets.filter((asset) => !(asset.tags || []).length).length;
  $('#favorites-count').textContent = visibleAssets.filter((asset) => asset.favorite).length;
  $('#tags-count').textContent = new Set(visibleAssets.flatMap((asset) => asset.tags)).size;
  $('#offline-count').textContent = assets.filter(isOffline).length;
  $('#duplicates-count').textContent = state.duplicateIds.size;
  $('#trash-count').textContent = assets.filter((asset) => asset.deletedAt).length;
  const collectionRows = [];
  const appendCollections = (parentId = null, depth = 0) => {
    const siblings=sidebarSortedSiblings(state.library.collections||[],parentId,'collections');for (const [siblingIndex,collection] of siblings.entries()) {
      const count = collection.locked?0:collectionCounts.get(collection.id)||0, hasChildren = (state.library.collections || []).some((item) => item.parentId === collection.id), collapseKey = collectionCollapseKey(collection.id), collapsed = hasChildren && isFolderCollapsed(collapseKey);
      collectionRows.push(`<button class="nav-item collection-item ${siblingIndex===siblings.length-1?'tree-last':''} ${state.collectionId === collection.id ? 'active' : ''}" style="--depth:${depth};--tree-color:${treeLevelColor(depth)}" data-collection-id="${collection.id}" draggable="true"><span class="folder-tree-toggle ${hasChildren ? '' : 'empty'}" data-collapse-key="${collapseKey}" role="button" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${escapeHtml(collection.name)}" aria-expanded="${!collapsed}">${hasChildren ? (collapsed ? '▸' : '▾') : ''}</span><span class="nav-icon tree-folder-icon">${iconSvg(itemIcon(collection, state.collectionId===collection.id||hasChildren&&!collapsed ? 'folder-open' : 'folder'))}${collection.locked ? `<i class="tree-lock-badge">${iconSvg('lock')}</i>` : ''}</span><span>${escapeHtml(collection.name)}</span><small>${count}</small></button>`);
      if (!collapsed&&!collection.locked) appendCollections(collection.id, depth + 1);
    }
  };
  appendCollections();
  $('#collection-list').innerHTML = collectionRows.join('') || '<div class="facet-empty">No collections</div>';
  const smartRows = [], appendSmartFolders = (parentId = null, depth = 0) => {
    const siblings=sidebarSortedSiblings(state.library.smartFolders||[],parentId,'smartFolders');for (const [siblingIndex,folder] of siblings.entries()) {
      const count = assets.filter((asset) => !asset.deletedAt && !asset.locked && matchesSavedFilters(asset, folder.filters)).length, hasChildren = state.library.smartFolders.some((item) => item.parentId === folder.id), collapseKey = smartFolderCollapseKey(folder.id), collapsed = hasChildren && isFolderCollapsed(collapseKey);
      smartRows.push(`<button class="nav-item smart-folder-item ${siblingIndex===siblings.length-1?'tree-last':''} ${state.smartFolderId === folder.id ? 'active' : ''}" style="--depth:${depth};--tree-color:${treeLevelColor(depth)}" data-smart-folder-id="${folder.id}" draggable="true"><span class="folder-tree-toggle ${hasChildren ? '' : 'empty'}" data-collapse-key="${collapseKey}" role="button" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${escapeHtml(folder.name)}">${hasChildren ? (collapsed ? '▸' : '▾') : ''}</span><span class="nav-icon">${iconSvg(itemIcon(folder, 'smart'))}</span><span>${escapeHtml(folder.name)}</span><small>${count}</small></button>`);
      if (!collapsed) appendSmartFolders(folder.id, depth + 1);
    }
  };
  appendSmartFolders(); $('#smart-folder-list').innerHTML = smartRows.join('') || '<div class="facet-empty">No smart folders</div>'; wireSidebarKeyboard();
  $$('.collection-item').forEach((button) => {
    button.querySelector('[data-collapse-key]')?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); toggleFolderCollapsed(event.currentTarget.dataset.collapseKey); });
    button.addEventListener('click', () => selectCollection(button.dataset.collectionId));
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const collection = (state.library.collections || []).find((item) => item.id === button.dataset.collectionId);
      if (collection) showCollectionContextMenu(event, collection);
    });
    button.addEventListener('dragstart', (event) => { event.dataTransfer.setData('application/x-pigeon-collection', button.dataset.collectionId); event.stopPropagation(); });
    button.addEventListener('dragover',(event)=>{if(!event.dataTransfer.types.includes('application/x-pigeon-collection')&&!event.dataTransfer.types.includes('application/x-pigeon-assets'))return;event.preventDefault();if(event.dataTransfer.types.includes('application/x-pigeon-collection'))setSidebarDropMarker(button,sidebarDropZone(event,button));else button.classList.add('drag-over');});
    button.addEventListener('dragleave',(event)=>{if(event.relatedTarget&&button.contains(event.relatedTarget))return;setTimeout(()=>{if(!button.matches(':hover')){button.classList.remove('drag-over');clearSidebarDropMarker(button);}},35);});
    button.addEventListener('drop', async (event) => {
      event.preventDefault();button.classList.remove('drag-over');const dropZone=button.dataset.dropZone||'inside';clearSidebarDropMarker(button);
      const movedCollectionId = event.dataTransfer.getData('application/x-pigeon-collection');
      if(movedCollectionId){try{const target=state.library.collections.find((item)=>item.id===button.dataset.collectionId),source=state.library.collections.find((item)=>item.id===movedCollectionId),edge=dropZone;if(source&&target&&source.parentId===target.parentId&&edge!=='inside'){const siblings=sidebarSortedSiblings(state.library.collections||[],target.parentId,'collections').filter((item)=>item.id!==source.id),index=siblings.findIndex((item)=>item.id===target.id)+(edge==='after'?1:0);siblings.splice(index,0,source);await window.pigeon.reorderSidebarItems('collections',target.parentId,siblings.map((item)=>item.id));}else await window.pigeon.moveCollection(movedCollectionId,button.dataset.collectionId);}catch(error){showToast(error.message);}return;}
      const target = (state.library.collections || []).find((item) => item.id === button.dataset.collectionId);
      if (!(await ensureCollectionUnlocked(target))) return;
      if (hasExternalFiles(event)) {
        const paths = droppedFilePaths(event); if (!paths.length) return;
        const result = await window.pigeon.importDroppedFiles(paths, { collectionId: target.id }); showToast(`${result.imported} file${result.imported === 1 ? '' : 's'} added to ${target.name}`); return;
      }
      const ids = JSON.parse(event.dataTransfer.getData('application/x-pigeon-assets') || '[]').filter((id) => state.library.assets.some((asset) => asset.id === id));
      if (!ids.length) return;
      let origin={};try{origin=JSON.parse(event.dataTransfer.getData('application/x-pigeon-origin')||'{}');}catch{}
      await addAssetsToCollectionWithoutGridRefresh(ids,target,origin.collectionId);
    });
  });
  $$('#smart-folder-list [data-smart-folder-id]').forEach((button) => {
    button.querySelector('[data-collapse-key]')?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); toggleFolderCollapsed(event.currentTarget.dataset.collapseKey); });
    button.addEventListener('click', () => selectSmartFolder(button.dataset.smartFolderId));
    button.addEventListener('dragstart', (event) => { event.dataTransfer.setData('application/x-pigeon-smart-folder', button.dataset.smartFolderId); event.stopPropagation(); });
    button.addEventListener('dragover',(event)=>{if(!event.dataTransfer.types.includes('application/x-pigeon-smart-folder'))return;event.preventDefault();setSidebarDropMarker(button,sidebarDropZone(event,button));});
    button.addEventListener('dragleave',()=>clearSidebarDropMarker(button));
    button.addEventListener('drop',async(event)=>{event.preventDefault();const dropZone=button.dataset.dropZone||'inside';clearSidebarDropMarker(button);const movedId=event.dataTransfer.getData('application/x-pigeon-smart-folder');if(movedId)try{const target=state.library.smartFolders.find((item)=>item.id===button.dataset.smartFolderId),source=state.library.smartFolders.find((item)=>item.id===movedId),edge=dropZone;if(source&&target&&source.parentId===target.parentId&&edge!=='inside'){const siblings=sidebarSortedSiblings(state.library.smartFolders||[],target.parentId,'smartFolders').filter((item)=>item.id!==source.id),index=siblings.findIndex((item)=>item.id===target.id)+(edge==='after'?1:0);siblings.splice(index,0,source);await window.pigeon.reorderSidebarItems('smartFolders',target.parentId,siblings.map((item)=>item.id));}else await window.pigeon.moveSmartFolder(movedId,button.dataset.smartFolderId);}catch(error){showToast(error.message);}});
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault(); const folder = state.library.smartFolders.find((item) => item.id === button.dataset.smartFolderId); if (!folder) return;
      elements.contextMenu.innerHTML = `<button data-smart-action="edit">${iconSvg('edit')}<span>Edit Smart Folder…</span></button><button data-smart-action="new-subfolder">${iconSvg('folder')}<span>New Smart Subfolder…</span></button><button data-smart-action="duplicate">${iconSvg('duplicate')}<span>Duplicate structure</span></button><button data-smart-action="order">${iconSvg('menu')}<span>Order this level by…</span><small>›</small></button><button data-smart-action="export">${iconSvg('download')}<span>Export Smart Folder…</span></button><button data-smart-action="rename">${iconSvg('edit')}<span>Rename Smart Folder…</span></button><button data-smart-action="change-icon">${iconSvg('palette')}<span>Change Icon…</span></button><hr /><button data-smart-action="delete">${iconSvg('trash')}<span>Delete Smart Folder</span></button>`; elements.contextMenu.classList.remove('hidden'); positionMenu(elements.contextMenu, event.clientX, event.clientY);
      elements.contextMenu.querySelectorAll('[data-smart-action]').forEach((actionButton) => actionButton.addEventListener('click', async () => { const action = actionButton.dataset.smartAction;if(action==='order'){showBranchOrderMenu(actionButton,{type:'smartFolders',branch:folder.parentId,label:folder.name});return;} hideContextMenu();
        if(action==='edit')openSmartFolderDialog(null,folder);
        if (action === 'new-subfolder') { setFolderCollapsed(smartFolderCollapseKey(folder.id), false); openSmartFolderDialog(folder.id); }
        if(action==='duplicate'){const result=await window.pigeon.duplicateGroupStructure('smart-folder',folder.id);showToast(`Created ${result.name} without contents`);}
        if (action === 'export') { const result = await window.pigeon.exportGroup('smart-folder', folder.id); if (result) showToast(`Exported ${result.files} file${result.files === 1 ? '' : 's'}`); }
        if (action === 'rename') { const name = await requestText({ title: 'Rename Smart Folder', label: 'Smart folder name', value: folder.name, confirmText: 'Rename' }); if (name?.trim()) await window.pigeon.renameSmartFolder(folder.id, name.trim()); }
        if (action === 'change-icon') openIconPicker({ type: 'smart-folder', id: folder.id, current: folder.icon, fallback: 'smart' });
        if (action === 'delete' && await requestConfirmation({ title: `Delete “${folder.name}”?`, message: `Delete the Smart Folder “${folder.name}”${state.library.smartFolders.some((item)=>item.parentId===folder.id) ? ' and all of its nested Smart Folders' : ''}?`, confirmText: 'Delete' })) await window.pigeon.removeSmartFolder(folder.id);
      }));
    });
  });
  elements.locationList.innerHTML = state.library.locations.map((location) => {
    const tree = folderTreeCache.get(location.id) || { folders:[], visibleFolders:0, totalFolders:0 }, rootCollapseKey = locationCollapseKey(location.id), rootCollapsed = isFolderCollapsed(rootCollapseKey),rootLocked=Boolean(folderLockRule(location.id,'')?.locked);
    const visibleTreeFolders=(rootLocked?[]:tree.folders.filter((folder)=>{const lock=effectiveFolderLockRule(location.id,folder.path);return!lock?.locked||lock.subfolder===String(folder.path).replace(/\\/g,'/').replace(/^\/+|\/+$/g,'').toLowerCase();}));const orderedFolders=[];const appendFolderLevel=(parent='')=>{const children=visibleTreeFolders.filter((folder)=>folder.path.split('/').slice(0,-1).join('/')===parent),sort=sidebarSortValue('folders',`${location.id}:${parent}`);children.sort((a,b)=>compareSidebarItems(a,b,sort));for(const child of children){orderedFolders.push(child);appendFolderLevel(child.path);}};appendFolderLevel();visibleTreeFolders.splice(0,visibleTreeFolders.length,...orderedFolders);
    const folderRows = visibleTreeFolders.map((folder,folderIndex) => { const hasChildren = folder.hasChildren, collapseKey = locationCollapseKey(location.id, folder.path), collapsed = hasChildren && isFolderCollapsed(collapseKey),folderLocked=Boolean(effectiveFolderLockRule(location.id,folder.path)?.locked); const ancestorDepths=visibleTreeFolders.slice(folderIndex+1).find((item)=>item.depth<=folder.depth)?.depth??-1; return `<button class="nav-item location-folder-item ${ancestorDepths<folder.depth?'tree-last':''} ${state.locationId === location.id && state.locationSubfolder === folder.path ? 'active' : ''}" style="--depth:${folder.depth};--tree-color:${treeLevelColor(folder.depth)}" data-location-id="${location.id}" data-subfolder="${encodeURIComponent(folder.path)}" title="${escapeHtml(`${location.path}/${folder.path}`)}"><span class="folder-tree-toggle ${hasChildren ? '' : 'empty'}" data-collapse-key="${collapseKey}" role="button" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${escapeHtml(folder.name)}" aria-expanded="${!collapsed}">${hasChildren ? (collapsed ? '▸' : '▾') : ''}</span><span class="nav-icon tree-folder-icon">${iconSvg(state.library.settings?.itemIcons?.[subfolderIconKey(location.id, folder.path)] || (state.locationId===location.id&&state.locationSubfolder===folder.path?'folder-open':'folder'))}${folderLocked?`<i class="tree-lock-badge">${iconSvg('lock')}</i>`:''}</span><span class="location-name">${escapeHtml(folder.name)}</span><small>${folderLocked?0:(state.includeSubfolderContent?folder.count:folder.directCount||0)}</small></button>`; }).join('') + (tree.visibleFolders > tree.folders.length ? `<button class="location-tree-more" data-load-location-tree="${location.id}">Show ${Math.min(500,tree.visibleFolders-tree.folders.length).toLocaleString()} more of ${tree.visibleFolders.toLocaleString()} folders…</button>` : '');
    return `<div class="location-item ${location.online ? '' : 'offline'} ${location.scanning ? 'scanning' : ''}" data-location-id="${location.id}" title="${escapeHtml(location.path)}">
      <button class="nav-item location-root-button ${state.locationId === location.id && !state.locationSubfolder ? 'active' : ''}"><span class="folder-tree-toggle" data-collapse-key="${rootCollapseKey}" role="button" aria-label="${rootCollapsed ? 'Expand' : 'Collapse'} ${escapeHtml(location.name)}" aria-expanded="${!rootCollapsed}">${rootCollapsed ? '▸' : '▾'}</span><span class="nav-icon location-icon">${iconSvg(itemIcon(location, 'folder-open'))}${rootLocked?`<i class="tree-lock-badge">${iconSvg('lock')}</i>`:''}<i class="location-state"></i></span><span class="location-name">${escapeHtml(location.name)}</span><small>${location.assetCount || 0}</small></button>
      <button class="location-remove" title="Remove from Pigeon">×</button>
      <div class="location-subfolder-list">${folderRows}</div>
    </div>`;
  }).join(''); wireSidebarKeyboard();
  $$('[data-load-location-tree]').forEach((button)=>button.addEventListener('click',()=>{ const id=button.dataset.loadLocationTree; folderTreeLimits.set(id,(folderTreeLimits.get(id)||300)+500); scheduleFolderTreeBuild(); }));
  if (rebuildFolderTree) scheduleFolderTreeBuild();
  $$('.library-nav .nav-item[data-view]').forEach((button) => button.classList.toggle('active', !state.locationId && !state.collectionId && !state.smartFolderId && button.dataset.view === state.view));
  $$('.location-item').forEach((row) => {
    row.querySelector('.location-root-button [data-collapse-key]')?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); toggleFolderCollapsed(event.currentTarget.dataset.collapseKey); });
    row.querySelector('.location-root-button').addEventListener('click', () => selectLocation(row.dataset.locationId));
    row.querySelector('.location-root-button').addEventListener('contextmenu', (event) => { event.preventDefault(); const location = state.library.locations.find((item) => item.id === row.dataset.locationId); if (location) showLocationContextMenu(event, location, '', row); });
    const enablePhysicalFolderDrop = (button, subfolder = '') => {
      button.addEventListener('dragover', (event) => { const internal=event.dataTransfer.types.includes('application/x-pigeon-assets');if(!internal&&!hasExternalFiles(event))return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect=internal?'move':'copy';button.classList.add('drag-over'); });
      button.addEventListener('dragleave', (event) => {if(event.relatedTarget&&button.contains(event.relatedTarget))return;setTimeout(()=>{if(!button.matches(':hover'))button.classList.remove('drag-over');},35);});
      button.addEventListener('drop', async (event) => {const internal=event.dataTransfer.types.includes('application/x-pigeon-assets');if(!internal&&!hasExternalFiles(event))return;event.preventDefault();event.stopPropagation();button.classList.remove('drag-over');try{if(internal){const ids=JSON.parse(event.dataTransfer.getData('application/x-pigeon-assets')||'[]'),leavesCurrent=state.locationId&&(state.locationId!==row.dataset.locationId||state.locationSubfolder!==subfolder),successorId=leavesCurrent?successorAfterRemoving(ids):null,result=await window.pigeon.moveAssetsToFolder(ids,row.dataset.locationId,subfolder),updates=new Map((result.assets||[]).map((asset)=>[asset.id,asset]));for(const asset of state.library.assets)if(updates.has(asset.id))Object.assign(asset,updates.get(asset.id));reconcileThumbnailCards(ids);if(leavesCurrent)selectAndRevealSuccessor(successorId);showToast(`${result.moved} file${result.moved===1?'':'s'} moved`);return;}const paths=droppedFilePaths(event);if(!paths.length)return;const result=await window.pigeon.importDroppedFiles(paths,{locationId:row.dataset.locationId,subfolder});showToast(`${result.imported} file${result.imported===1?'':'s'} copied into this folder`);}catch(error){showToast(error.message);} });
    };
    enablePhysicalFolderDrop(row.querySelector('.location-root-button'));
    row.querySelectorAll('.location-folder-item').forEach((button) => { const subfolder = decodeURIComponent(button.dataset.subfolder); button.querySelector('[data-collapse-key]')?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); toggleFolderCollapsed(event.currentTarget.dataset.collapseKey); }); button.addEventListener('click', () => selectLocation(button.dataset.locationId, subfolder)); button.addEventListener('contextmenu', (event) => { event.preventDefault(); const location = state.library.locations.find((item) => item.id === button.dataset.locationId); if (location) showLocationContextMenu(event, location, subfolder, row); }); enablePhysicalFolderDrop(button, subfolder); });
    row.querySelector('.location-remove').addEventListener('click', async (event) => {
      event.stopPropagation();
      const location = state.library.locations.find((item) => item.id === row.dataset.locationId);
      if (!(await requestConfirmation({ title: `Remove “${location.name}”?`, message: `Remove the indexed folder “${location.name}” from Pigeon?\n\n${location.path}\n\nYour original files will not be changed.`, confirmText: 'Remove' }))) return;
      await window.pigeon.removeLocation(location.id);
      if (state.locationId === location.id) { state.locationId = null; state.locationSubfolder = ''; state.view = 'all'; }
    });
  });
}

function renderTagBrowser() {
  const byKey = new Map();
  for (const asset of state.library.assets.filter((item) => !item.deletedAt)) for (const tag of asset.tags || []) {
    const key = tag.toLocaleLowerCase();
    const entry = byKey.get(key) || { name: tag, count: 0 };
    entry.count += 1; byKey.set(key, entry);
  }
  const groups = new Map();
  for (const entry of [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))) {
    const letter = /^[a-z]/i.test(entry.name) ? entry.name[0].toUpperCase() : '#';
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(entry);
  }
  elements.tagBrowser.innerHTML = groups.size ? [...groups].map(([letter, tags]) => `<section class="tag-letter-group"><h2 class="tag-letter-heading">${escapeHtml(letter)} <small>(${tags.length})</small></h2><div class="tag-manager-grid">${tags.map((tag) => `<div class="tag-manager-item" data-tag="${escapeHtml(tag.name)}"><span class="tag-manager-bullet">•</span><button class="tag-manager-name" title="Show assets tagged ${escapeHtml(tag.name)}">${escapeHtml(tag.name)}</button><span class="tag-manager-count">${tag.count}</span><span class="tag-manager-actions"><button class="tag-edit" title="Rename tag">✎</button><button class="tag-delete" title="Delete tag">×</button></span></div>`).join('')}</div></section>`).join('') : '<div class="facet-empty">No tags yet</div>';
  $$('.tag-manager-item').forEach((row) => {
    const tag = row.dataset.tag;
    row.querySelector('.tag-manager-name').addEventListener('dblclick', () => {
      Object.values(state.filters).forEach((values) => values?.clear?.());
      state.filters.tags = new Set([tag]); state.kind = 'all'; state.view = 'all'; state.locationId = null; state.collectionId = null; state.smartFolderId = null; state.gridScrollTop = 0;
      elements.title.textContent = tag; updateFilterChips(); render();
    });
    row.querySelector('.tag-edit').addEventListener('click', async () => {
      const name = await requestText({ title: 'Rename Tag', label: 'Tag name', value: tag, confirmText: 'Rename' });
      if (name && name.trim() && name.trim().toLowerCase() !== tag.toLowerCase()) await window.pigeon.renameTag(tag, name.trim());
    });
    row.querySelector('.tag-delete').addEventListener('click', async () => { if (await requestConfirmation({ title: 'Delete Tag', message: `Remove “${tag}” from every asset?`, confirmText: 'Delete' })) await window.pigeon.deleteTag(tag); });
  });
}

function analyticsAssets() {
  const scope = state.analyticsScope || { type: 'portfolio' }, assets = state.library.assets.filter((asset) => !asset.deletedAt && !asset.locked);
  if (scope.type === 'location') {
    const location = state.library.locations.find((item) => item.id === scope.id); if (!location) return [];
    const root = String(location.path || '').replace(/\\/g, '/').replace(/\/$/, ''), folder = `${root}${scope.subfolder ? `/${scope.subfolder}` : ''}`.toLowerCase();
    return assets.filter((asset) => { const source = String(asset.path || '').replace(/\\/g, '/').toLowerCase(); return asset.locationId === scope.id && (source === folder || source.startsWith(`${folder}/`)); });
  }
  if (scope.type === 'collection') {
    const ids = new Set([scope.id]); let changed = true; while (changed) { changed = false; for (const collection of state.library.collections || []) if (collection.parentId && ids.has(collection.parentId) && !ids.has(collection.id)) { ids.add(collection.id); changed = true; } }
    return assets.filter((asset) => (asset.collectionIds || []).some((id) => ids.has(id)));
  }
  return assets;
}
function analyticsScopeName() {
  const scope = state.analyticsScope || { type: 'portfolio' };
  if (scope.type === 'location') { const location = state.library.locations.find((item) => item.id === scope.id); return scope.subfolder?.split('/').pop() || location?.name || 'Folder'; }
  if (scope.type === 'collection') return state.library.collections.find((item) => item.id === scope.id)?.name || 'Collection';
  return (state.library.portfolios || []).find((item) => item.id === state.library.activePortfolioId)?.name || 'Current portfolio';
}
function analyticsCount(items, key) { const map = new Map(); for (const item of items) { const value = typeof key === 'function' ? key(item) : item[key]; if (value !== null && value !== undefined && value !== '') map.set(value, (map.get(value) || 0) + 1); } return [...map].sort((a, b) => b[1] - a[1]); }
const analyticsColors = ['#5688ff','#7b65e9','#42b883','#e4a84e','#e6678a','#45a9c4','#a2ba58','#d27b53','#7d879b'];
function analyticsPie(entries, label) {
  const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1; let cursor = 0;
  const stops = entries.slice(0, 9).map(([, count], index) => { const start = cursor; cursor += count / total * 100; return `${analyticsColors[index % analyticsColors.length]} ${start}% ${cursor}%`; });
  return `<div class="analytics-pie-wrap"><div class="analytics-pie" style="background:conic-gradient(${stops.join(',') || '#333 0 100%'})"><span><strong>${(total === 1 && !entries.length ? 0 : total).toLocaleString()}</strong><small>${escapeHtml(label)}</small></span></div><div class="analytics-legend">${entries.slice(0,9).map(([name,count],index) => `<div><i style="--legend:${analyticsColors[index % analyticsColors.length]}"></i><span>${escapeHtml(name)}</span><strong>${count.toLocaleString()}</strong><small>${Math.round(count / total * 100)}%</small></div>`).join('')}</div></div>`;
}
function analyticsHeatmap(assets) {
  const counts = new Map(); for (const asset of assets) { const date = new Date(asset.indexedAt || asset.modified); if (!Number.isNaN(date.valueOf())) { const key = date.toISOString().slice(0,10); counts.set(key, (counts.get(key) || 0) + 1); } }
  const maximum = Math.max(1, ...counts.values()), today = new Date(); today.setHours(0,0,0,0); const cells = [];
  for (let offset = 363; offset >= 0; offset -= 1) { const date = new Date(today); date.setDate(today.getDate() - offset); const key = date.toISOString().slice(0,10), count = counts.get(key) || 0, level = count ? Math.max(1, Math.ceil(count / maximum * 4)) : 0; cells.push(`<span class="heat-cell level-${level}" title="${key}: ${count} file${count === 1 ? '' : 's'}"></span>`); }
  return `<div class="heatmap-shell"><div class="heatmap-months"><span>12 months ago</span><span>6 months ago</span><span>Today</span></div><div class="analytics-heatmap">${cells.join('')}</div><div class="heatmap-key"><span>Less</span>${[0,1,2,3,4].map((level) => `<i class="heat-cell level-${level}"></i>`).join('')}<span>More</span></div></div>`;
}
function renderAnalytics() {
  const assets = analyticsAssets(), scopeName = analyticsScopeName(), totalSize = assets.reduce((sum, asset) => sum + (Number(asset.size) || 0), 0), online = assets.filter((asset) => !isOffline(asset)).length, tagged = assets.filter((asset) => (asset.tags || []).length).length, dimensions = assets.filter((asset) => asset.width && asset.height).length, duration = assets.reduce((sum, asset) => sum + (Number(asset.duration) || 0), 0), ratings = assets.filter((asset) => asset.rating), averageRating = ratings.length ? ratings.reduce((sum, asset) => sum + asset.rating, 0) / ratings.length : 0;
  const kinds = analyticsCount(assets, (asset) => asset.kind || 'file'), extensions = analyticsCount(assets, (asset) => asset.extension || 'FILE'), locations = analyticsCount(assets, (asset) => locationFor(asset)?.name || 'Unknown'), tab = state.analyticsTab;
  $('#analytics-title').textContent = `${scopeName} Analytics`; $('#analytics-subtitle').textContent = state.analyticsScope.type === 'portfolio' ? 'Local telemetry for the current portfolio.' : 'Includes this folder and every descendant subfolder.';
  $$('#analytics-tabs [data-analytics-tab]').forEach((button) => button.classList.toggle('active', button.dataset.analyticsTab === tab));
  const stats = `<div class="analytics-stat-grid"><article><span>Files</span><strong>${assets.length.toLocaleString()}</strong><small>${online.toLocaleString()} online</small></article><article><span>Storage</span><strong>${formatBytes(totalSize)}</strong><small>${assets.length ? formatBytes(totalSize / assets.length) : '—'} average</small></article><article><span>Tagged</span><strong>${assets.length ? Math.round(tagged / assets.length * 100) : 0}%</strong><small>${tagged.toLocaleString()} organized</small></article><article><span>Average rating</span><strong>${averageRating ? averageRating.toFixed(1) : '—'}</strong><small>${ratings.length.toLocaleString()} rated</small></article><article><span>Metadata</span><strong>${assets.length ? Math.round(dimensions / assets.length * 100) : 0}%</strong><small>dimensions available</small></article><article><span>Media duration</span><strong>${formatMediaTime(duration)}</strong><small>audio and video</small></article></div>`;
  if (tab === 'overview') elements.analyticsContent.innerHTML = `${stats}<div class="analytics-panel-grid"><article class="analytics-panel"><header><strong>File family</strong><span>Distribution</span></header>${analyticsPie(kinds, 'files')}</article><article class="analytics-panel analytics-health"><header><strong>Library health</strong><span>Coverage</span></header>${[['Online',online],['Tagged',tagged],['Dimensions',dimensions],['Favourites',assets.filter((asset)=>asset.favorite).length]].map(([label,value]) => `<label><span>${label}</span><strong>${assets.length ? Math.round(value/assets.length*100) : 0}%</strong><i><b style="width:${assets.length ? value/assets.length*100 : 0}%"></b></i></label>`).join('')}</article></div>`;
  if (tab === 'types') elements.analyticsContent.innerHTML = `<div class="analytics-panel-grid"><article class="analytics-panel"><header><strong>Extensions</strong><span>Top formats</span></header>${analyticsPie(extensions, 'files')}</article><article class="analytics-panel"><header><strong>Locations</strong><span>Source distribution</span></header>${analyticsPie(locations, 'files')}</article></div><article class="analytics-panel analytics-wide"><header><strong>Complete type breakdown</strong><span>${extensions.length} formats</span></header><div class="analytics-table">${extensions.map(([name,count],index)=>`<div><i style="--legend:${analyticsColors[index%analyticsColors.length]}"></i><strong>${escapeHtml(name)}</strong><span>${count.toLocaleString()} files</span><small>${formatBytes(assets.filter((asset)=>asset.extension===name).reduce((sum,asset)=>sum+(asset.size||0),0))}</small></div>`).join('')}</div></article>`;
  if (tab === 'activity') elements.analyticsContent.innerHTML = `${stats}<article class="analytics-panel analytics-wide"><header><strong>Files added</strong><span>Last 52 weeks</span></header>${analyticsHeatmap(assets)}</article>`;
  if (tab === 'details') { const largest = [...assets].sort((a,b)=>(b.size||0)-(a.size||0)).slice(0,12); elements.analyticsContent.innerHTML = `${stats}<div class="analytics-panel-grid"><article class="analytics-panel"><header><strong>Telemetry details</strong><span>Current scope</span></header><dl class="analytics-details"><div><dt>Offline</dt><dd>${(assets.length-online).toLocaleString()}</dd></div><div><dt>Favourites</dt><dd>${assets.filter((asset)=>asset.favorite).length.toLocaleString()}</dd></div><div><dt>Duplicate candidates</dt><dd>${assets.filter((asset)=>state.duplicateIds.has(asset.id)).length.toLocaleString()}</dd></div><div><dt>Unique tags</dt><dd>${new Set(assets.flatMap((asset)=>asset.tags||[]).map((tag)=>tag.toLowerCase())).size.toLocaleString()}</dd></div><div><dt>Oldest indexed</dt><dd>${assets.length ? formatDate(Math.min(...assets.map((asset)=>asset.indexedAt||asset.modified))) : '—'}</dd></div><div><dt>Newest indexed</dt><dd>${assets.length ? formatDate(Math.max(...assets.map((asset)=>asset.indexedAt||asset.modified))) : '—'}</dd></div></dl></article><article class="analytics-panel"><header><strong>Largest files</strong><span>Top ${largest.length}</span></header><div class="analytics-file-list">${largest.map((asset)=>`<div data-analytics-asset="${asset.id}"><span>${escapeHtml(asset.filename)}</span><small>${asset.extension}</small><strong>${formatBytes(asset.size)}</strong></div>`).join('') || '<p>No files in this scope.</p>'}</div></article></div>`; }
}
function openAnalytics(scope = { type: 'portfolio', id: null, subfolder: '' }) { rememberTemporaryViewOrigin(); hideInternalViewer(); closeFloatingMenus(); state.analyticsScope = { type: 'portfolio', id: null, subfolder: '', ...scope }; state.analyticsTab = 'overview'; state.view = 'analytics'; state.locationId = null; state.collectionId = null; state.smartFolderId = null; elements.title.textContent = 'Analytics'; render(); }

function renderGrid() {
  elements.annotationView.classList.add('hidden');applyThumbnailEffectPreferences();
  const lockedCollection = state.collectionId ? state.library.collections.find((item) => item.id === state.collectionId && item.locked) : null;
  elements.lockedContent.classList.toggle('hidden', !lockedCollection);
  if (lockedCollection) {
    $('.content-area').classList.remove('analytics-active'); elements.analyticsView.classList.add('hidden'); elements.grid.classList.add('hidden'); elements.empty.classList.add('hidden'); elements.tagBrowser.classList.add('hidden'); elements.sentinel.classList.add('hidden'); $('#duplicate-controls').classList.add('hidden');
    $('#locked-hint').textContent = lockedCollection.lock?.hint ? `Hint: ${lockedCollection.lock.hint}` : `${lockedCollection.name} is password protected.`; $('#inline-unlock-error').textContent = ''; elements.count.textContent = 'Locked'; elements.status.textContent = 'Enter the collection password to continue'; requestAnimationFrame(() => $('#inline-unlock-password').focus()); saveNavigationState(); return;
  }
  const analyticsMode = state.view === 'analytics'; elements.analyticsView.classList.toggle('hidden', !analyticsMode); $('.content-area').classList.toggle('analytics-active', analyticsMode);
  if (analyticsMode) { elements.grid.classList.add('hidden'); elements.empty.classList.add('hidden'); elements.tagBrowser.classList.add('hidden'); elements.sentinel.classList.add('hidden'); $('#duplicate-controls').classList.add('hidden'); renderAnalytics(); saveNavigationState(); return; }
  const allAssets = filteredAssets(),duplicateMode = !state.library.loading && state.view === 'duplicates' && !state.locationId && !state.collectionId && !state.smartFolderId;
  state.virtualStart=0;state.virtualMetrics=null;
  const assets = allAssets,stackCounts=new Map(); for(const item of state.library.assets)if(item.stackId&&!item.deletedAt)stackCounts.set(item.stackId,(stackCounts.get(item.stackId)||0)+1);
  const loading = state.library.loading === true || state.library.assetStreamPending === true;
  const noLibrary = !loading && (state.library.totalAssets ?? state.library.assets.length) === 0;
  const noSources=noLibrary&&(state.library.locations||[]).length===0;
  const tagMode = !loading && state.view === 'tags' && !state.locationId && !state.collectionId && !state.smartFolderId;
  elements.tagBrowser.classList.toggle('hidden', !tagMode); $('#duplicate-controls').classList.toggle('hidden', !duplicateMode);
  elements.grid.classList.toggle('duplicates-layout', duplicateMode);elements.grid.classList.toggle('placeholder-grid',!duplicateMode&&state.layout==='grid'); elements.gridWrap.classList.toggle('duplicates-view', duplicateMode);
  if (duplicateMode) { $('#duplicate-similarity').value = String(state.duplicateSimilarity); $('#duplicate-similarity-value').textContent = `${state.duplicateSimilarity}%`; $('#duplicate-mode-label').textContent = state.duplicateSourceId ? 'Similar to selected image' : 'Similar image groups'; $('#duplicate-summary').textContent = `${state.duplicateGroups.length} ${state.duplicateGroups.length === 1 ? 'group' : 'groups'} · ${state.duplicateIds.size} images`; $('#show-all-duplicate-groups').classList.toggle('hidden', !state.duplicateSourceId); }
  if (tagMode) {
    elements.empty.classList.add('hidden'); elements.grid.classList.add('hidden'); elements.sentinel.classList.add('hidden');
    renderTagBrowser();
    const tagCount = new Set(state.library.assets.filter((asset)=>!asset.deletedAt).flatMap((asset) => asset.tags || []).map((tag) => tag.toLowerCase())).size;
    elements.count.textContent = `${tagCount} ${tagCount === 1 ? 'tag' : 'tags'}`;
    elements.status.textContent = `${tagCount} tags across ${state.library.assets.filter((asset) => !asset.deletedAt).length} references`;
    saveNavigationState(); return;
  }
  elements.empty.classList.toggle('hidden', !loading && !noLibrary);
  elements.emptyTitle.textContent = loading?'Opening your portfolio':noSources?'Your portfolio is ready':'No files found';
  elements.emptyDescription.textContent = loading
    ? 'Pigeon is ready. Sources and previews are loading safely in the background.'
    : noSources?'Start with the Pictures folder on this computer, or choose another source.':'This portfolio has an indexed source, but it does not contain any supported files yet.';
  $('#empty-add-pictures').classList.toggle('hidden',loading||!noSources);
  elements.emptyActions.classList.toggle('hidden', loading);
  elements.grid.classList.toggle('hidden', loading || noLibrary);
  elements.gridWrap.classList.toggle('layout-list', state.layout === 'list');
  elements.gridWrap.classList.toggle('layout-justified', state.layout === 'justified');
  elements.count.textContent = loading ? 'Loading…' : `${allAssets.length} ${allAssets.length === 1 ? 'item' : 'items'}`;
  rotatedThumbnailObserver.disconnect();thumbnailVisibilityObserver.disconnect();pendingThumbnailCards.clear();clearTimeout(thumbnailSettleTimer);
  elements.grid.classList.remove('virtualized-grid');elements.grid.style.height='';elements.grid.style.minHeight='';elements.grid.style.paddingTop='';
  elements.grid.innerHTML = assets.map((asset) => {
    const visual = ['image', 'video', 'audio', 'document'].includes(asset.kind) && Boolean(asset.thumbnailPath), previewFailed = Boolean(asset.thumbnailFailedAt && !asset.thumbnailPath);
    const originalRatio = Math.max(.35, Math.min(3.5, asset.width && asset.height ? asset.width / asset.height : asset.kind === 'audio' ? 3.75 : 1.35));
    const quarterTurn = Boolean((Number(asset.rotation) || 0) % 180);
    const preview = visual
      ? `<div class="asset-image-placeholder" aria-label="Thumbnail loading"></div>${asset.kind === 'video' ? `<span class="media-preview-badge video-play-badge">${iconSvg('video')}<span>${asset.duration ? formatMediaTime(asset.duration) : ''}</span></span>` : asset.kind === 'audio' ? `<span class="media-preview-badge audio-badge">${iconSvg('audio')}<span>${asset.duration ? formatMediaTime(asset.duration) : ''}</span></span><span class="media-scrub-time">00:00</span>` : ''}`
      : previewFailed
        ? `<div class="asset-file asset-preview-failed" title="${escapeHtml(asset.thumbnailError || 'Preview unavailable')}"><span class="file-glyph">${iconFor(asset.kind)}</span><span class="file-ext">${escapeHtml(asset.extension)}</span><small>Preview unavailable</small></div>`
        : ['image', 'video', 'audio'].includes(asset.kind)
          ? '<div class="asset-image-placeholder" aria-label="Thumbnail loading"></div>'
          : `<div class="asset-file"><span class="file-glyph">${iconFor(asset.kind)}</span><span class="file-ext">${escapeHtml(asset.extension)}</span></div>`;
    const stackCount = asset.stackId ? stackCounts.get(asset.stackId)||0 : 0;
    const stackBadge = stackCount > 1 ? `<button class="stack-badge" data-stack-id="${asset.stackId}" title="${state.expandedStackIds.has(asset.stackId) ? 'Collapse stack' : 'Preview stack'}">▱ ${stackCount}</button>` : '';
    const titleLines = state.thumbnailTitleLines.filter((field) => field !== 'none').map((field) => ({ field, text: thumbnailTitle(asset, field) })).filter((line) => line.text);
    const titleHtml = titleLines.map((line, index) => `<span class="card-title-line ${index === 0 ? 'card-name' : ''}" data-title-field="${line.field}" title="${escapeHtml(line.text)}">${escapeHtml(line.text)}</span>`).join('');
    const ratio = quarterTurn ? 1 / originalRatio : originalRatio;
    const justifiedHeight = Math.max(52, Math.min(320, Number($('#zoom-slider').value) * .58));
    return `<article class="asset-card ${state.selectedId === asset.id ? 'selected' : ''} ${state.selectedIds.has(asset.id) ? 'multi-selected' : ''} ${asset.sourceMissing ? 'source-missing' : ''} ${asset.thumbnailEffect?'thumbnail-effect-applied':''}" style="--asset-ratio:${ratio};--justified-basis:${Math.round(justifiedHeight * ratio)}px" data-asset-id="${asset.id}" data-asset-kind="${asset.kind}" tabindex="0" draggable="true">
      <div class="asset-preview ${quarterTurn ? 'quarter-turned' : ''}" style="--original-ratio:${originalRatio};--preview-ratio:${ratio}" ${visual?`data-thumbnail-src="${protectedUrl(asset.previewUrl)}" data-thumbnail-transform="${rotationTransform(asset)}"`:''}>${preview}${visual&&asset.kind==='image'?`<button class="thumbnail-fit-preview" type="button" title="Preview full image" aria-label="Preview ${escapeHtml(asset.name)}">${iconSvg('search')}</button>`:''}${stackBadge}${asset.sourceMissing ? '<span class="source-missing-overlay">Source Missing</span>' : isOffline(asset) ? '<span class="card-offline">Offline</span>' : ''}</div>
      <div class="card-meta ${titleHtml ? '' : 'no-titles'}"><span class="card-titles">${titleHtml}</span>${asset.favorite ? '<span class="card-favorite">★</span>' : ''}</div>
    </article>`;
  }).join('');
  if (duplicateMode) {
    const cardsById = new Map($$('.asset-card').map((card) => [card.dataset.assetId, card])); elements.grid.innerHTML = '';
    state.duplicateGroups.forEach((group, index) => {
      const cards = group.map((id) => cardsById.get(id)).filter(Boolean); if (cards.length < 2) return;
      const section = document.createElement('section'); section.className = 'duplicate-group'; section.innerHTML = `<h3 class="duplicate-group-title">${state.duplicateSourceId ? `Source image + ${cards.length - 1} similar` : `Similar group ${index + 1} · ${cards.length} images`}</h3><div class="duplicate-row"></div>`;
      const row = section.querySelector('.duplicate-row'); cards.forEach((card) => row.appendChild(card)); elements.grid.appendChild(section);
    });
  }
  $$('.stack-badge').forEach((badge) => {
    badge.addEventListener('dblclick', (event) => event.stopPropagation());
    badge.addEventListener('click', (event) => {
    event.stopPropagation();
    const stackId = badge.dataset.stackId;
    state.expandedStackIds.has(stackId) ? state.expandedStackIds.delete(stackId) : state.expandedStackIds.add(stackId);
    renderGrid();
    });
  });
  $$('.asset-card').forEach((card) => {
    card.addEventListener('click', (event) => {
      selectAssetWithEvent(card.dataset.assetId, event);
      const title = event.target.closest('.card-title-line[data-title-field="name"], .card-title-line[data-title-field="filename"]'), now = Date.now(), elapsed = now - lastFilenameClick.time;
      if (title && lastFilenameClick.assetId === card.dataset.assetId && elapsed >= 350 && elapsed <= 2500) { lastFilenameClick = { assetId: null, time: 0 }; beginInlineFilenameRename(card.dataset.assetId, title); }
      else lastFilenameClick = title ? { assetId: card.dataset.assetId, time: now } : { assetId: null, time: 0 };
    });
    card.addEventListener('dragstart', (event) => {
      if(marqueeSelection){event.preventDefault();return;}
      const ids = state.selectedIds.has(card.dataset.assetId) ? [...state.selectedIds] : [card.dataset.assetId];
      event.dataTransfer.setData('application/x-pigeon-assets', JSON.stringify(ids));
      event.dataTransfer.setData('application/x-pigeon-origin',JSON.stringify({collectionId:state.collectionId||null,locationId:state.locationId||null,subfolder:state.locationSubfolder||''}));
      const draggedAssets=ids.map((id)=>state.library.assets.find((asset)=>asset.id===id)).filter(Boolean),paths=draggedAssets.map((asset)=>asset.path).filter(Boolean);event.dataTransfer.effectAllowed = 'move';event.dataTransfer.effectAllowed = 'copyMove';event.dataTransfer.setData('text/plain',paths.join('\n'));if(draggedAssets[0]?.mediaUrl)event.dataTransfer.setData('DownloadURL',`application/octet-stream:${draggedAssets[0].filename}:${draggedAssets[0].mediaUrl}`);card._pigeonDragIds=ids;card._pigeonNativeDragStarted=false;
    });
    card.addEventListener('drag',(event)=>{if(card._pigeonNativeDragStarted||!card._pigeonDragIds?.length)return;const outside=event.screenX===0&&event.screenY===0||event.clientX<0||event.clientY<0||event.clientX>window.innerWidth||event.clientY>window.innerHeight;if(outside){card._pigeonNativeDragStarted=true;window.pigeon.startAssetDrag(card._pigeonDragIds);}});card.addEventListener('dragend',()=>{delete card._pigeonDragIds;delete card._pigeonNativeDragStarted;});
    card.addEventListener('dblclick', () => preferences.doubleClick === 'default' ? window.pigeon.openAsset(card.dataset.assetId) : openInternalViewer(card.dataset.assetId));
    card.addEventListener('auxclick', (event) => { if (event.button === 1) { event.preventDefault(); window.pigeon.openAsset(card.dataset.assetId); } });
    card.addEventListener('contextmenu', (event) => showAssetContextMenu(event, card.dataset.assetId));
    const magnifier=card.querySelector('.thumbnail-fit-preview'),hoverPreview=$('#hover-fit-preview');if(magnifier){let hovering=false,loaded=false,delayDone=false;const reveal=()=>{if(hovering&&loaded&&delayDone)hoverPreview.classList.remove('hidden');};const show=()=>{hovering=true;loaded=false;delayDone=false;clearTimeout(hoverFitPreviewTimer);const bounds=elements.gridWrap.getBoundingClientRect();Object.assign(hoverPreview.style,{left:`${bounds.left}px`,top:`${bounds.top}px`,width:`${bounds.width}px`,height:`${bounds.height}px`,right:'auto',bottom:'auto'});const asset=state.library.assets[rendererAssetIndexes.get(card.dataset.assetId)],image=hoverPreview.querySelector('img');if(!asset)return;hoverPreview.classList.toggle('privacy-effect-view',Boolean(asset.thumbnailEffect));hoverFitPreviewTimer=setTimeout(()=>{delayDone=true;reveal();},300);image.onload=()=>{loaded=true;reveal();};image.src=protectedUrl(asset.mediaUrl||asset.previewUrl);if(image.complete&&image.naturalWidth){loaded=true;reveal();}};const hide=()=>{hovering=false;clearTimeout(hoverFitPreviewTimer);hoverPreview.classList.add('hidden');hoverPreview.classList.remove('privacy-effect-view');hoverPreview.querySelector('img').onload=null;hoverPreview.querySelector('img').removeAttribute('src');};magnifier.addEventListener('pointerenter',show);magnifier.addEventListener('focus',show);magnifier.addEventListener('pointerleave',hide);magnifier.addEventListener('blur',hide);magnifier.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();});}
    card.addEventListener('keydown', (event) => { if (event.key === 'Enter') openInternalViewer(card.dataset.assetId); });
    const asset = state.library.assets[rendererAssetIndexes.get(card.dataset.assetId)]; if (asset) attachHoverMediaPreview(card, asset);
  });
  elements.grid.querySelectorAll('.asset-card').forEach((card)=>thumbnailVisibilityObserver.observe(card));
  if (state.layout === 'grid') scheduleMasonry();
  renderBatchBar();
  requestAnimationFrame(() => { if(Date.now()>=state.postMoveRevealUntil&&Math.abs(elements.gridWrap.scrollTop-state.gridScrollTop)>2&&state.virtualStart===0)elements.gridWrap.scrollTop = state.gridScrollTop; });
  elements.sentinel.classList.add('hidden');elements.sentinel.textContent='';
  const checking = state.library.locations.some((location) => location.checking);
  const totalAssets = state.library.totalAssets ?? state.library.assets.length;
  const scanningLocation = state.library.locations.find((location) => location.scanning), progress = scanningLocation?.scanProgress;
  elements.status.textContent = loading ? 'Opening portfolio…' : scanningLocation
    ? `Indexing ${scanningLocation.name}… ${progress?.inspected || 0}${progress?.discovered ? ` / ${progress.discovered}` : ''}` : checking ? 'Checking sources in the background…' : `${totalAssets} references across ${state.library.locations.length} ${state.library.locations.length === 1 ? 'location' : 'locations'}`;
  saveNavigationState();
}

function fitRotatedThumbnail(image) {
  const preview = image.closest('.asset-preview.quarter-turned'), card = image.closest('.asset-card'); if (!preview || !card || !image.naturalWidth || !image.naturalHeight) return;
  const effectiveRatio = image.naturalHeight / image.naturalWidth;
  preview.style.setProperty('--preview-ratio', String(effectiveRatio)); card.style.setProperty('--asset-ratio', String(effectiveRatio));
  const rowHeight = Math.max(52, Math.min(320, Number($('#zoom-slider').value) * .58)); card.style.setProperty('--justified-basis', `${Math.round(rowHeight * effectiveRatio)}px`);
  rotatedThumbnailObserver.observe(preview);
  requestAnimationFrame(() => {
    const width = preview.clientWidth, height = preview.clientHeight; if (!width || !height) return;
    preview.style.setProperty('--rotated-image-width', `${height}px`); preview.style.setProperty('--rotated-image-height', `${width}px`); scheduleMasonry();
  });
}
function scheduleMasonry() {
  cancelAnimationFrame(masonryFrame);
  masonryFrame = requestAnimationFrame(layoutMasonry);
}

function layoutMasonry() {
  if (state.layout !== 'grid' || elements.grid.classList.contains('hidden')||elements.grid.classList.contains('placeholder-grid')) return;
  const styles=getComputedStyle(elements.grid),rowHeight=parseFloat(styles.gridAutoRows)||4,rowGap=parseFloat(styles.rowGap)||4,cards=[...elements.grid.querySelectorAll('.asset-card')];
  for(const card of cards)card.style.gridRowEnd='auto';
  const heights=cards.map((card)=>card.getBoundingClientRect().height);
  for(let index=0;index<cards.length;index++)cards[index].style.gridRowEnd=`span ${Math.max(1,Math.ceil((heights[index]+rowGap)/(rowHeight+rowGap)))}`;
}

async function renameAssetFile(assetId, requestedName) {
  const asset = state.library.assets.find((item) => item.id === assetId);
  const name = String(requestedName || '').trim();
  if (!name) { showToast('Enter a filename'); renderGrid(); renderInspector(); return false; }
  if (asset && name === asset.name) { renderGrid(); renderInspector(); return false; }
  try {
    const updated = await window.pigeon.renameAssetFile(assetId, name); if (!updated) return false;
    const current = state.library.assets.find((item) => item.id === updated.id); if (current) Object.assign(current, updated); renderGrid(); renderInspector(); showToast(`Renamed to ${updated.filename}`); return updated;
  } catch (error) { showToast(error.message); renderInspector(); return false; }
}
function beginInlineFilenameRename(assetId, titleElement) {
  const asset = state.library.assets.find((item) => item.id === assetId); if (!asset || !titleElement || titleElement.querySelector('input')) return;
  const input = document.createElement('input'); input.className = 'card-filename-input'; input.value = asset.name; input.setAttribute('aria-label', 'Filename without extension');
  titleElement.replaceChildren(input); let finished = false;
  const finish = async (save) => { if (finished) return; finished = true; if (save) await renameAssetFile(assetId, input.value); else renderGrid(); };
  input.addEventListener('click', (event) => event.stopPropagation());
  input.addEventListener('dblclick', (event) => event.stopPropagation());
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); finish(true); } else if (event.key === 'Escape') { event.preventDefault(); finish(false); } });
  input.addEventListener('blur', () => finish(true), { once: true }); input.focus(); input.select();
}
function beginInspectorFilenameRename() { if (!state.selectedId) return; elements.assetName.focus(); elements.assetName.select(); }

function renderInspector() {
  const asset = state.library.assets.find((item) => item.id === state.selectedId);
  elements.inspectorPlaceholder.classList.toggle('hidden', Boolean(asset));
  elements.inspectorContent.classList.toggle('hidden', !asset);
  if (!asset) return;
  const location = locationFor(asset);
  const image = asset.kind === 'image', video = asset.kind === 'video', audio = asset.kind === 'audio';
  elements.inspectorImage.classList.toggle('hidden', !image);
  elements.inspectorVideo.classList.toggle('hidden', !video);
  elements.inspectorAudio.classList.toggle('hidden', !audio);
  elements.inspectorFileIcon.classList.toggle('hidden', image || video || audio);
  elements.inspectorVideo.pause(); elements.inspectorAudio.pause();
  if (image) { elements.inspectorImage.src = protectedUrl(asset.thumbnailPath ? asset.previewUrl : asset.mediaUrl); elements.inspectorImage.style.transform = rotationTransform(asset, true); }
  else if (video) { if (elements.inspectorVideo.dataset.assetId !== asset.id) delete elements.inspectorVideo.dataset.userRequested; elements.inspectorVideo.dataset.assetId = asset.id; elements.inspectorVideo.poster = asset.previewUrl || ''; if (elements.inspectorVideo.getAttribute('src') !== asset.mediaUrl) { elements.inspectorVideo.src = asset.mediaUrl; elements.inspectorVideo.load(); } if (preferences.videoAutoplay) elements.inspectorVideo.play().catch(() => {}); }
  else if (audio) elements.inspectorAudio.src = asset.mediaUrl;
  else elements.inspectorFileIcon.textContent = `${iconFor(asset.kind)}  ${asset.extension}`;
  elements.format.textContent = asset.extension;
  elements.offline.textContent = asset.sourceMissing ? 'Source Missing' : 'Source offline'; elements.offline.classList.toggle('hidden', !isOffline(asset));
  elements.assetName.value = asset.name;
  elements.note.value = asset.note || '';
  if (state.tagDraftAssetId !== asset.id) { elements.tags.value = ''; state.tagDraftAssetId = asset.id; }
  elements.tagPills.innerHTML = (asset.tags || []).map((tag) => `<button class="tag-pill" data-tag="${escapeHtml(tag)}"><span>${escapeHtml(tag)}</span><span class="tag-remove" title="Remove ${escapeHtml(tag)}">×</span></button>`).join('');
  $$('.tag-pill[data-tag]').forEach((pill) => {
    pill.addEventListener('click', async (event) => {
      const tag = pill.dataset.tag;
      await updateSelected({ tags: (asset.tags || []).filter((item) => item !== tag) });
      if (!event.target.closest('.tag-remove')) { elements.tags.value = tag; elements.tags.focus(); elements.tags.select(); }
    });
  });
  elements.metaLocation.textContent = location?.name || 'Unknown';
  elements.metaLocation.title = asset.path;
  elements.metaFile.textContent = asset.filename;
  elements.metaSize.textContent = formatBytes(asset.size);
  elements.metaModified.textContent = formatDate(asset.modified);
  elements.metaDimensions.textContent = asset.width && asset.height ? `${asset.width} × ${asset.height}` : '—';
  elements.metaColor.textContent = asset.dominantColor || '—';
  elements.metaHash.textContent = asset.contentHash ? asset.contentHash.slice(0, 12) : '—';
  const imageExif = asset.exif?.Image || {}, photoExif = asset.exif?.Photo || {};
  elements.metaCamera.textContent = [imageExif.Make, imageExif.Model].filter(Boolean).join(' ') || '—';
  elements.metaExposure.textContent = [photoExif.ExposureTime ? `${photoExif.ExposureTime}s` : null, photoExif.FNumber ? `f/${photoExif.FNumber}` : null, photoExif.ISOSpeedRatings ? `ISO ${photoExif.ISOSpeedRatings}` : null].filter(Boolean).join(' · ') || '—';
  elements.metaGeo.textContent = asset.geo ? (asset.geo.address || `${Number(asset.geo.lat).toFixed(5)}, ${Number(asset.geo.lon).toFixed(5)}`) : '—';
  const additional=$('#additional-metadata'),additionalContent=$('#additional-metadata-content'),comfy=$('#comfyui-metadata'),comfyContent=$('#comfyui-metadata-content'),additionalValue={technical:asset.technicalMetadata||undefined,exif:asset.exif||undefined},embedded=asset.embeddedMetadata||{},comfyValue=Object.fromEntries(Object.entries(embedded).filter(([key,value])=>/prompt|workflow|parameters/i.test(key)||/"(?:nodes|class_type|prompt|workflow)"/.test(String(value))));additional.classList.toggle('hidden',!preferences.showAdditionalMetadata);if(preferences.showAdditionalMetadata){additionalContent.textContent=JSON.stringify(additionalValue,null,2);comfy.classList.toggle('hidden',!Object.keys(comfyValue).length);comfyContent.textContent=Object.keys(comfyValue).length?JSON.stringify(comfyValue,null,2):'';}
  elements.palette.innerHTML = (asset.palette || [asset.dominantColor]).filter(Boolean).map((color) => `<span style="background:${escapeHtml(color)}" title="${escapeHtml(color)}"></span>`).join('');
  const histogramMax = Math.max(...(asset.histogram || [1]));
  elements.histogram.innerHTML = (asset.histogram || []).map((value) => `<span style="height:${Math.max(2, value / histogramMax * 100)}%"></span>`).join('');
  elements.histogram.classList.toggle('hidden', !asset.histogram);
  elements.rating.innerHTML = [1,2,3,4,5].map((value) => `<button class="star ${value <= asset.rating ? 'active' : ''}" data-rating="${value}" title="${value} stars">★</button>`).join('') + `<button class="star ${asset.favorite ? 'active' : ''}" id="favorite-button" title="Favorite">♡</button>`;
  $$('.star[data-rating]').forEach((star) => star.addEventListener('click', () => updateSelected({ rating: Number(star.dataset.rating) === asset.rating ? 0 : Number(star.dataset.rating) })));
  $('#favorite-button').addEventListener('click', () => updateSelected({ favorite: !asset.favorite }));
}

async function recoverInspectorVideo() { const id = elements.inspectorVideo.dataset.assetId, asset = state.library.assets.find((item) => item.id === id); if (!asset || elements.inspectorVideo.dataset.recovering === id) return; elements.inspectorVideo.dataset.recovering = id; try { const mediaUrl = await window.pigeon.ensurePlayable(id); asset.mediaUrl = mediaUrl || asset.mediaUrl; if (state.selectedId === id) { elements.inspectorVideo.src = asset.mediaUrl; elements.inspectorVideo.load(); } } catch (error) { showToast(error.message); } finally { delete elements.inspectorVideo.dataset.recovering; } }
$('#copy-additional-metadata').addEventListener('click',async()=>{await window.pigeon.copyText($('#additional-metadata-content').textContent);showToast('Metadata copied');});$('#copy-comfyui-metadata').addEventListener('click',async()=>{await window.pigeon.copyText($('#comfyui-metadata-content').textContent);showToast('ComfyUI workflow copied');});
elements.inspectorVideo.addEventListener('play', () => { elements.inspectorVideo.dataset.userRequested = 'true'; if (elements.inspectorVideo.error) recoverInspectorVideo(); });
elements.inspectorVideo.addEventListener('click', () => { if (elements.inspectorVideo.error) { elements.inspectorVideo.dataset.userRequested = 'true'; recoverInspectorVideo(); } });
elements.inspectorVideo.addEventListener('canplay', () => { if (elements.inspectorVideo.dataset.userRequested === 'true' && elements.inspectorVideo.paused) elements.inspectorVideo.play().catch(() => {}); });
elements.inspectorVideo.addEventListener('error', () => { if (elements.inspectorVideo.dataset.userRequested === 'true') recoverInspectorVideo(); });
elements.inspectorVideo.addEventListener('stalled', () => { if (elements.inspectorVideo.dataset.userRequested === 'true' && elements.inspectorVideo.readyState < 2) recoverInspectorVideo(); });
let activeTagAutocompleteInput = null;
const tagAutocompleteInputs = new WeakSet();
function allExistingTags() {
  const configured = [...Object.values(state.library.settings?.folderAutoTags || {}), ...Object.values(state.library.settings?.collectionAutoTags || {})].flatMap((rule) => rule.tags || []);
  const canonical = new Map();
  for (const tag of [...state.library.assets.filter((asset)=>!asset.deletedAt).flatMap((asset) => asset.tags || []), ...configured]) { const value = String(tag).trim(); if (value && !canonical.has(value.toLowerCase())) canonical.set(value.toLowerCase(), value); }
  return [...canonical.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
function hideTagAutocomplete() { const popup = $('#tag-autocomplete'); if (popup.matches(':popover-open')) popup.hidePopover(); popup.classList.add('hidden'); activeTagAutocompleteInput?.setAttribute('aria-expanded', 'false'); activeTagAutocompleteInput = null; }
function mountTagAutocomplete(input, popup) { const host = input.closest('dialog[open]') || document.body; if (popup.parentElement === host) return; if (popup.matches(':popover-open')) popup.hidePopover(); host.appendChild(popup); }
function currentTagToken(input) {
  if (input.dataset.tagMultiple !== 'true') return { start: 0, end: input.value.length, query: input.value.trim() };
  const cursor = input.selectionStart ?? input.value.length, start = input.value.lastIndexOf(',', cursor - 1) + 1, next = input.value.indexOf(',', cursor);
  return { start, end: next < 0 ? input.value.length : next, query: input.value.slice(start, cursor).trim() };
}
function renderTagAutocomplete(input) {
  if (!input || input.disabled || input.type === 'password') return hideTagAutocomplete();
  const token = currentTagToken(input); if (!token.query && input.dataset.tagSuggestOnEmpty === 'false') return hideTagAutocomplete();
  const used = new Set(input.dataset.tagMultiple === 'true' ? input.value.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean) : []);
  const matches = allExistingTags().filter((tag) => !used.has(tag.toLowerCase()) && (!token.query || tag.toLowerCase().includes(token.query.toLowerCase()))).slice(0, 40), popup = $('#tag-autocomplete');
  if (!matches.length) return hideTagAutocomplete();
  activeTagAutocompleteInput = input; input.setAttribute('aria-expanded', 'true'); mountTagAutocomplete(input, popup); popup.innerHTML = matches.map((tag, index) => `<button type="button" role="option" class="${index === 0 ? 'active' : ''}" data-tag-suggestion="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join(''); popup.classList.remove('hidden'); if (!popup.matches(':popover-open')) popup.showPopover();
  const rect = input.getBoundingClientRect(); popup.style.minWidth = `${Math.max(190, rect.width)}px`; popup.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - popup.offsetWidth - 8))}px`; popup.style.top = `${Math.max(8, Math.min(rect.bottom + 3, window.innerHeight - popup.offsetHeight - 8))}px`;
}
function applyTagSuggestion(input, tag) {
  if(input===elements.tags){const targets=expandedTagTargetIds();input.value='';hideTagAutocomplete();addTagsToAssets(targets,[tag]);input.focus();return;}
  if (input.dataset.tagPillEditor === 'true') { addTextEntryTags([tag]); input.value = ''; hideTagAutocomplete(); input.focus(); return; }
  const token = currentTagToken(input), prefix = input.dataset.tagMultiple === 'true' && token.start ? `${input.value.slice(0, token.start).trimEnd()} ` : input.value.slice(0, token.start), suffix = input.value.slice(token.end);
  input.value = `${prefix}${tag}${suffix}`; const cursor = prefix.length + tag.length; input.setSelectionRange(cursor, cursor); input.dispatchEvent(new Event('input', { bubbles: true })); hideTagAutocomplete(); input.focus();
}
function enableTagAutocomplete(input, { multiple = false } = {}) {
  if (!input) return; input.dataset.tagAutocomplete = 'true'; input.dataset.tagMultiple = String(multiple); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', 'tag-autocomplete');
  if (tagAutocompleteInputs.has(input)) return; tagAutocompleteInputs.add(input);
  const refresh = () => { if (input.dataset.tagAutocomplete === 'true') renderTagAutocomplete(input); }; input.addEventListener('focus', refresh); input.addEventListener('input', refresh); input.addEventListener('click', refresh);
}
function renderTagSuggestions() {
  const tags = allExistingTags(); $('#tag-suggestions').innerHTML = tags.map((tag) => `<option value="${escapeHtml(tag)}"></option>`).join('');
  enableTagAutocomplete(elements.tags, { multiple: true }); enableTagAutocomplete($('#batch-tag-input'), { multiple: true });
  if (activeTagAutocompleteInput) renderTagAutocomplete(activeTagAutocompleteInput);
}
$('#tag-autocomplete').addEventListener('mousedown', (event) => { const button = event.target.closest('[data-tag-suggestion]'); if (!button || !activeTagAutocompleteInput) return; event.preventDefault(); applyTagSuggestion(activeTagAutocompleteInput, button.dataset.tagSuggestion); });
document.addEventListener('keydown', (event) => {
  const popup = $('#tag-autocomplete'); if (!activeTagAutocompleteInput || popup.classList.contains('hidden')) return;
  const options = [...popup.querySelectorAll('[data-tag-suggestion]')], active = Math.max(0, options.findIndex((button) => button.classList.contains('active')));
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopImmediatePropagation(); const next = (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length; options.forEach((button, index) => button.classList.toggle('active', index === next)); options[next].scrollIntoView({ block: 'nearest' }); }
  if ((event.key === 'Enter' || event.key === 'Tab') && options[active]) { event.preventDefault(); event.stopImmediatePropagation(); applyTagSuggestion(activeTagAutocompleteInput, options[active].dataset.tagSuggestion); }
  if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); hideTagAutocomplete(); }
}, true);
document.addEventListener('mousedown', (event) => { if (!event.target.closest('#tag-autocomplete, [data-tag-autocomplete="true"]')) hideTagAutocomplete(); }, true);
function updateSubfolderContentToggle() { const button = $('#subfolder-content-toggle'), enabled = state.includeSubfolderContent; button.classList.toggle('selected', enabled); button.setAttribute('aria-pressed', String(enabled)); button.title = enabled ? 'Hide content from subfolders' : 'Show content from subfolders'; button.setAttribute('aria-label', button.title); }
function render() { updateSubfolderContentToggle(); renderTagSuggestions(); renderSidebar(false); renderGrid(); renderInspector(); }
function resetRenderLimit() { state.renderLimit = 480;state.virtualStart=0;state.virtualMetrics=null; }
function clearSelection() { state.selectedIds.clear(); state.selectionAnchorId = null; }
let selectionInspectorFrame=null;
function paintCardSelection(card){if(!card)return;const selected=state.selectedIds.has(card.dataset.assetId);card.classList.toggle('selected',selected&&card.dataset.assetId===state.selectedId);card.classList.toggle('multi-selected',selected);card.setAttribute('aria-selected',String(selected));}
function paintChangedSelectionCards(ids){for(const id of new Set(ids.filter(Boolean)))paintCardSelection(elements.grid.querySelector(`[data-asset-id="${CSS.escape(id)}"]`));renderBatchBar();}
function scheduleSelectionInspector(){if(selectionInspectorFrame)cancelAnimationFrame(selectionInspectorFrame);selectionInspectorFrame=requestAnimationFrame(()=>{selectionInspectorFrame=null;renderInspector();});}
function updateCardSelectionStyles() {
  $$('.asset-card').forEach(paintCardSelection);
  renderBatchBar();
}
function paintActiveNavigation(){
  $$('.nav-item.active,.location-root-button.active').forEach((item)=>item.classList.remove('active'));
  let target;if(state.collectionId)target=document.querySelector(`[data-collection-id="${CSS.escape(state.collectionId)}"]`);else if(state.smartFolderId)target=document.querySelector(`[data-smart-folder-id="${CSS.escape(state.smartFolderId)}"]`);else if(state.locationId){const row=elements.locationList.querySelector(`.location-item[data-location-id="${CSS.escape(state.locationId)}"]`);target=state.locationSubfolder?row?.querySelector(`[data-subfolder="${CSS.escape(encodeURIComponent(state.locationSubfolder))}"]`):row?.querySelector('.location-root-button');}else target=document.querySelector(`.nav-item[data-view="${CSS.escape(state.view)}"]`);target?.classList.add('active');
}
function renderNavigationDestination(){
  elements.annotationView.classList.add('hidden');
  const generation=++navigationRenderGeneration;paintActiveNavigation();updateSubfolderContentToggle();restoreScopedThumbnailSize();elements.gridWrap.classList.add('navigation-pending');
  if(navigationPaintFrame)cancelAnimationFrame(navigationPaintFrame);
  navigationPaintFrame=requestAnimationFrame(()=>requestAnimationFrame(()=>{if(generation!==navigationRenderGeneration)return;navigationPaintFrame=null;renderGrid();renderInspector();elements.gridWrap.classList.remove('navigation-pending');}));
}
function selectView(view, title, options = {}) {
  if(view==='tags')rememberTemporaryViewOrigin();else if(!['analytics','tags'].includes(view)){navigationReturnState=null;navigationForwardState=null;updateNavigationButtons();}
  hideInternalViewer();
  state.view = view; state.locationId = null; state.collectionId = null; state.smartFolderId = null; state.similarIds = null; state.selectedId = null; state.gridScrollTop = 0; clearSelection(); resetRenderLimit();
  state.duplicateSourceId = view === 'duplicates' ? options.sourceId || null : null;
  if(view==='duplicates'&&state.duplicateSourceId){similarityRefreshGeneration+=1;state.duplicateGroups=[];state.duplicateIds.clear();}
  elements.title.textContent = title; renderNavigationDestination();
  if (view === 'duplicates') refreshSimilarityGroups();
}
async function selectLocation(id, subfolder = '') {
  const location=state.library.locations.find((item)=>item.id===id);if(!location||!(await ensureFolderUnlocked(location,subfolder)))return;
  hideInternalViewer();
  state.view='all';state.locationId = id; state.locationSubfolder = subfolder; state.collectionId = null; state.smartFolderId = null; state.selectedId = null; state.gridScrollTop = 0; clearSelection(); resetRenderLimit();
  elements.title.textContent = subfolder ? subfolder.split('/').pop() : location?.name || 'Location'; renderNavigationDestination();
}
async function selectCollection(id) {
  const collection = (state.library.collections || []).find((item) => item.id === id);
  if (!collection) return;
  hideInternalViewer();
  state.view='all';state.collectionId = id; state.locationId = null;state.locationSubfolder=''; state.smartFolderId = null; state.selectedId = null; state.gridScrollTop = 0; clearSelection(); resetRenderLimit();
  elements.title.textContent = collection.name || 'Folder'; renderNavigationDestination();
}
$('#inline-unlock-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const collection = state.library.collections.find((item) => item.id === state.collectionId); if (!collection?.locked) return;
  const input = $('#inline-unlock-password'), error = $('#inline-unlock-error'); error.textContent = ''; input.disabled = true;
  try { if (!(await window.pigeon.unlockCollection(collection.id, input.value))) { error.textContent = 'Incorrect password. Please try again.'; input.select(); return; } collection.locked = false; input.value = ''; render(); }
  catch (unlockError) { error.textContent = unlockError.message || 'Unable to unlock this collection.'; }
  finally { input.disabled = false; }
});
function selectSmartFolder(id) {
  hideInternalViewer();
  state.view='all';state.smartFolderId = id; state.collectionId = null; state.locationId = null; state.locationSubfolder='';state.similarIds=null;state.selectedId = null;state.kind='all';state.query='';elements.search.value='';Object.values(state.filters).forEach((values)=>values.clear());state.gridScrollTop = 0; clearSelection(); resetRenderLimit();updateFilterChips();
  elements.title.textContent = (state.library.smartFolders || []).find((item) => item.id === id)?.name || 'Smart folder'; renderNavigationDestination();
}
function selectAsset(id) { state.selectedId = id; updateCardSelectionStyles(); renderInspector(); }
function selectAssetWithEvent(id, event) {
  const previousPrimary=state.selectedId;
  if (event.ctrlKey || event.metaKey) {
    if(state.selectedIds.has(id)){state.selectedIds.delete(id);state.selectedId=state.selectedIds.values().next().value||null;}
    else{state.selectedIds.add(id);state.selectedId=id;}
    state.selectionAnchorId=state.selectedId;paintChangedSelectionCards([previousPrimary,id,state.selectedId]);scheduleSelectionInspector();return;
  }
  if (event.shiftKey && state.selectionAnchorId) {
    const visibleIds=filteredAssets().map((asset)=>asset.id),start=visibleIds.indexOf(state.selectionAnchorId),end=visibleIds.indexOf(id),changed=[previousPrimary];
    if(start>=0&&end>=0)for(const selectedId of visibleIds.slice(Math.min(start,end),Math.max(start,end)+1)){if(!state.selectedIds.has(selectedId))changed.push(selectedId);state.selectedIds.add(selectedId);}
    state.selectedId=id;changed.push(id);paintChangedSelectionCards(changed);scheduleSelectionInspector();return;
  }
  const previouslySelected=[...elements.grid.querySelectorAll('.asset-card.selected,.asset-card.multi-selected')].map((card)=>card.dataset.assetId);state.selectedIds=new Set([id]);state.selectedId=id;state.selectionAnchorId=id;paintChangedSelectionCards([...previouslySelected,id]);scheduleSelectionInspector();
}
function successorAfterRemoving(ids){const before=filteredAssets().map((asset)=>asset.id),removed=new Set(ids),positions=ids.map((id)=>before.indexOf(id)).filter((index)=>index>=0);if(!positions.length)return null;const firstIndex=Math.min(...positions),remaining=before.filter((id)=>!removed.has(id)),remainingBefore=before.slice(0,firstIndex).filter((id)=>!removed.has(id)).length;return remaining[Math.min(remainingBefore,remaining.length-1)]||null;}
function selectAndRevealSuccessor(id){if(!id)return;state.postMoveRevealUntil=Date.now()+900;state.selectedId=id;state.selectedIds=new Set([id]);state.selectionAnchorId=id;const index=filteredAssets().findIndex((asset)=>asset.id===id),metrics=state.virtualMetrics;if(metrics&&index>=0){elements.gridWrap.scrollTop=Math.floor(index/metrics.columns)*metrics.estimatedRowHeight;renderGrid();}else updateCardSelectionStyles();renderInspector();focusSelectedAsset({lockScroll:true});}
async function removeSelectedFromCurrentCollection() {
  if (!state.collectionId) return false;
  const collectionId = state.collectionId, ids = [...state.selectedIds].filter((id) => (state.library.assets.find((asset) => asset.id === id)?.collectionIds || []).includes(collectionId));
  if (!ids.length && state.selectedId && (state.library.assets.find((asset) => asset.id === state.selectedId)?.collectionIds || []).includes(collectionId)) ids.push(state.selectedId);
  if (!ids.length) return false;
  const successorId=successorAfterRemoving(ids);
  await window.pigeon.batchUpdateAssets(ids, { removeCollectionId: collectionId });
  for (const asset of state.library.assets) if (ids.includes(asset.id)) asset.collectionIds = (asset.collectionIds || []).filter((id) => id !== collectionId);
  const removedSelected = ids.includes(state.selectedId); clearSelection(); if (removedSelected) state.selectedId = null;
  renderGrid();renderInspector();renderSidebar();selectAndRevealSuccessor(successorId);showToast(`${ids.length} item${ids.length === 1 ? '' : 's'} removed from collection`); return true;
}
function renderBatchBar() {
  elements.batchBar.classList.toggle('hidden', state.selectedIds.size < 2);
  elements.batchCount.textContent = `${state.selectedIds.size} selected`;
}
function currentSmartFolderDependsOnTags(){const folder=state.library.smartFolders?.find((item)=>item.id===state.smartFolderId);return Boolean(folder?.filters?.rules?.some((rule)=>rule.field==='tags'));}
function patchTagMetadataCards(ids=[]){for(const id of ids){const asset=state.library.assets.find((item)=>item.id===id),card=elements.grid.querySelector(`[data-asset-id="${CSS.escape(id)}"]`);if(!asset||!card)continue;card.dataset.tags=(asset.tags||[]).join(' ').toLowerCase();for(const line of card.querySelectorAll('[data-title-field="tags"]'))line.textContent=titleText(asset,'tags');}}
function reconcileThumbnailCards(changedIds=[],{sidebar=true}={}){
  const desired=filteredAssets(),desiredVisible=desired,desiredSet=new Set(desiredVisible.map((asset)=>asset.id)),cards=new Map($$('.asset-card').map((card)=>[card.dataset.assetId,card]));
  for(const [id,card] of cards)if(!desiredSet.has(id)){card.classList.add('asset-card-removing');card.remove();}
  for(const asset of desiredVisible){const card=cards.get(asset.id);if(card&&card.isConnected)elements.grid.appendChild(card);}
  for(const id of changedIds)if(!desiredSet.has(id)){state.selectedIds.delete(id);if(state.selectedId===id)state.selectedId=null;}
  elements.count.textContent=`${desired.length} ${desired.length===1?'item':'items'}`;renderBatchBar();renderInspector();if(sidebar)renderSidebar(false);scheduleMasonry();saveNavigationState();
}
async function addAssetsToCollectionWithoutGridRefresh(ids,collection,sourceCollectionId=null){
  const unique=[...new Set(ids)],changed=[],leavesCurrent=Boolean(sourceCollectionId&&sourceCollectionId===state.collectionId&&sourceCollectionId!==collection.id),successorId=leavesCurrent?successorAfterRemoving(unique):null,operation={collectionId:collection.id,...(sourceCollectionId&&sourceCollectionId!==collection.id?{removeCollectionId:sourceCollectionId}:{})},result=await window.pigeon.batchUpdateAssets(unique,operation,{silent:true,returnAssets:true}),updates=new Map((result.assets||[]).map((asset)=>[asset.id,asset]));
  for(const asset of state.library.assets)if(updates.has(asset.id)){Object.assign(asset,updates.get(asset.id));changed.push(asset.id);}
  reconcileThumbnailCards(changed);if(leavesCurrent)selectAndRevealSuccessor(successorId);showToast(`${unique.length} item${unique.length===1?'':'s'} added to ${collection.name}`);
}
function patchRotatedThumbnail(asset){const card=elements.grid.querySelector(`[data-asset-id="${CSS.escape(asset.id)}"]`),preview=card?.querySelector('.asset-preview'),image=preview?.querySelector(':scope > img');if(!card||!preview||!image)return;const originalRatio=Math.max(.1,(asset.width||1)/(asset.height||1)),quarterTurn=Boolean((Number(asset.rotation)||0)%180),ratio=quarterTurn?1/originalRatio:originalRatio,justifiedHeight=Math.max(52,Math.min(320,Number($('#zoom-slider').value)*.58));card.style.setProperty('--asset-ratio',ratio);card.style.setProperty('--justified-basis',`${Math.round(justifiedHeight*ratio)}px`);preview.style.setProperty('--original-ratio',originalRatio);preview.style.setProperty('--preview-ratio',ratio);preview.classList.toggle('quarter-turned',quarterTurn);image.style.transform=rotationTransform(asset);if(quarterTurn){if(image.complete&&image.naturalWidth)fitRotatedThumbnail(image);else image.addEventListener('load',()=>fitRotatedThumbnail(image),{once:true});}else{preview.style.removeProperty('--rotated-image-width');preview.style.removeProperty('--rotated-image-height');}}
async function rotateThumbnailsWithoutGridRefresh(ids,direction){const result=await window.pigeon.batchUpdateAssets(ids,{rotateBy:direction},{silent:true,returnAssets:true}),updates=new Map((result.assets||[]).map((asset)=>[asset.id,asset]));for(const asset of state.library.assets)if(updates.has(asset.id)){Object.assign(asset,updates.get(asset.id));patchRotatedThumbnail(asset);}scheduleMasonry();scheduleSelectionInspector();if(isInternalViewerOpen())renderInternalViewer();}
function focusSelectedAsset({lockScroll=false}={}){const selectedId=state.selectedId,reveal=()=>{if(state.selectedId!==selectedId)return false;const card=elements.grid.querySelector(`[data-asset-id="${CSS.escape(selectedId)}"]`);if(!card)return false;card.focus({preventScroll:true});card.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});state.gridScrollTop=elements.gridWrap.scrollTop;return true;},delays=lockScroll?[0,60,140,260,480]:[0,90,240];requestAnimationFrame(()=>requestAnimationFrame(()=>{for(const delay of delays)setTimeout(()=>{if(reveal()&&delay===delays.at(-1)){state.postMoveRevealUntil=0;saveNavigationState();}},delay);}));}
function navigateAssets(key) {
  const cards = $$('.asset-card');
  if (!cards.length) return;
  let current = cards.find((card) => card.dataset.assetId === state.selectedId);
  if (!current) {
    state.selectedId = (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'End') ? cards.at(-1).dataset.assetId : cards[0].dataset.assetId;
    state.selectedIds = new Set([state.selectedId]);
    updateCardSelectionStyles(); renderInspector(); focusSelectedAsset(); return;
  }
  const index = cards.indexOf(current);
  let target;
  if (key === 'Home') target = cards[0];
  else if (key === 'End') target = cards.at(-1);
  else if (key === 'ArrowLeft') target = cards[Math.max(0, index - 1)];
  else if (key === 'ArrowRight') target = cards[Math.min(cards.length - 1, index + 1)];
  else {
    const currentRect = current.getBoundingClientRect();
    const currentX = currentRect.left + currentRect.width / 2;
    const currentY = currentRect.top + currentRect.height / 2;
    const direction = key === 'ArrowUp' ? -1 : 1;
    target = cards
      .filter((card) => card !== current)
      .map((card) => {
        const rect = card.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - currentX;
        const dy = rect.top + rect.height / 2 - currentY;
        return { card, dx, dy, score: Math.abs(dy) + Math.abs(dx) * 1.8 };
      })
      .filter((candidate) => candidate.dy * direction > 8)
      .sort((a, b) => a.score - b.score)[0]?.card;
  }
  if (!target || target === current) return;
  state.selectedId = target.dataset.assetId;
  state.selectedIds = new Set([state.selectedId]);
  updateCardSelectionStyles(); renderInspector(); focusSelectedAsset();
}
async function updateSelected(patch) {
  const id=state.selectedId,asset=state.library.assets.find((item)=>item.id===id);if(!asset)return null;
  const previous=Object.fromEntries(Object.keys(patch).map((key)=>[key,asset[key]])),revision=(updateSelected.revisions?.get(id)||0)+1;updateSelected.revisions??=new Map();updateSelected.revisions.set(id,revision);Object.assign(asset,patch);patchCardMetadata(asset,patch);renderInspector();
  try{const updated=await window.pigeon.updateAsset(id,patch);if(!updated)return null;Object.assign(asset,updated);if(updateSelected.revisions.get(id)===revision){patchCardMetadata(asset,patch);renderInspector();}return updated;}
  catch(error){if(updateSelected.revisions.get(id)===revision){Object.assign(asset,previous);patchCardMetadata(asset,patch);renderInspector();}showToast(error.message);return null;}
}
function patchCardMetadata(asset,patch){const card=elements.grid.querySelector(`[data-asset-id="${CSS.escape(asset.id)}"]`);if(Object.hasOwn(patch,'favorite')){const meta=card?.querySelector('.card-meta');card?.querySelector('.card-favorite')?.remove();if(asset.favorite&&meta)meta.insertAdjacentHTML('beforeend','<span class="card-favorite">★</span>');}if(Object.hasOwn(patch,'thumbnailEffect'))card?.classList.toggle('thumbnail-effect-applied',Boolean(asset.thumbnailEffect));}
async function toggleThumbnailEffect(){const ids=isInternalViewerOpen()?[state.viewerAssetId]:state.selectedIds.size?[...state.selectedIds]:state.selectedId?[state.selectedId]:[];if(!ids.length){showToast('Select one or more thumbnails first');return;}const assets=state.library.assets.filter((asset)=>ids.includes(asset.id)),enabled=!assets.every((asset)=>asset.thumbnailEffect),result=await window.pigeon.batchUpdateAssets(ids,{thumbnailEffect:enabled},{silent:true,returnAssets:true}),updates=new Map((result.assets||[]).map((asset)=>[asset.id,asset]));for(const asset of assets){if(updates.has(asset.id))Object.assign(asset,updates.get(asset.id));else asset.thumbnailEffect=enabled;patchCardMetadata(asset,{thumbnailEffect:enabled});}showToast(`${enabled?'Privacy effect applied to':'Privacy effect removed from'} ${ids.length} item${ids.length===1?'':'s'}`);}
function expandedTagTargetIds(seedIds = state.selectedIds) {
  const ids = new Set(seedIds?.size !== undefined ? [...seedIds] : [...(seedIds || [])]);
  if (!ids.size && state.selectedId) ids.add(state.selectedId);
  const stackIds = new Set(state.library.assets.filter((asset) => ids.has(asset.id) && asset.stackId).map((asset) => asset.stackId));
  for (const asset of state.library.assets) if (asset.stackId && stackIds.has(asset.stackId)) ids.add(asset.id);
  return [...ids];
}
async function addTagsToAssets(ids, tags) {
  const targets = [...new Set(ids)], additions = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]; if (!targets.length || !additions.length) return 0;
  const count = await window.pigeon.batchUpdateAssets(targets, { addTags: additions }, { silent: true });
  for (const asset of state.library.assets) if (targets.includes(asset.id)) { const existing = new Map((asset.tags || []).map((tag) => [tag.toLowerCase(), tag])); for (const tag of additions) if (!existing.has(tag.toLowerCase())) existing.set(tag.toLowerCase(), tag); asset.tags = [...existing.values()]; }
  renderInspector(); showToast(`Added ${additions.length} tag${additions.length === 1 ? '' : 's'} to ${count} asset${count === 1 ? '' : 's'}`); return count;
}
function renderIconPicker(query = '') {
  const names = Object.keys(window.PIGEON_ICONS).filter((name) => !query || name.includes(query.toLowerCase())); $('#icon-picker-grid').innerHTML = names.map((name) => `<button data-icon-name="${name}" class="${iconPickerTarget?.current === name ? 'selected' : ''}" title="${name.replace(/-/g,' ')}">${iconSvg(name)}</button>`).join('');
}
function openIconPicker(target) { iconPickerTarget = target; $('#icon-picker-search').value = ''; renderIconPicker(); if (!$('#icon-picker-dialog').open) $('#icon-picker-dialog').showModal(); setTimeout(() => $('#icon-picker-search').focus(), 0); }
async function chooseItemIcon(icon) { if (!iconPickerTarget) return; await window.pigeon.setItemIcon(iconPickerTarget.type, iconPickerTarget.id, icon); if ($('#icon-picker-dialog').open) $('#icon-picker-dialog').close(); iconPickerTarget = null; }
function renderTextEntryTagPills() { const container = $('#text-entry-tag-pills'); container.innerHTML = [...textEntryTagValues.values()].map((tag) => `<button type="button" data-remove-entry-tag="${escapeHtml(tag)}"><span>${escapeHtml(tag)}</span><span>×</span></button>`).join(''); }
function addTextEntryTags(tags) { for (const tag of tags) { const value = String(tag).trim(); if (value && !textEntryTagValues.has(value.toLowerCase())) textEntryTagValues.set(value.toLowerCase(), value); } renderTextEntryTagPills(); }
function requestTagSet({ title, message = '', tags = [], confirmText = 'Save' }) {
  if (textEntryResolve) textEntryResolve(null); textEntryConfirmation = false; textEntryTagMode = true; textEntryTagValues = new Map(tags.map((tag) => [tag.toLowerCase(), tag]));
  const dialog = $('#text-entry-dialog'), input = $('#text-entry-input'); $('#text-entry-title').textContent = title; $('#text-entry-message').textContent = message; $('#text-entry-message').classList.toggle('hidden', !message); $('#text-entry-tag-pills').classList.remove('hidden'); renderTextEntryTagPills(); $('#text-entry-label').textContent = 'Add automatic tags'; $('#text-entry-label').classList.remove('hidden'); input.classList.remove('hidden'); input.type = 'text'; input.value = ''; input.placeholder = 'Type to search or add a tag…'; input.dataset.tagPillEditor = 'true'; input.dataset.tagSuggestOnEmpty = 'false'; enableTagAutocomplete(input, { multiple: true }); hideTagAutocomplete(); $('#confirm-text-entry').textContent = confirmText;
  if (!dialog.open) dialog.showModal(); setTimeout(() => input.focus(), 0); return new Promise((resolve) => { textEntryResolve = resolve; });
}
function requestText({ title, message = '', label = 'Name', value = '', placeholder = '', type = 'text', confirmText = 'OK', tagAutocomplete = null, multipleTags = null }) {
  if (textEntryResolve) textEntryResolve(null); textEntryConfirmation = false; textEntryTagMode = false;
  const dialog = $('#text-entry-dialog'), input = $('#text-entry-input'), useTagAutocomplete = tagAutocomplete ?? /tag/i.test(label); $('#text-entry-title').textContent = title; $('#text-entry-message').textContent = message; $('#text-entry-message').classList.toggle('hidden', !message); $('#text-entry-label').textContent = label; $('#text-entry-label').classList.remove('hidden'); input.classList.remove('hidden'); $('#text-entry-tag-pills').classList.add('hidden'); input.dataset.tagPillEditor = 'false'; input.dataset.tagSuggestOnEmpty = 'true'; input.type = type; input.value = value; input.placeholder = placeholder; $('#confirm-text-entry').textContent = confirmText;
  if (useTagAutocomplete) enableTagAutocomplete(input, { multiple: multipleTags ?? /tags|automatic/i.test(label) }); else { input.dataset.tagAutocomplete = 'false'; input.removeAttribute('aria-controls'); input.removeAttribute('aria-expanded'); hideTagAutocomplete(); }
  if (!dialog.open) dialog.showModal(); setTimeout(() => { input.focus(); input.select(); if (useTagAutocomplete) renderTagAutocomplete(input); }, 0);
  return new Promise((resolve) => { textEntryResolve = resolve; });
}
function requestConfirmation({ title, message, confirmText = 'Confirm' }) {
  if (textEntryResolve) textEntryResolve(null); textEntryConfirmation = true; textEntryTagMode = false; $('#text-entry-tag-pills').classList.add('hidden');
  $('#text-entry-title').textContent = title; $('#text-entry-message').textContent = message; $('#text-entry-message').classList.remove('hidden'); $('#text-entry-label').classList.add('hidden'); $('#text-entry-input').classList.add('hidden'); $('#confirm-text-entry').textContent = confirmText;
  if (!$('#text-entry-dialog').open) $('#text-entry-dialog').showModal(); return new Promise((resolve) => { textEntryResolve = resolve; });
}
function finishTextEntry(confirmed) {
  hideTagAutocomplete(); const resolver = textEntryResolve, confirmation = textEntryConfirmation, tagMode = textEntryTagMode; if (confirmed && tagMode) addTextEntryTags($('#text-entry-input').value.split(',')); const tagResult = [...textEntryTagValues.values()]; textEntryResolve = null; textEntryConfirmation = false; textEntryTagMode = false; if ($('#text-entry-dialog').open) $('#text-entry-dialog').close(); resolver?.(confirmed ? (confirmation ? true : tagMode ? tagResult : $('#text-entry-input').value) : null);
}
async function openAboutDialog() {
  const about=$('#about-dialog'),info=await window.pigeon.getAppInfo();$('#about-version').textContent=`Version ${info.version}`;$('#about-github-icon').innerHTML=iconSvg('github');about.dataset.repository=info.repository;about.classList.remove('hidden');about.focus();
}
function closeAboutView(){const about=$('#about-dialog');if(!about.classList.contains('hidden'))about.classList.add('hidden');}
let portfolioTransferTarget = null, portfolioTransferDestination = null;
function openPortfolioTransfer(target) {
  portfolioTransferTarget = target; portfolioTransferDestination = null; hideInternalViewer();
  const portfolios = (state.library.portfolios || []).filter((item) => item.id !== state.library.activePortfolioId); $('#portfolio-transfer-title').textContent = `Add “${target.name}” to another portfolio`; $('#portfolio-transfer-description').textContent = target.type === 'collection' ? 'Nested collections and all referenced items will be added to the destination.' : 'The indexed folder references will be added without moving original files.';
  $('#portfolio-transfer-list').innerHTML = portfolios.map((portfolio) => `<button type="button" data-transfer-portfolio="${portfolio.id}" role="radio" aria-checked="false"><span class="portfolio-transfer-icon">${iconSvg('portfolio')}</span><span><strong>${escapeHtml(portfolio.name)}</strong><small>Available portfolio</small></span><i>${iconSvg('check')}</i></button>`).join('') || '<div class="portfolio-transfer-empty">Create another portfolio before transferring.</div>';
  $('#portfolio-transfer-move').checked = false; $('#confirm-portfolio-transfer').disabled = true; $('#confirm-portfolio-transfer').textContent = 'Add to Portfolio'; $('#portfolio-transfer').classList.remove('hidden'); elements.grid.classList.add('hidden'); elements.empty.classList.add('hidden');
  $$('[data-transfer-portfolio]').forEach((button) => button.addEventListener('click', () => { portfolioTransferDestination = button.dataset.transferPortfolio; $$('[data-transfer-portfolio]').forEach((item) => { item.classList.toggle('selected', item === button); item.setAttribute('aria-checked', String(item === button)); }); $('#confirm-portfolio-transfer').disabled = false; }));
}
function closePortfolioTransfer() { $('#portfolio-transfer').classList.add('hidden'); portfolioTransferTarget = null; portfolioTransferDestination = null; renderGrid(); }
$('#close-portfolio-transfer').addEventListener('click', closePortfolioTransfer); $('#cancel-portfolio-transfer').addEventListener('click', closePortfolioTransfer);
$('#portfolio-transfer-move').addEventListener('change', (event) => { $('#confirm-portfolio-transfer').textContent = event.target.checked ? 'Move to Portfolio' : 'Add to Portfolio'; });
$('#confirm-portfolio-transfer').addEventListener('click', async () => { if (!portfolioTransferTarget || !portfolioTransferDestination) return; const button = $('#confirm-portfolio-transfer'); button.disabled = true; try { const result = await window.pigeon.transferToPortfolio({ ...portfolioTransferTarget, destinationId: portfolioTransferDestination, move: $('#portfolio-transfer-move').checked }); closePortfolioTransfer(); showToast(`${result.moved ? 'Moved' : 'Added'} ${result.assets} item${result.assets === 1 ? '' : 's'} to ${result.destination}`); } catch (error) { button.disabled = false; showToast(error.message); } });
async function deleteTrashItems(ids=null){const targets=(ids?state.library.assets.filter((asset)=>ids.includes(asset.id)&&asset.deletedAt):state.library.assets.filter((asset)=>asset.deletedAt)),count=targets.length;if(!count){showToast(ids?'Select one or more Trash items':'Trash is already empty');return;}const recycle=preferences.trashDeletionMode==='recycle',confirmed=await requestConfirmation({title:ids?'Delete Selected Trash Items':'Clear Trash',message:recycle?`Move ${count} source file${count===1?'':'s'} to the operating-system Recycle Bin?`:`Permanently delete ${count} source file${count===1?'':'s'}? This cannot be undone.`,confirmText:ids?'Delete Selected':'Clear Trash'});if(!confirmed)return;try{const result=await window.pigeon.emptyTrash(preferences.trashDeletionMode,ids);for(const id of result.deletedIds||[]){state.selectedIds.delete(id);if(state.selectedId===id)state.selectedId=null;}showToast(result.failed?`${result.deleted} deleted · ${result.failed} could not be deleted`:`${result.deleted} trash item${result.deleted===1?'':'s'} deleted`);}catch(error){showToast(error.message);}}
async function clearTrash(){return deleteTrashItems();}
async function handleDeleteSelection(){const ids=state.selectedIds.size?[...state.selectedIds]:state.selectedId?[state.selectedId]:[];if(!ids.length)return;if(state.view==='trash'){await deleteTrashItems(ids);return;}const successorId=successorAfterRemoving(ids),result=await window.pigeon.batchUpdateAssets(ids,{trash:true},{silent:true,returnAssets:true}),updates=new Map((result.assets||[]).map((asset)=>[asset.id,asset]));for(const asset of state.library.assets)if(updates.has(asset.id))Object.assign(asset,updates.get(asset.id));state.selectedIds.clear();state.selectedId=null;state.selectionAnchorId=null;reconcileThumbnailCards(ids);selectAndRevealSuccessor(successorId);showToast(`${ids.length} item${ids.length===1?'':'s'} moved to Trash`);}
function showTrashContextMenu(event){event.preventDefault();closeFloatingMenus();elements.contextMenu.innerHTML=`<button data-trash-action="clear" ${state.library.assets.some((asset)=>asset.deletedAt)?'':'disabled'}>${iconSvg('trash')}<span>Clear Trash…</span></button>`;elements.contextMenu.querySelector('[data-trash-action="clear"]')?.addEventListener('click',()=>{elements.contextMenu.classList.add('hidden');clearTrash();});elements.contextMenu.classList.remove('hidden');positionMenu(elements.contextMenu,event.clientX,event.clientY);}
const primarySidebarItems=[['uncategorized','Uncategorized','showUncategorized'],['untagged','Untagged','showUntagged'],['favorites','Favorites','showFavorites'],['tags','All Tags','showTags'],['duplicates','Duplicates','showDuplicates'],['trash','Trash','showTrash'],['analytics','Analytics','showAnalytics']];
function showPrimarySidebarContextMenu(event,options={}){event.preventDefault();const x=event.clientX,y=event.clientY;closeFloatingMenus();elements.contextMenu.classList.add('sidebar-visibility-menu');const renderMenu=()=>{elements.contextMenu.innerHTML=`${primarySidebarItems.map(([view,label,key])=>`<button data-toggle-sidebar-item="${view}"><span>${label}</span><span class="menu-check">${preferences[key]?'✓':''}</span></button>`).join('')}${options.trash?`<hr><button data-trash-action="clear" ${state.library.assets.some((asset)=>asset.deletedAt)?'':'disabled'}><span>Clear Trash…</span></button>`:''}`;elements.contextMenu.querySelectorAll('[data-toggle-sidebar-item]').forEach((button)=>button.addEventListener('click',(clickEvent)=>{clickEvent.stopPropagation();const item=primarySidebarItems.find(([view])=>view===button.dataset.toggleSidebarItem),key=item[2];preferences[key]=!preferences[key];localStorage.setItem('pigeon.preferences',JSON.stringify(preferences));window.pigeon.updatePreferences(preferences);applyPrimarySidebarVisibility();renderMenu();}));elements.contextMenu.querySelector('[data-trash-action="clear"]')?.addEventListener('click',()=>{elements.contextMenu.classList.add('hidden');elements.contextMenu.classList.remove('sidebar-visibility-menu');clearTrash();});elements.contextMenu.classList.remove('hidden');positionMenu(elements.contextMenu,x,y);};renderMenu();}
function showToast(message) {
  elements.toast.textContent = message; elements.toast.classList.remove('hidden');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => elements.toast.classList.add('hidden'), 2400);
}
function panelWidth(name) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || (name === '--sidebar-width' ? 298 : 298);
}
function setPanelWidth(panel, value, persist = false) {
  const isSidebar = panel === 'sidebar';
  const minimum = isSidebar ? 260 : 220;
  const maximum = Math.min(isSidebar ? 480 : 600, window.innerWidth - (isSidebar ? panelWidth('--inspector-width') : panelWidth('--sidebar-width')) - 340);
  const width = Math.round(Math.max(minimum, Math.min(Math.max(minimum, maximum), value)));
  const property = isSidebar ? '--sidebar-width' : '--inspector-width';
  document.documentElement.style.setProperty(property, `${width}px`);
  $(`#${panel}-resizer`).setAttribute('aria-valuenow', String(width));
  if (persist) localStorage.setItem(`pigeon.${panel}Width`, String(width));
  scheduleMasonry();
  return width;
}
function beginPanelResize(panel, event) {
  event.preventDefault();
  document.body.classList.add('resizing-panel');
  const move = (moveEvent) => setPanelWidth(panel, panel === 'sidebar' ? moveEvent.clientX : window.innerWidth - moveEvent.clientX);
  const stop = (stopEvent) => {
    move(stopEvent); document.body.classList.remove('resizing-panel');
    localStorage.setItem(`pigeon.${panel}Width`, String(Math.round(panelWidth(panel === 'sidebar' ? '--sidebar-width' : '--inspector-width'))));
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', stop);
  };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', stop);
}
function shortcutFromEvent(event) {
  if (['Control', 'Shift', 'Alt', 'Meta', 'Escape', 'Tab'].includes(event.key)) return '';
  const parts = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  const key = event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  parts.push(key); return parts.join('+');
}
const shortcutStepTypes=[['addTags','Add Tags'],['collection','Add to Collection'],['clearCollections','Clear Collections'],['clearTags','Clear Tags'],['rating','Set Rating'],['clearRating','Clear Rating'],['description','Add Description'],['favorite','Set Favourite'],['moveFolder','Move to Folder'],['autoRename','Auto Rename'],['clearInfo','Clear Info']];
let editingShortcutActionId=null;
function persistShortcutActions(){localStorage.setItem('pigeon.shortcutActions',JSON.stringify(shortcutActions));}
function shortcutStepSummary(step){if(step.type==='collection')return state.library.collections?.find((item)=>item.id===step.value)?.name||'Choose collection';if(step.type==='rating')return `${Number(step.value)||0} stars`;if(step.type==='favorite')return step.value==='false'?'Remove favourite':'Mark favourite';if(step.type==='clearCollections')return'All collection memberships';if(step.type==='clearTags')return'All tags';if(step.type==='clearRating')return'Rating';if(step.type==='moveFolder')return step.value||'Ask when action runs';if(step.type==='autoRename')return step.value||'<modified-date-time:YYYYMMDD-HHmmss>';if(step.type==='clearInfo')return 'Tags, rating, description, location and favourite';return step.value||'Configure value';}
const builtInShortcutGroups={File:[['Import folder','Ctrl+O'],['Open with default app','Shift+Enter'],['Reveal in File Explorer','Ctrl+Enter']],Edit:[['Rename','F2'],['Copy selected files','Ctrl+C'],['Paste files','Ctrl+V'],['Duplicate','Ctrl+D'],['Move to Trash','Delete'],['Rebuild thumbnails','Ctrl+Alt+R']],Find:[['Focus search','Ctrl+K'],['Clear filters','Ctrl+Shift+Alt+F'],['Folder filter','Alt+F'],['Tag filter','Alt+T'],['Color filter','Alt+C'],['Shape filter','Alt+S'],['Rating filter','Alt+R'],['Type filter','Alt+E']],Organize:[['Add tags','Ctrl+T'],['Rate','1–5'],['Toggle favourite','Configured above'],['Toggle privacy effect','Configured above']],View:[['All','Ctrl+1'],['Uncategorized','Ctrl+2'],['Untagged','Ctrl+3'],['Recent','Ctrl+4'],['All Tags','Ctrl+6'],['Trash','Ctrl+7'],['Grid layout','Alt+1'],['Justified layout','Alt+2'],['List layout','Alt+4'],['Zoom in','Ctrl+='],['Zoom out','Ctrl+-'],['Actual size','Ctrl+0'],['Scroll to top','Home'],['Scroll to bottom','End'],['Page up','PageUp'],['Page down','PageDown'],['Toggle sidebar','Ctrl+Alt+1'],['Toggle inspector','Ctrl+Alt+2'],['Preview','Space'],['Open selected item','Enter']]};
function renderBuiltInShortcuts(query=''){const target=$('#built-in-shortcut-groups');if(!target)return;const needle=query.trim().toLowerCase();target.innerHTML=Object.entries(builtInShortcutGroups).map(([group,items])=>[group,items.filter(([label,key])=>!needle||`${label} ${key}`.toLowerCase().includes(needle))]).filter(([,items])=>items.length).map(([group,items])=>`<section><h4>${group} <small>${items.length}</small></h4>${items.map(([label,key])=>`<div><span>${label}</span><kbd>${key}</kbd></div>`).join('')}</section>`).join('')||'<div class="shortcut-action-empty">No matching shortcuts.</div>';}
function renderShortcutActions(){const list=$('#shortcut-actions-list');if(!list)return;list.innerHTML=shortcutActions.length?shortcutActions.map((action)=>`<div class="shortcut-action-row" data-shortcut-action="${action.id}"><span><strong>${escapeHtml(action.name)}</strong><small>${escapeHtml((action.steps||[]).map(shortcutStepSummary).join(' → '))}</small></span>${action.shortcut?`<kbd>${escapeHtml(action.shortcut)}</kbd>`:''}<button type="button" data-edit-shortcut-action="${action.id}" title="Edit">✎</button><button type="button" data-remove-shortcut-action="${action.id}" title="Delete">×</button></div>`).join(''):'<div class="shortcut-action-empty">No custom actions yet. Create one to automate the selected thumbnails.</div>';}
function shortcutCollectionOptions(selectedId){const items=state.library.collections||[],children=new Map();for(const item of items){const parent=items.some((entry)=>entry.id===item.parentId)?item.parentId:null;if(!children.has(parent))children.set(parent,[]);children.get(parent).push(item);}for(const siblings of children.values())siblings.sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||a.name.localeCompare(b.name));const options=[];const visit=(parentId,depth,path)=>{for(const item of children.get(parentId)||[]){const nextPath=[...path,item.name],branch=depth?`${'  '.repeat(Math.max(0,depth-1))}└─ `:'';options.push(`<option value="${item.id}" ${selectedId===item.id?'selected':''}>${branch}${escapeHtml(nextPath.join(' › '))}</option>`);visit(item.id,depth+1,nextPath);}};visit(null,0,[]);return options.join('');}
function shortcutStepValueControl(step,index){if(step.type==='collection')return `<select class="shortcut-tree-select" data-shortcut-step-value="${index}" aria-label="Collection tree"><option value="">Choose collection…</option>${shortcutCollectionOptions(step.value)}</select>`;if(step.type==='rating')return `<select data-shortcut-step-value="${index}">${[0,1,2,3,4,5].map((value)=>`<option value="${value}" ${String(step.value)===String(value)?'selected':''}>${value===0?'Clear rating':`${value} star${value===1?'':'s'}`}</option>`).join('')}</select>`;if(step.type==='favorite')return `<select data-shortcut-step-value="${index}"><option value="true" ${step.value!=='false'?'selected':''}>Mark favourite</option><option value="false" ${step.value==='false'?'selected':''}>Remove favourite</option></select>`;if(step.type==='moveFolder')return `<input data-shortcut-step-value="${index}" value="${escapeHtml(step.value||'')}" placeholder="Leave blank to choose a folder when run" />`;if(step.type==='autoRename')return `<span class="rename-pattern-field"><input data-shortcut-step-value="${index}" list="rename-pattern-suggestions" value="${escapeHtml(step.value||'')}" placeholder="<modified-date-time:YYYYMMDD-HHmmss>" /><button type="button" class="pattern-help" title="Tokens: <name>, <extension>, <counter> or <counter:3>, <created-date-time:FORMAT>, <modified-date-time:FORMAT>, <indexed-date-time:FORMAT>. Date parts: YYYY, YY, MM, DD, HH, mm, ss. Combine tokens with ordinary text, hyphens and underscores. Slashes are made filename-safe.">?</button></span>`;if(['clearCollections','clearTags','clearRating','clearInfo'].includes(step.type))return `<input value="${escapeHtml(shortcutStepSummary(step))}" disabled />`;return `<input data-shortcut-step-value="${index}" value="${escapeHtml(step.value||'')}" placeholder="${step.type==='addTags'?'Comma-separated tags':'Description'}" />`;}
function renderShortcutActionSteps(steps){$('#shortcut-action-steps').innerHTML=steps.map((step,index)=>`<div class="shortcut-step" data-shortcut-step="${index}" draggable="true"><span class="shortcut-step-grip" title="Drag to reorder">⋮⋮</span><select data-shortcut-step-type="${index}">${shortcutStepTypes.map(([value,label])=>`<option value="${value}" ${step.type===value?'selected':''}>${label}</option>`).join('')}</select>${shortcutStepValueControl(step,index)}<button type="button" data-remove-shortcut-step="${index}" title="Remove step">×</button></div>`).join('');wireShortcutStepReordering();}
function readShortcutActionSteps(){return $$('.shortcut-step').map((row)=>({type:row.querySelector('[data-shortcut-step-type]').value,value:row.querySelector('[data-shortcut-step-value]')?.value||''}));}
function openShortcutActionDialog(action=null){editingShortcutActionId=action?.id||null;$('#shortcut-action-title').textContent=action?'Edit Action':'Create Action';$('#shortcut-action-name').value=action?.name||'';$('#shortcut-action-key').value=action?.shortcut||'';$('#save-shortcut-action').textContent=action?'Save Action':'Create Action';renderShortcutActionSteps(action?.steps?.map((step)=>({...step}))||[]);if(!$('#shortcut-action-dialog').open)$('#shortcut-action-dialog').showModal();setTimeout(()=>$('#shortcut-action-name').focus(),0);}
function closeShortcutActionDialog(){if($('#shortcut-action-dialog').open)$('#shortcut-action-dialog').close();editingShortcutActionId=null;}
function operationForShortcutStep(step){if(step.type==='addTags')return{addTags:String(step.value).split(',').map((tag)=>tag.trim()).filter(Boolean)};if(step.type==='collection')return{collectionId:step.value};if(step.type==='clearCollections')return{clearCollections:true};if(step.type==='clearTags')return{clearTags:true};if(step.type==='rating')return{rating:Number(step.value)||0};if(step.type==='clearRating')return{clearRating:true};if(step.type==='description')return{note:step.value};if(step.type==='favorite')return{favorite:step.value!=='false'};if(step.type==='clearInfo')return{clearInfo:true};return{};}
function wireShortcutStepReordering(){let source=null;$$('.shortcut-step').forEach((row)=>{row.addEventListener('dragstart',(event)=>{source=Number(row.dataset.shortcutStep);event.dataTransfer.effectAllowed='move';row.classList.add('dragging');});row.addEventListener('dragover',(event)=>{event.preventDefault();row.classList.add('step-drop-target');});row.addEventListener('dragleave',()=>row.classList.remove('step-drop-target'));row.addEventListener('dragend',()=>{$$('.shortcut-step').forEach((item)=>item.classList.remove('dragging','step-drop-target'));});row.addEventListener('drop',(event)=>{event.preventDefault();const target=Number(row.dataset.shortcutStep),steps=readShortcutActionSteps();if(!Number.isInteger(source)||source===target)return;const[moved]=steps.splice(source,1);steps.splice(target,0,moved);renderShortcutActionSteps(steps);});});}
async function runShortcutAction(action){const ids=isInternalViewerOpen()?[state.viewerAssetId]:state.selectedIds.size?[...state.selectedIds]:state.selectedId?[state.selectedId]:[];if(!ids.length){showToast('Select one or more thumbnails first');return;}let result;for(let index=0;index<(action.steps||[]).length;index++){const step=action.steps[index];if(step.type==='moveFolder')result=await window.pigeon.moveAssetsToPath(ids,step.value);else if(step.type==='autoRename')result=await window.pigeon.autoRenameAssets(ids,step.value||'<modified-date-time:YYYYMMDD-HHmmss>');else result=await window.pigeon.batchUpdateAssets(ids,operationForShortcutStep(step),{silent:true,returnAssets:index===action.steps.length-1});}const updates=new Map((result?.assets||[]).map((asset)=>[asset.id,asset]));for(const asset of state.library.assets)if(updates.has(asset.id))Object.assign(asset,updates.get(asset.id));reconcileThumbnailCards(ids);showToast(`${action.name} applied to ${ids.length} item${ids.length===1?'':'s'}`);}
function renderPortfolioManager() {
  const select = $('#portfolio-select');
  select.innerHTML = (state.library.portfolios || []).map((portfolio) => `<option value="${portfolio.id}" ${portfolio.id === state.library.activePortfolioId ? 'selected' : ''}>${escapeHtml(portfolio.name)}</option>`).join('');
}
function renderPortfolioSwitcher(filter = '') {
  const query = filter.trim().toLowerCase(), portfolios = (state.library.portfolios || []).filter((portfolio) => !query || portfolio.name.toLowerCase().includes(query));
  $('#portfolio-switcher-list').innerHTML = portfolios.length ? portfolios.map((portfolio) => `<button class="portfolio-switcher-item ${portfolio.id === state.library.activePortfolioId ? 'active' : ''}" role="option" aria-selected="${portfolio.id === state.library.activePortfolioId}" data-portfolio-id="${portfolio.id}"><span class="portfolio-switcher-icon">▱</span><span class="portfolio-switcher-name">${escapeHtml(portfolio.name)}</span><span class="portfolio-switcher-check">${portfolio.id === state.library.activePortfolioId ? '✓' : ''}</span></button>`).join('') : '<div class="portfolio-switcher-empty">No matching portfolios</div>';
}
function closePortfolioSwitcher() { $('#portfolio-switcher').classList.add('hidden'); $('.brand-menu').setAttribute('aria-expanded', 'false'); }
async function switchPortfolioTo(id) {
  if (!id || id === state.library.activePortfolioId) { closePortfolioSwitcher(); return; }
  try { saveNavigationState(); closePortfolioSwitcher(); await window.pigeon.switchPortfolio(id); showToast('Portfolio switched'); } catch (error) { showToast(error.message); }
}
function validTreeColor(value){return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):'#cbd0d8';}
function treeLevelColor(depth){const colors=Array.isArray(preferences.treeLevelColors)&&preferences.treeLevelColors.length?preferences.treeLevelColors:defaultTreeLevelColors;return validTreeColor(colors[Math.max(0,Number(depth)||0)%colors.length]);}
function applyThumbnailEffectPreferences(){const mode=preferences.thumbnailEffectMode==='pixelate'?'pixelate':'blur',minimum=mode==='pixelate'?30:8,maximum=mode==='pixelate'?500:40,fallback=mode==='pixelate'?50:12,strength=Math.max(minimum,Math.min(maximum,Number(preferences.thumbnailEffectStrength)||fallback)),slider=$('#thumbnail-effect-strength');preferences.thumbnailEffectStrength=strength;preferences.thumbnailEffectMode=mode;if(slider){slider.min=String(minimum);slider.max=String(maximum);slider.value=String(strength);}document.documentElement.style.setProperty('--thumbnail-effect-strength',String(strength));document.body.dataset.thumbnailEffectMode=mode;const preview=$('#blur-effect-preview');if(preview){preview.dataset.mode=mode;preview.style.setProperty('--preview-effect-strength',String(strength));$('#thumbnail-effect-strength-value').textContent=String(strength);}}
function applyTreeLevelColors(){preferences.treeLevelColors=(Array.isArray(preferences.treeLevelColors)?preferences.treeLevelColors:defaultTreeLevelColors).map(validTreeColor);if(!preferences.treeLevelColors.length)preferences.treeLevelColors=[defaultTreeLevelColors[0]];preferences.treeLevelColors.forEach((color,index)=>document.documentElement.style.setProperty(`--tree-level-${index}`,color));}
function renderTreeLevelColorSettings(){const list=$('#tree-level-colors');if(!list)return;list.innerHTML=preferences.treeLevelColors.map((color,index)=>`<div class="tree-level-color" data-tree-level-color="${index}"><span>Level ${index+1}</span><input type="color" value="${validTreeColor(color)}" aria-label="Level ${index+1} color" /><code>${validTreeColor(color)}</code><button type="button" data-delete-tree-level="${index}" title="Delete level" ${preferences.treeLevelColors.length===1?'disabled':''}>×</button></div>`).join('');}
function renderThumbnailTitleSettings() {
  const options = [['none', 'Hidden'], ['name', 'Name (without extension)'], ['filename', 'Filename'], ['dimensions', 'Dimensions'], ['type', 'File type'], ['size', 'File size'], ['rating', 'Rating'], ['date', 'Modified date'], ['folder', 'Containing folder'], ['tags', 'Tags']];
  state.thumbnailTitleLines.forEach((selected, index) => { const select = $(`#thumbnail-title-line-${index + 1}`); select.innerHTML = options.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join(''); });
}
function populatePreferenceInputs() {
  $$('[data-pref]').forEach((input) => { const value = preferences[input.dataset.pref]; if (input.type === 'checkbox' || input.type === 'radio') input.checked = input.type === 'radio' ? String(value) === input.value : Boolean(value); else input.value = String(value); });
  $('#auto-import-folder').textContent = preferences.autoImportFolder || 'Not configured';
  let token = localStorage.getItem('pigeon.developerToken'); if (!token) { token = crypto.randomUUID().replace(/-/g, ''); localStorage.setItem('pigeon.developerToken', token); } $('#developer-token').value = token;
}
function collectPreferenceInputs() {
  $$('[data-pref]').forEach((input) => { if (input.type === 'radio' && !input.checked) return; preferences[input.dataset.pref] = input.type === 'checkbox' ? input.checked : input.type === 'number' || input.dataset.pref === 'interfaceZoom' ? Number(input.value) : input.value; });
}
function safeFontFamily(value, fallback) { const candidate = String(value || '').trim(); return candidate && !/[;{}]/.test(candidate) ? candidate : fallback; }
function applyTypographyPreferences() { const root = document.documentElement.style; root.setProperty('--app-font-family', safeFontFamily(preferences.appFontFamily, preferenceDefaults.appFontFamily)); root.setProperty('--app-font-size', `${Math.max(8,Math.min(24,Number(preferences.appFontSize)||11))}px`); root.setProperty('--console-font-family', safeFontFamily(preferences.consoleFontFamily, preferenceDefaults.consoleFontFamily)); root.setProperty('--console-font-size', `${Math.max(8,Math.min(24,Number(preferences.consoleFontSize)||10))}px`); }
function applyPrimarySidebarVisibility(){const visibility={uncategorized:preferences.showUncategorized,untagged:preferences.showUntagged,favorites:preferences.showFavorites,tags:preferences.showTags,duplicates:preferences.showDuplicates,trash:preferences.showTrash,analytics:preferences.showAnalytics};for(const[view,visible]of Object.entries(visibility))document.querySelector(`[data-view="${view}"]`)?.classList.toggle('preference-hidden',!visible);}
function applyPreferences(save = false) {
  collectPreferenceInputs(); applyTypographyPreferences(); applyTreeLevelColors(); applyThumbnailEffectPreferences(); document.documentElement.dataset.theme = preferences.theme; document.body.classList.toggle('no-transparency', !preferences.transparency); document.body.classList.toggle('pixelated-previews', preferences.imageRendering === 'pixelated'); document.body.classList.toggle('transparency-grid', preferences.transparentGrid); document.body.classList.toggle('hover-zoom-enabled', preferences.hoverZoom); document.body.classList.toggle('hide-sidebar-counts', !preferences.showCounts); document.body.classList.toggle('colored-tree-levels', preferences.coloredTreeLevels !== false);
  applyPrimarySidebarVisibility();
  document.querySelector('[data-section-toggle="smart-folders"]')?.classList.toggle('preference-hidden', !preferences.showSmartFolders); $('#sidebar-section-smart-folders').classList.toggle('preference-hidden', !preferences.showSmartFolders); document.querySelector('[data-section-toggle="collections"]')?.classList.toggle('preference-hidden', !preferences.showCollections); $('#sidebar-section-collections').classList.toggle('preference-hidden', !preferences.showCollections); document.querySelector('[data-section-toggle="indexed-locations"]')?.classList.toggle('preference-hidden', !preferences.showLocations); $('#sidebar-section-indexed-locations').classList.toggle('preference-hidden', !preferences.showLocations);
  state.viewerFit = preferences.defaultImageSize !== 'original'; applyWindowZoom(preferences.interfaceZoom); if (save) { if (preferences.videoAutoplay) localStorage.setItem('pigeon.videoAutoplayOptIn', 'true'); else localStorage.removeItem('pigeon.videoAutoplayOptIn'); localStorage.setItem('pigeon.preferences', JSON.stringify(preferences)); window.pigeon.updatePreferences(preferences); showToast('Preferences saved'); }
}
function openSettings() {
  renderPortfolioManager(); renderThumbnailTitleSettings(); populatePreferenceInputs(); renderTreeLevelColorSettings();
  $('#favorite-shortcut').value = state.favoriteShortcut;
  $('#location-shortcut').value = state.locationShortcut;
  $('#thumbnail-effect-shortcut').value=state.thumbnailEffectShortcut;
  $('#thumbnail-effect-reveal-shortcut').value=preferences.thumbnailEffectRevealKey==='Control'?'Ctrl':preferences.thumbnailEffectRevealKey||'Alt';
  renderBuiltInShortcuts();renderShortcutActions();
  $('#encrypt-locked-folders').checked = state.encryptLockedFolders;
  $('#confirm-folder-moves').checked = state.confirmFolderMoves;
  if (!$('#settings-dialog').open) $('#settings-dialog').showModal();
  setTimeout(() => $('#preferences-search').focus(), 0);
}
async function toggleSelectedFavourite() {
  if (isInternalViewerOpen()) state.selectedId = state.viewerAssetId;
  const asset = state.library.assets.find((item) => item.id === state.selectedId);
  if (!asset || !['image', 'video'].includes(asset.kind)) return;
  await updateSelected({ favorite: !asset.favorite });
  showToast(asset.favorite ? 'Added to favourites' : 'Removed from favourites');
}
async function applyWindowZoom(value, announce = true) {
  state.uiZoom = await window.pigeon.setWindowZoom(Math.round(Math.max(.6, Math.min(2, value)) * 10) / 10);
  localStorage.setItem('pigeon.windowZoom', String(state.uiZoom));
  setPanelWidth('sidebar', panelWidth('--sidebar-width'), true);
  setPanelWidth('inspector', panelWidth('--inspector-width'), true);
  if (announce) showToast(`Interface zoom · ${Math.round(state.uiZoom * 100)}%`);
}

async function addFolder() { elements.addMenu.classList.add('hidden'); await window.pigeon.addFolder(); }
async function addDefaultPictures(){elements.addMenu.classList.add('hidden');await window.pigeon.addDefaultPictures();}
async function addFiles() { elements.addMenu.classList.add('hidden'); await window.pigeon.addFiles(); }

function countValues(values) {
  const counts = new Map();
  values.forEach((value) => { if (value !== null && value !== undefined && value !== '') counts.set(value, (counts.get(value) || 0) + 1); });
  return counts;
}

function facetOptions(facet) {
  const assets = state.library.assets;
  if (facet === 'types') return [...countValues(assets.map((asset) => asset.extension.toLowerCase()))].sort((a, b) => a[0].localeCompare(b[0]));
  if (facet === 'rating') {
    const counts = countValues(assets.map((asset) => asset.rating || 0));
    return [[5, counts.get(5) || 0], [4, counts.get(4) || 0], [3, counts.get(3) || 0], [2, counts.get(2) || 0], [1, counts.get(1) || 0], [0, counts.get(0) || 0]];
  }
  if (facet === 'shape') {
    const counts = countValues(assets.filter((asset) => asset.kind === 'image').map(shapeFor));
    return [['horizontal', counts.get('horizontal') || 0], ['vertical', counts.get('vertical') || 0], ['square', counts.get('square') || 0], ['panoramic', counts.get('panoramic') || 0], ['tall', counts.get('tall') || 0]];
  }
  if (facet === 'folder') return state.library.locations.map((location) => [location.id, location.assetCount || 0, location.name]);
  if (facet === 'tags') return [...countValues(assets.flatMap((asset) => asset.tags || []))].sort((a, b) => a[0].localeCompare(b[0]));
  return [];
}

function facetLabel(facet, value, customLabel) {
  if (customLabel) return customLabel;
  if (facet === 'rating') return value === 0 ? 'None' : `${'★'.repeat(value)}${'☆'.repeat(5 - value)}`;
  if (facet === 'shape') return ({ horizontal: 'Horizontal', vertical: 'Vertical', square: 'Square', panoramic: 'Panoramic horizontal', tall: 'Panoramic vertical' })[value];
  return String(value);
}

function updateFilterChips() {
  $$('.filter-chip[data-facet]').forEach((button) => {
    const key = ({ types: 'extensions', folder: 'locations', rating: 'ratings', shape: 'shapes', color: 'colors' })[button.dataset.facet] || button.dataset.facet;
    button.classList.toggle('has-selection', (state.filters[key]?.size || 0) > 0);
  });
}

function positionMenu(menu, anchor, pointerY) {
  const rect = typeof anchor === 'number'
    ? { left: anchor, bottom: Number(pointerY) || 0 }
    : anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(rect.bottom + (typeof anchor === 'number' ? 0 : 3), window.innerHeight - menu.offsetHeight - 8))}px`;
}

function renderFacetPopover(facet, anchor, search = '') {
  state.openFacet = facet;
  const key = ({ types: 'extensions', folder: 'locations', rating: 'ratings', shape: 'shapes', color: 'colors' })[facet] || facet;
  const selected = state.filters[key] || (state.filters[key] = new Set());
  if (facet === 'color') {
    const colors = ['#222222', '#777777', '#eeeeee', '#df3838', '#e4933d', '#e4c33c', '#49a96f', '#45a9aa', '#417bd5', '#7855cb', '#c85e91', '#9a7254'];
    const currentColor = [...selected][0] || '#4f83d1';
    elements.facetPopover.innerHTML = `<div class="facet-title">Dominant color</div><label class="color-spectrum" title="Choose any color"><input type="color" value="${currentColor}" /><span></span></label><div class="color-palette">${colors.map((color) => `<button class="color-swatch ${selected.has(color) ? 'selected' : ''}" style="--swatch:${color}" data-color="${color}" title="${color}"></button>`).join('')}</div><div class="custom-color"><span class="selected-color-dot" style="--swatch:${currentColor}"></span><code>${currentColor}</code><span class="color-wheel">●</span></div><div class="facet-footer">Choose one or more visually similar colors</div>`;
    elements.facetPopover.querySelectorAll('[data-color]').forEach((swatch) => swatch.addEventListener('click', () => {
      selected.has(swatch.dataset.color) ? selected.delete(swatch.dataset.color) : selected.add(swatch.dataset.color);
      updateFilterChips(); renderGrid(); renderFacetPopover(facet, anchor);
    }));
    elements.facetPopover.querySelector('input[type="color"]').addEventListener('change', (event) => {
      selected.add(event.target.value); updateFilterChips(); renderGrid(); renderFacetPopover(facet, anchor);
    });
  } else {
    const options = facetOptions(facet).filter(([value,, label]) => `${label || value}`.toLowerCase().includes(search.toLowerCase()));
    elements.facetPopover.innerHTML = `<input class="facet-search" type="search" placeholder="Search ${facet}" value="${escapeHtml(search)}" /><div class="facet-title">${escapeHtml(facet)}</div>${options.length ? options.map(([value, count, label]) => `<button class="facet-option ${selected.has(value) ? 'selected' : ''}" data-value="${escapeHtml(value)}"><span class="facet-check">${selected.has(value) ? '✓' : ''}</span><span>${escapeHtml(facetLabel(facet, value, label))}</span><small>${count}</small></button>`).join('') : '<div class="facet-empty">No matching options</div>'}<div class="facet-footer">Select multiple options to broaden this filter</div>`;
    elements.facetPopover.querySelector('.facet-search').addEventListener('input', (event) => renderFacetPopover(facet, anchor, event.target.value));
    elements.facetPopover.querySelectorAll('[data-value]').forEach((option) => option.addEventListener('click', () => {
      const value = facet === 'rating' ? Number(option.dataset.value) : option.dataset.value;
      selected.has(value) ? selected.delete(value) : selected.add(value);
      updateFilterChips(); renderGrid(); renderFacetPopover(facet, anchor, search);
    }));
  }
  elements.facetPopover.classList.remove('hidden');
  positionMenu(elements.facetPopover, anchor);
  if (search) { const input = elements.facetPopover.querySelector('.facet-search'); input?.focus(); input?.setSelectionRange(search.length, search.length); }
}

function hideContextMenu() { elements.contextMenu.classList.add('hidden');elements.contextMenu.classList.remove('asset-context-menu-expanded');$('#sidebar-order-submenu')?.classList.add('hidden'); }
function closeFloatingMenus() {
  elements.facetPopover.classList.add('hidden');
  elements.appMenu.classList.add('hidden');
  elements.appSubmenu.classList.add('hidden');
  elements.contextMenu.classList.add('hidden');
  state.openFacet = null;
}

async function executeMenuAction(action) {
  if (action === 'add-folder') await addFolder();
  if (action === 'add-files') await addFiles();
  if (action === 'rescan') { showToast('Rescanning indexed locations…'); await window.pigeon.rescan(state.locationId); }
  if (action === 'open' && state.selectedId) openInternalViewer(state.selectedId);
  if (action === 'open-default' && state.selectedId) await window.pigeon.openAsset(state.selectedId);
  if (action === 'open-with' && state.selectedId) await window.pigeon.openAssetWith(state.selectedId);
  if (action === 'reveal' && state.selectedId) window.pigeon.revealAsset(state.selectedId);
  if (action === 'favorite' && state.selectedId) {
    const asset = state.library.assets.find((item) => item.id === state.selectedId);
    if (asset) await window.pigeon.updateAsset(asset.id, { favorite: !asset.favorite });
  }
  if (action === 'clear-filters') $('#clear-filters').click();
  if (action === 'import-url') { const url = await requestText({ title: 'Import from URL', label: 'Image or video URL', placeholder: 'https://', confirmText: 'Import' }); if (url) { showToast('Downloading…'); await window.pigeon.importUrl(url); } }
  if (action === 'import-clipboard') await window.pigeon.importClipboard();
  if (action === 'capture-screen') { await window.pigeon.captureScreen(); if (preferences.screenshotNotify) showToast('Screenshot captured'); }
  if (action === 'backup') { const target = await window.pigeon.backupLibrary(); showToast(`Backup saved · ${target}`); }
  if (action === 'restore-backup') await window.pigeon.restoreBackup();
  if (action === 'configure-sync') { const folder = await window.pigeon.configureSync(); if (folder) showToast(`Sync folder · ${folder}`); }
  if (action === 'sync-now') { const target = await window.pigeon.syncNow(); showToast(`Synced · ${target}`); }
  if (action === 'empty-trash') await clearTrash();
  if (action === 'rename-tag') { const from = await requestText({ title: 'Rename Tag', label: 'Existing tag', confirmText: 'Continue' }); const to = from && await requestText({ title: 'Rename Tag', label: 'New tag name', value: from, confirmText: 'Rename' }); if (from && to) await window.pigeon.renameTag(from, to); }
  if (action === 'delete-tag') { const tag = await requestText({ title: 'Delete Tag', label: 'Tag to remove', confirmText: 'Continue' }); if (tag && await requestConfirmation({ title: 'Delete Tag', message: `Remove “${tag}” everywhere?`, confirmText: 'Delete' })) await window.pigeon.deleteTag(tag); }
  if (action === 'open-extension') await window.pigeon.openBrowserExtensionFolder();
  if (action === 'open-plugins') await window.pigeon.openPluginsFolder();
  if (action === 'run-plugin') { const plugins = await window.pigeon.listPlugins(); const name = await requestText({ title: 'Run Plugin', message: `Installed: ${plugins.join(', ') || 'none'}`, label: 'Plugin name', confirmText: 'Run' }); if (name) { const result = await window.pigeon.runPlugin(name); showToast(result.error || `Plugin completed · ${(result.operations || []).length} operations`); } }
  if (action === 'focus-search') elements.search.focus();
  if (action === 'show-tags') renderFacetPopover('tags', $('[data-facet="tags"]'));
  if (action === 'show-folders') renderFacetPopover('folder', $('[data-facet="folder"]'));
  if (action === 'toggle-filters') $('#filter-bar').classList.toggle('hidden');
  if (action === 'toggle-inspector') { elements.inspector.classList.toggle('hidden-panel'); $('#inspector-toggle').classList.toggle('selected'); }
  if (action === 'toggle-layout') $('#layout-button').click();
  if (action === 'settings') openSettings();
  if (action === 'about') openAboutDialog();
  if (action === 'diagnostics') openDiagnosticsConsole();
  if (action === 'check-updates') { showToast('Checking GitHub for updates…'); try { const result = await window.pigeon.checkForUpdates(); if (result.status === 'current') showToast(`Pigeon ${result.currentVersion} is up to date`); if (result.status === 'development') showToast('Update checks are available in packaged builds'); } catch (error) { showToast(`Update check failed · ${error.message}`); } }
  if (action === 'plugins') await window.pigeon.openPluginsFolder();
  if (action === 'quit') window.pigeon.closeWindow();
}

function showAppSubmenu(group, anchor) {
  const groups = {
    library: [['Index folder…', 'add-folder', '⌘O'], ['Add files…', 'add-files', ''], ['Import URL…', 'import-url', ''], ['Import clipboard URL', 'import-clipboard', ''], ['Capture screen', 'capture-screen', ''], ['Rescan portfolio', 'rescan', '↻'], ['Backup now', 'backup', ''], ['Restore backup…', 'restore-backup', ''], ['Choose sync folder…', 'configure-sync', ''], ['Sync now', 'sync-now', '']],
    file: [['Open in Pigeon', 'open', 'Enter'], ['Open with default app', 'open-default', ''], ['Open with…', 'open-with', ''], ['Reveal in folder', 'reveal', '']],
    edit: [['Toggle favorite', 'favorite', ''], ['Clear filters', 'clear-filters', ''], ['Empty trash…', 'empty-trash', '']],
    find: [['Search portfolio', 'focus-search', '⌘K'], ['Tag filter', 'show-tags', ''], ['Folder filter', 'show-folders', '']],
    organize: [['Tags', 'show-tags', ''], ['Rename tag…', 'rename-tag', ''], ['Delete tag…', 'delete-tag', ''], ['Folders', 'show-folders', ''], ['Clear filters', 'clear-filters', '']],
    view: [['Show filters', 'toggle-filters', ''], ['Toggle inspector', 'toggle-inspector', ''], ['Toggle grid/list', 'toggle-layout', '']],
    actions: [['Rescan sources', 'rescan', ''], ['Open selected', 'open', '']],
    plugin: [['Open browser extension folder', 'open-extension', ''], ['Open plugins folder', 'open-plugins', ''], ['Run plugin…', 'run-plugin', '']],
    help: [['Check for Updates…', 'check-updates', ''], ['Diagnostics Console', 'diagnostics', 'Ctrl+Shift+J'], ['About Pigeon', 'about', '']]
  };
  elements.appSubmenu.innerHTML = (groups[group] || []).map(([label, action, shortcut]) => `<button data-menu-action="${action}"><span>${escapeHtml(label)}</span>${shortcut ? `<kbd>${escapeHtml(shortcut)}</kbd>` : ''}</button>`).join('');
  elements.appSubmenu.querySelectorAll('[data-menu-action]').forEach((button) => button.addEventListener('click', async () => {
    const action = button.dataset.menuAction;
    elements.appMenu.classList.add('hidden'); elements.appSubmenu.classList.add('hidden');
    await executeMenuAction(action);
    if (action !== 'show-tags' && action !== 'show-folders') closeFloatingMenus();
  }));
  elements.appSubmenu.classList.remove('hidden');
  const rect = anchor.getBoundingClientRect();
  elements.appSubmenu.style.left = `${Math.min(rect.right - 2, window.innerWidth - elements.appSubmenu.offsetWidth - 8)}px`;
  elements.appSubmenu.style.top = `${Math.max(8, Math.min(rect.top - 6, window.innerHeight - elements.appSubmenu.offsetHeight - 8))}px`;
}

function isInternalViewerOpen() { return !elements.mediaViewer.classList.contains('hidden'); }
function viewerSourceSize(){const asset=state.library.assets.find((item)=>item.id===state.viewerAssetId),quarter=Boolean((Number(asset?.rotation)||0)%180),width=elements.viewerImage.naturalWidth||asset?.width||1,height=elements.viewerImage.naturalHeight||asset?.height||1;return quarter?{width:height,height:width,sourceWidth:width,sourceHeight:height}:{width,height,sourceWidth:width,sourceHeight:height};}
function viewerFitScale(){const stage=$('.viewer-stage'),size=viewerSourceSize();return Math.min(stage.clientWidth/Math.max(size.width,1),stage.clientHeight/Math.max(size.height,1))*.98;}
function applyViewerImageFit() {const image=elements.viewerImage,asset=state.library.assets.find((item)=>item.id===state.viewerAssetId);if(!asset||asset.kind!=='image'||image.classList.contains('hidden'))return;const size=viewerSourceSize(),scale=state.viewerFit?viewerFitScale():state.viewerZoom;image.style.width=`${Math.max(1,size.sourceWidth*scale)}px`;image.style.height=`${Math.max(1,size.sourceHeight*scale)}px`;image.style.maxWidth='none';image.style.maxHeight='none';}
function viewerImageContentRect() {
  const stage = $('.viewer-stage');
  const asset = state.library.assets.find((item) => item.id === state.viewerAssetId);
  if (!asset || !stage.clientWidth || !stage.clientHeight) return { left: 0, top: 0, width: stage.clientWidth, height: stage.clientHeight };
  let width = asset.width || elements.viewerImage.naturalWidth || 1, height = asset.height || elements.viewerImage.naturalHeight || 1;
  if ((asset.rotation || 0) % 180) [width, height] = [height, width];
  const scale = Math.min(stage.clientWidth / width, stage.clientHeight / height);
  const renderedWidth = width * scale, renderedHeight = height * scale;
  return { left: (stage.clientWidth - renderedWidth) / 2, top: (stage.clientHeight - renderedHeight) / 2, width: renderedWidth, height: renderedHeight };
}
function updateViewerCropOverlay() {
  if (!state.viewerCropMode || !state.viewerCrop) return;
  const content = viewerImageContentRect(), crop = state.viewerCrop;
  Object.assign($('#viewer-crop-overlay').style, { left: `${content.left + crop.x * content.width}px`, top: `${content.top + crop.y * content.height}px`, width: `${crop.width * content.width}px`, height: `${crop.height * content.height}px` });
}
function cancelViewerCrop() {
  state.viewerCropMode = false; state.viewerCrop = null; viewerCropDrag = null;
  elements.mediaViewer.classList.remove('crop-mode'); $('#viewer-crop-overlay').classList.add('hidden');

}
function beginViewerCrop() {
  if (state.viewerCropMode) { applyViewerCrop(); return; }
  const asset = state.library.assets.find((item) => item.id === state.viewerAssetId);
  if (!asset || asset.kind !== 'image') return;
  state.viewerFit = true; state.viewerCropMode = true; state.viewerCrop = { x: .08, y: .08, width: .84, height: .84 };
  renderInternalViewer(); elements.mediaViewer.classList.add('crop-mode'); $('#viewer-crop-overlay').classList.remove('hidden');
  requestAnimationFrame(updateViewerCropOverlay);
}
async function applyViewerCrop() {
  if (!state.viewerCropMode || !state.viewerCrop) return;
  const id = state.viewerAssetId, crop = { ...state.viewerCrop };

  try {
    const updated = await window.pigeon.applyInlineCrop(id, crop);
    const asset = state.library.assets.find((item) => item.id === id); if (asset) Object.assign(asset, updated);
    elements.viewerImage.src = protectedUrl(updated.mediaUrl);
    cancelViewerCrop(); renderGrid(); renderInspector(); if (state.viewerAssetId === id && isInternalViewerOpen()) renderInternalViewer(); showToast('Crop applied non-destructively');
  } catch (error) { showToast(error.message); }
}
function updateViewerMinimap() {
  const stage = $('.viewer-stage');
  if (elements.viewerMinimap.classList.contains('hidden')) return;
  const width = Math.min(100, stage.clientWidth / Math.max(stage.scrollWidth, 1) * 100);
  const height = Math.min(100, stage.clientHeight / Math.max(stage.scrollHeight, 1) * 100);
  const left = stage.scrollLeft / Math.max(stage.scrollWidth, 1) * 100;
  const top = stage.scrollTop / Math.max(stage.scrollHeight, 1) * 100;
  Object.assign(elements.viewerMinimapViewport.style, { width: `${width}%`, height: `${height}%`, left: `${left}%`, top: `${top}%` });
}
let viewerVideoLoadTimer = null;
function setViewerVideoStatus(visible, message = 'Preparing compatibility playback…') { const status = $('#viewer-video-status'); status.querySelector('strong').textContent = message; status.classList.toggle('hidden', !visible); }
function recoverViewerVideo(id, reason = 'codec') {
  const asset = state.library.assets.find((item) => item.id === id); if (!id || !asset || elements.viewerVideo.dataset.recovering === id) return;
  elements.viewerVideo.dataset.recovering = id; clearTimeout(viewerVideoLoadTimer); setViewerVideoStatus(true, 'Preparing complete seekable video…');
  window.pigeon.ensurePlayable(id).then((mediaUrl) => { if (!mediaUrl) throw new Error('Compatibility playback is unavailable'); asset.mediaUrl = mediaUrl; if (state.viewerAssetId === id && isInternalViewerOpen()) renderInternalViewer(); }).catch((error) => { delete elements.viewerVideo.dataset.recovering; setViewerVideoStatus(true, `Video could not start · ${error.message}`); });
}
function escapeSyntax(value){return escapeHtml(value).replace(/(&quot;.*?&quot;|&#39;.*?&#39;)/g,'<span class="syntax-string">$1</span>').replace(/\b(true|false|null)\b/g,'<span class="syntax-literal">$1</span>').replace(/(^|\s)([#\/]{1,2}.*)$/gm,'$1<span class="syntax-comment">$2</span>').replace(/(&quot;[^&]+&quot;)(\s*:)/g,'<span class="syntax-key">$1</span>$2');}
async function loadTextReader(asset){const token=asset.id;try{const result=await window.pigeon.readTextAsset(asset.id);if(state.viewerAssetId!==token||!result)return;$('#viewer-text-name').textContent=result.filename;elements.viewerTextContent.dataset.extension=result.extension;elements.viewerTextContent.innerHTML=result.content.split(/\r?\n/).map((line,index)=>`<span data-line="${index+1}">${escapeSyntax(line)}</span>`).join('\n');}catch(error){elements.viewerTextContent.textContent=error.message;}}
function renderInternalViewer() {
  const asset = state.library.assets.find((item) => item.id === state.viewerAssetId);
  if (!asset) return;
  const image = asset.kind === 'image', video = asset.kind === 'video', audio = asset.kind === 'audio',text=['TXT','JSON','YAML','YML'].includes(String(asset.extension).toUpperCase());
  elements.viewerImage.classList.toggle('hidden', !image);
  elements.viewerVideo.classList.toggle('hidden', !video);
  elements.viewerAudio.classList.toggle('hidden', !audio);
  elements.viewerFile.classList.toggle('hidden', image || video || audio || text);elements.viewerTextReader.classList.toggle('hidden',!text);if(text)loadTextReader(asset);

  if (image) { const viewerSource = asset.sourceMissing ? asset.previewUrl : asset.mediaUrl; elements.viewerImage.src = protectedUrl(viewerSource); elements.viewerMinimapImage.src = protectedUrl(viewerSource); elements.viewerImage.style.transform = rotationTransform(asset);elements.mediaViewer.classList.toggle('privacy-effect-view',Boolean(asset.thumbnailEffect)); }else elements.mediaViewer.classList.remove('privacy-effect-view');
  if (video) {
    elements.viewerVideo.muted = preferences.videoMuted; elements.viewerVideo.defaultMuted = preferences.videoMuted; elements.viewerVideo.loop = Boolean(preferences.videoLoopShort && Number.isFinite(elements.viewerVideo.duration) && elements.viewerVideo.duration < 30);
    if (elements.viewerVideo.getAttribute('src') !== asset.mediaUrl) { elements.viewerVideo.src = asset.mediaUrl; setViewerVideoStatus(true, asset.mediaUrl.includes('proxy=1') ? 'Loading seekable video…' : 'Loading video…'); elements.viewerVideo.load(); clearTimeout(viewerVideoLoadTimer); viewerVideoLoadTimer = setTimeout(() => { if (elements.viewerVideo.readyState < 2 && !asset.mediaUrl.includes('proxy=1')) recoverViewerVideo(asset.id, 'timeout'); }, 2500); }
    if (elements.viewerVideo.readyState >= 2 && preferences.videoAutoplay) elements.viewerVideo.play().catch(() => {});
  } else { elements.viewerVideo.pause(); clearTimeout(viewerVideoLoadTimer); setViewerVideoStatus(false); }
  if (audio) { if (elements.viewerAudio.getAttribute('src') !== asset.mediaUrl) elements.viewerAudio.src = asset.mediaUrl; elements.viewerAudio.play().catch(() => {}); }
  else elements.viewerAudio.pause();
  if (!image && !video && !audio&&!text) elements.viewerFile.textContent = `${iconFor(asset.kind)}  ${asset.extension}`;
  elements.mediaViewer.classList.toggle('full-view', !state.viewerFit);
  elements.viewerMinimap.classList.toggle('hidden', state.viewerFit || !image);
  $('#viewer-fit').textContent = state.viewerFit ? 'Fit' : 'Full';
  const visible = filteredAssets();
  const position = visible.findIndex((item) => item.id === asset.id);
  $('#viewer-position').textContent = position >= 0 ? `${position + 1} / ${visible.length}` : '';
  requestAnimationFrame(() => { applyViewerImageFit(); if (state.viewerFit) { $('.viewer-stage').scrollTo(0, 0); } updateViewerMinimap(); updateViewerCropOverlay(); });
}
function openInternalViewer(id) {
  state.selectedId = id; state.selectedIds = new Set([id]); updateCardSelectionStyles(); renderInspector();
  state.viewerReturnScrollTop = elements.gridWrap.scrollTop || state.gridScrollTop;
  if (state.viewerAssetId !== id) delete elements.viewerVideo.dataset.userRequested; state.viewerAssetId = id; state.viewerFit = true;state.viewerZoom=1;
  elements.mediaViewer.classList.remove('hidden');
  $('#filter-bar').classList.add('viewer-hidden-filter');
  elements.grid.classList.add('hidden'); elements.empty.classList.add('hidden'); elements.tagBrowser.classList.add('hidden'); elements.sentinel.classList.add('hidden');
  renderInternalViewer();
}
elements.viewerVideo.addEventListener('loadedmetadata', () => { elements.viewerVideo.loop = Boolean(preferences.videoLoopShort && elements.viewerVideo.duration < 30); });
elements.viewerVideo.addEventListener('play', () => { elements.viewerVideo.dataset.userRequested = 'true'; });
elements.viewerVideo.addEventListener('canplay', () => { clearTimeout(viewerVideoLoadTimer); delete elements.viewerVideo.dataset.recovering; setViewerVideoStatus(false); if (elements.viewerVideo.dataset.userRequested === 'true' || preferences.videoAutoplay) elements.viewerVideo.play().catch(() => {}); });
elements.viewerVideo.addEventListener('playing', () => setViewerVideoStatus(false));
elements.viewerVideo.addEventListener('error', () => { if (elements.viewerVideo.src.includes('proxy=1') && elements.viewerVideo.dataset.recovering === state.viewerAssetId) { delete elements.viewerVideo.dataset.recovering; setViewerVideoStatus(true, 'Compatibility playback failed'); return; } recoverViewerVideo(state.viewerAssetId, 'codec'); });
elements.viewerVideo.addEventListener('stalled', () => { if (elements.viewerVideo.readyState < 2 && elements.viewerVideo.currentTime === 0) recoverViewerVideo(state.viewerAssetId, 'timeout'); });
function navigateViewer(direction) {
  cancelViewerCrop();
  const visible = filteredAssets();
  if (!visible.length) return;
  const index = visible.findIndex((item) => item.id === state.viewerAssetId);
  const next = Math.min(visible.length - 1, Math.max(0, (index < 0 ? 0 : index) + direction));
  state.viewerAssetId = visible[next].id;
  state.selectedId = state.viewerAssetId;
  state.selectedIds = new Set([state.selectedId]);
  updateCardSelectionStyles(); renderInspector(); renderInternalViewer();
}
function hideInternalViewer() {
  cancelViewerCrop();
  elements.viewerVideo.pause(); elements.viewerAudio.pause();
  elements.viewerVideo.removeAttribute('src'); elements.viewerAudio.removeAttribute('src');
  elements.mediaViewer.classList.add('hidden');
  $('#filter-bar').classList.remove('viewer-hidden-filter');
}
function closeInternalViewer() {
  suppressGridScroll = true;
  hideInternalViewer();
  state.gridScrollTop = state.viewerReturnScrollTop;
  renderGrid();
  requestAnimationFrame(() => { elements.gridWrap.scrollTop = state.viewerReturnScrollTop; requestAnimationFrame(() => { suppressGridScroll = false; }); });
}
function toggleViewerFit() {
  if (!isInternalViewerOpen()) return;
  state.viewerFit = !state.viewerFit;
  renderInternalViewer();
}

function renderAnnotations() {
  const asset = state.library.assets.find((item) => item.id === state.selectedId);
  if (!asset) return;
  elements.annotationStage.innerHTML = state.workingAnnotations.map((item) => item.type === 'text'
    ? `<span class="annotation-mark" style="left:${item.x / asset.width * 100}%;top:${item.y / asset.height * 100}%;--annotation-color:${item.color};font-size:${Math.max(12, item.size / asset.width * elements.annotationStage.clientWidth)}px;border:0">${escapeHtml(item.text)}</span>`
    : `<span class="annotation-mark" style="left:${item.x / asset.width * 100}%;top:${item.y / asset.height * 100}%;width:${item.width / asset.width * 100}%;height:${item.height / asset.height * 100}%;--annotation-color:${item.color}"></span>`).join('');
  if (state.workingEdits.crop) {
    const crop = state.workingEdits.crop;
    elements.annotationStage.insertAdjacentHTML('beforeend', `<span class="annotation-mark crop-mark" style="left:${crop.x / asset.width * 100}%;top:${crop.y / asset.height * 100}%;width:${crop.width / asset.width * 100}%;height:${crop.height / asset.height * 100}%"></span>`);
  }
}
function openAnnotationEditor(id=state.selectedId) {
  const asset=state.library.assets.find((item)=>item.id===id);
  if(!asset||asset.kind!=='image'||!asset.width||!asset.height){showToast('Select an online image with dimensions first');return;}
  state.selectedId=id;state.workingAnnotations=structuredClone(asset.annotations||[]);state.workingEdits={rotate:0,flip:false,brightness:1,crop:null};
  $('#edit-brightness').value=100;elements.annotationStage.style.transform='';elements.annotationStage.style.filter='';elements.annotationStage.style.backgroundImage=`url("${asset.mediaUrl||asset.previewUrl}")`;elements.annotationStage.style.aspectRatio=`${asset.width} / ${asset.height}`;
  elements.annotationView.classList.remove('hidden');elements.grid.classList.add('hidden');elements.empty.classList.add('hidden');elements.tagBrowser.classList.add('hidden');elements.sentinel.classList.add('hidden');$('#duplicate-controls').classList.add('hidden');elements.count.textContent='Editing';elements.status.textContent=`Annotating ${asset.filename}`;renderAnnotations();
}
function closeAnnotationEditor(){elements.annotationView.classList.add('hidden');renderGrid();renderInspector();}
function contactSheetAssets(){const order=$('#contact-sheet-order').value,assets=state.contactSheetIds.map((id)=>state.library.assets.find((asset)=>asset.id===id)).filter((asset)=>asset?.kind==='image'&&!asset.deletedAt);if(order==='name')assets.sort((a,b)=>a.name.localeCompare(b.name));if(order==='modified')assets.sort((a,b)=>(b.modified||0)-(a.modified||0));if(order==='rating')assets.sort((a,b)=>(b.rating||0)-(a.rating||0));return assets;}
function renderContactSheet(){const columns=Math.max(1,Math.min(10,Number($('#contact-sheet-columns').value)||4)),rows=Math.max(1,Math.min(10,Number($('#contact-sheet-rows').value)||5)),perPage=columns*rows,assets=contactSheetAssets(),pages=[];for(let offset=0;offset<assets.length;offset+=perPage)pages.push(assets.slice(offset,offset+perPage));$('#contact-sheet-summary').textContent=`${assets.length} images · ${pages.length||1} page${pages.length===1?'':'s'}`;elements.contactSheetPages.innerHTML=(pages.length?pages:[[]]).map((page,pageIndex)=>`<section class="contact-sheet-page" style="--contact-columns:${columns};--contact-rows:${rows}"><header contenteditable="true">Contact Sheet ${pages.length>1?`· Page ${pageIndex+1}`:''}</header><div class="contact-sheet-grid">${page.map((asset,index)=>`<article draggable="true" data-contact-id="${asset.id}" data-contact-index="${pageIndex*perPage+index}"><img src="${protectedUrl(asset.previewUrl||asset.mediaUrl)}" alt="${escapeHtml(asset.name)}" /><input value="${escapeHtml(asset.name)}" aria-label="Image label" ${state.contactSheetLabels?'':'hidden'} /></article>`).join('')}</div><footer>${pageIndex+1} / ${pages.length||1}</footer></section>`).join('');elements.contactSheetPages.querySelectorAll('[data-contact-id]').forEach((card)=>{card.addEventListener('dragstart',(event)=>event.dataTransfer.setData('application/x-pigeon-contact-index',card.dataset.contactIndex));card.addEventListener('dragover',(event)=>event.preventDefault());card.addEventListener('drop',(event)=>{event.preventDefault();const from=Number(event.dataTransfer.getData('application/x-pigeon-contact-index')),to=Number(card.dataset.contactIndex);if(!Number.isInteger(from)||!Number.isInteger(to)||from===to)return;state.contactSheetIds=contactSheetAssets().map((asset)=>asset.id);const [id]=state.contactSheetIds.splice(from,1);state.contactSheetIds.splice(to,0,id);$('#contact-sheet-order').value='current';renderContactSheet();});});}
function openContactSheet(ids,title='Contact Sheet'){const imageIds=[...new Set(ids)].filter((id)=>state.library.assets.find((asset)=>asset.id===id)?.kind==='image');if(!imageIds.length){showToast('No images are available for a contact sheet');return;}state.contactSheetIds=imageIds;elements.contactSheetView.dataset.title=title;elements.contactSheetView.classList.remove('hidden');elements.grid.classList.add('hidden');elements.empty.classList.add('hidden');elements.tagBrowser.classList.add('hidden');elements.sentinel.classList.add('hidden');$('#duplicate-controls').classList.add('hidden');renderContactSheet();}
function closeContactSheet(){if(elements.contactSheetView.classList.contains('hidden'))return;elements.contactSheetView.classList.add('hidden');renderGrid();renderInspector();}

function showAssetContextMenu(event, id) {
  event.preventDefault();
  event.stopPropagation();
  state.selectedId = id;
  const asset = state.library.assets.find((item) => item.id === id);
  if (!state.selectedIds.has(id)) state.selectedIds = new Set([id]);
  updateCardSelectionStyles(); renderInspector();
  const selectedImageIds = [...state.selectedIds].filter((assetId) => state.library.assets.find((item) => item.id === assetId)?.kind === 'image'), rotationTargetLabel = selectedImageIds.length > 1 ? `Rotate ${selectedImageIds.length} images` : 'Rotate';
  elements.contextMenu.innerHTML = `<button data-context-action="open"><span>Open in Pigeon</span><kbd>Enter</kbd></button><button data-context-action="open-default"><span>Open with default app</span></button><button data-context-action="open-with"><span>Open with…</span></button><button data-context-action="reveal"><span>Reveal in folder</span></button><button data-context-action="rebuild-thumbnails"><span>Rebuild Thumbnails</span></button>${asset.kind === 'image' ? '<button data-context-action="similar"><span>Find similar</span></button><button data-context-action="annotate"><span>Annotate…</span></button>' : ''}${asset.kind === 'image' ? '<button data-context-action="location"><span>Location…</span><span>⌖</span></button>' : ''}${asset.kind === 'image' ? '<button data-context-action="rotate-left"><span>' + rotationTargetLabel + ' left</span></button><button data-context-action="rotate-right"><span>' + rotationTargetLabel + ' right</span></button><button data-context-action="duplicate"><span>Duplicate</span><kbd>Ctrl+D</kbd></button>' : ''}<hr /><button data-context-action="favorite"><span>${asset.favorite ? 'Remove from favorites' : 'Add to favorites'}</span><span>♡</span></button><button data-context-action="five-stars"><span>Rate 5 stars</span><span>★★★★★</span></button><button data-context-action="auto-tag"><span>Generate local tags</span></button>${state.selectedIds.size > 1 ? '<button data-context-action="contact-sheet"><span>Contact Sheet…</span></button><button data-context-action="stack"><span>Stack selected assets</span></button>' : ''}${asset.stackId ? '<button data-context-action="unstack"><span>Unstack group</span></button>' : ''}${state.collectionId ? '<hr /><button data-context-action="remove-from-collection"><span>Remove from collection</span></button>' : ''}<hr /><button data-context-action="trash"><span>${asset.deletedAt ? 'Restore reference' : 'Move reference to trash'}</span></button>`;
  elements.contextMenu.querySelectorAll('[data-context-action]').forEach((button) => button.addEventListener('click', async () => {
    const action = button.dataset.contextAction;
    if (action === 'open') openInternalViewer(id);
    if (action === 'open-default') await window.pigeon.openAsset(id);
    if (action === 'open-with') await window.pigeon.openAssetWith(id);
    if (action === 'reveal') window.pigeon.revealAsset(id);
    if(action==='rebuild-thumbnails'){const result=await window.pigeon.rebuildThumbnails([...state.selectedIds]),updates=new Map((result.assets||[]).map((asset)=>[asset.id,asset]));for(const asset of state.library.assets)if(updates.has(asset.id))Object.assign(asset,updates.get(asset.id));reconcileThumbnailCards([...updates.keys()]);showToast(`${result.rebuilt} thumbnail${result.rebuilt===1?'':'s'} rebuilt`);}
    const selectedIds = [...state.selectedIds];
    if (action === 'location') openMapView(selectedIds);
    if(action==='annotate')openAnnotationEditor(id);
    if (action === 'favorite') await window.pigeon.batchUpdateAssets(selectedIds, { favorite: !asset.favorite });
    if (action === 'five-stars') await window.pigeon.batchUpdateAssets(selectedIds, { rating: 5 });
    if (action === 'auto-tag') await window.pigeon.autoTag(selectedIds);
    if (action === 'rotate-left' || action === 'rotate-right') await rotateThumbnailsWithoutGridRefresh(selectedImageIds,action === 'rotate-left' ? -90 : 90);
    if (action === 'duplicate') await Promise.all(selectedIds.map((assetId) => window.pigeon.duplicateAsset(assetId)));
    if(action==='contact-sheet')openContactSheet(selectedIds,'Selected images');
    if (action === 'stack') await window.pigeon.stackAssets([...state.selectedIds]);
    if (action === 'unstack') await window.pigeon.unstackAssets([id]);
    if (action === 'remove-from-collection') await removeSelectedFromCurrentCollection();
    if (action === 'trash') await window.pigeon.batchUpdateAssets(selectedIds, asset.deletedAt ? { restore: true } : { trash: true });
    if (action === 'similar') selectView('duplicates', `Similar to ${asset.name}`, { sourceId: id });
    closeFloatingMenus();
  }));
  elements.contextMenu.classList.add('asset-context-menu-expanded');elements.contextMenu.classList.remove('hidden');
  elements.contextMenu.style.left = `${Math.min(event.clientX, window.innerWidth - 220)}px`;
  elements.contextMenu.style.top = `${Math.min(event.clientY, window.innerHeight - elements.contextMenu.offsetHeight - 8)}px`;
}

for (const panel of ['sidebar', 'inspector']) {
  const resizer = $(`#${panel}-resizer`);
  resizer.setAttribute('aria-valuemin', panel === 'sidebar' ? '260' : '220');
  resizer.setAttribute('aria-valuemax', panel === 'sidebar' ? '480' : '600');
  resizer.setAttribute('aria-valuenow', String(Math.round(panelWidth(panel === 'sidebar' ? '--sidebar-width' : '--inspector-width'))));
  resizer.addEventListener('pointerdown', (event) => beginPanelResize(panel, event));
  resizer.addEventListener('dblclick', () => { const width = setPanelWidth(panel, 298, true); showToast(`${panel === 'sidebar' ? 'Portfolio' : 'Inspector'} panel reset · ${width}px`); });
  resizer.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const current = panelWidth(panel === 'sidebar' ? '--sidebar-width' : '--inspector-width');
    setPanelWidth(panel, current + direction * 10 * (panel === 'sidebar' ? 1 : -1), true);
  });
}

$$('.nav-item[data-view]').forEach((button) => button.addEventListener('click', () => button.dataset.view === 'analytics' ? openAnalytics() : selectView(button.dataset.view, button.querySelector('span:nth-child(2)').textContent)));
$('#primary-library-nav').addEventListener('contextmenu',(event)=>showPrimarySidebarContextMenu(event,{trash:Boolean(event.target.closest('[data-view="trash"]'))}));
$('#navigation-back').addEventListener('click',returnFromTemporaryView);$('#navigation-forward').addEventListener('click',forwardToTemporaryView);updateNavigationButtons();
$('#analytics-tabs').addEventListener('click', (event) => { const button = event.target.closest('[data-analytics-tab]'); if (!button) return; state.analyticsTab = button.dataset.analyticsTab; renderAnalytics(); });
elements.analyticsContent.addEventListener('contextmenu',(event)=>{const row=event.target.closest('[data-analytics-asset]');if(!row)return;event.preventDefault();const id=row.dataset.analyticsAsset,asset=state.library.assets.find((item)=>item.id===id);if(!asset)return;closeFloatingMenus();elements.contextMenu.innerHTML=`<button data-analytics-action="reveal"><span>View in folder</span></button><button data-analytics-action="export"><span>Export to computer</span></button><button data-analytics-action="copy"><span>Copy path to file</span></button><button data-analytics-action="open"><span>Open in ${window.pigeon.platform==='win32'?'Windows':window.pigeon.platform==='darwin'?'macOS':'operating system'}</span></button>`;elements.contextMenu.querySelectorAll('[data-analytics-action]').forEach((button)=>button.addEventListener('click',async()=>{hideContextMenu();if(button.dataset.analyticsAction==='reveal')await window.pigeon.revealAsset(id);if(button.dataset.analyticsAction==='export')await window.pigeon.exportAsset(id);if(button.dataset.analyticsAction==='copy'){await window.pigeon.copyText(asset.path);showToast('File path copied');}if(button.dataset.analyticsAction==='open')await window.pigeon.openAsset(id);}));elements.contextMenu.classList.remove('hidden');positionMenu(elements.contextMenu,event.clientX,event.clientY);});
$('#close-analytics').addEventListener('click',()=>{if(!returnFromTemporaryView())selectView('all','All');});
const inspectorPreviewCollapsed=localStorage.getItem('pigeon.inspectorPreviewCollapsed')==='true';$('#inspector-preview-section').classList.toggle('collapsed',inspectorPreviewCollapsed);$('#toggle-inspector-preview').setAttribute('aria-expanded',String(!inspectorPreviewCollapsed));$('#toggle-inspector-preview').title=inspectorPreviewCollapsed?'Show preview':'Hide preview';
$('#toggle-inspector-preview').addEventListener('click',()=>{const section=$('#inspector-preview-section'),collapsed=!section.classList.contains('collapsed');section.classList.toggle('collapsed',collapsed);$('#toggle-inspector-preview').setAttribute('aria-expanded',String(!collapsed));$('#toggle-inspector-preview').title=collapsed?'Show preview':'Hide preview';localStorage.setItem('pigeon.inspectorPreviewCollapsed',String(collapsed));});
$('#add-button').addEventListener('click', (event) => { event.stopPropagation(); closeFloatingMenus(); elements.addMenu.classList.toggle('hidden'); });
document.addEventListener('click', (event) => {
  if (!elements.addMenu.contains(event.target)) elements.addMenu.classList.add('hidden');
  if (!event.target.closest('.facet-popover, .filter-chip[data-facet]')) elements.facetPopover.classList.add('hidden');
  if(!event.target.closest('#order-by-popover,#order-by-button')){$('#order-by-popover').classList.add('hidden');$('#order-by-button').setAttribute('aria-expanded','false');}
  if (!event.target.closest('#app-menu, #app-submenu, #app-menu-button')) { elements.appMenu.classList.add('hidden'); elements.appSubmenu.classList.add('hidden'); }
  if (!event.target.closest('#asset-context-menu')) { elements.contextMenu.classList.add('hidden'); elements.contextMenu.classList.remove('sidebar-visibility-menu'); }
});
$('#menu-add-folder').addEventListener('click', addFolder);
$('#menu-add-files').addEventListener('click', addFiles);
$('#empty-add-pictures').addEventListener('click',addDefaultPictures);
$('#empty-add-folder').addEventListener('click', addFolder);
$('#empty-add-files').addEventListener('click', addFiles);
const collapsedSidebarSections = (() => { try { return new Set(JSON.parse(localStorage.getItem('pigeon.collapsedSidebarSections') || '[]')); } catch { return new Set(); } })();
function setSidebarSectionExpanded(name, expanded) {
  const label = document.querySelector(`[data-section-toggle="${name}"]`), content = $(`#sidebar-section-${name}`); if (!label || !content) return;
  label.setAttribute('aria-expanded', String(expanded)); content.classList.toggle('collapsed', !expanded);
  if (expanded) collapsedSidebarSections.delete(name); else collapsedSidebarSections.add(name);
  localStorage.setItem('pigeon.collapsedSidebarSections', JSON.stringify([...collapsedSidebarSections]));
}
document.querySelectorAll('[data-section-toggle]').forEach((label) => {
  const name = label.dataset.sectionToggle; setSidebarSectionExpanded(name, !collapsedSidebarSections.has(name));
  label.addEventListener('click', (event) => { if (event.target.closest('button')) return; setSidebarSectionExpanded(name, label.getAttribute('aria-expanded') !== 'true'); });
  label.addEventListener('keydown', (event) => { if (event.target.closest('button') || !['Enter', ' '].includes(event.key)) return; event.preventDefault(); setSidebarSectionExpanded(name, label.getAttribute('aria-expanded') !== 'true'); });
});
$('#add-folder-mini').addEventListener('click', addFolder);
let smartFolderRules = [], smartFolderDialogParentId = null,editingSmartFolderId=null;
const smartFieldOptions = [['name','Name'],['tags','Tags'],['type','Type'],['folder','Folder'],['collection','Collection'],['rating','Rating'],['favorite','Favourite'],['privacyEffect','Blur / Pixelate']];
const smartOperatorOptions = [['contains','contains'],['excludes','excludes'],['begins','begins with'],['ends','ends with'],['equals','equals'],['null','is null'],['not-null','is not null'],['less-than','less than'],['less-than-equal','less than or equal to'],['greater-than','greater than'],['greater-than-equal','greater than or equal to'],['regex','regular expression']];
function operatorsForSmartField(field) { if (field === 'collection') return smartOperatorOptions.filter(([value]) => value === 'null' || value === 'not-null');if(field==='privacyEffect'||field==='favorite')return smartOperatorOptions.filter(([value])=>value==='equals'); if (field === 'rating') return smartOperatorOptions.filter(([value]) => ['equals','null','not-null','less-than','less-than-equal','greater-than','greater-than-equal'].includes(value)); return smartOperatorOptions.filter(([value]) => !['less-than','less-than-equal','greater-than','greater-than-equal'].includes(value)); }
function currentSmartFolderFilters() { return { ruleMatch: $('#smart-folder-match').value, rules: smartFolderRules.map((rule) => ({ ...rule })) }; }
function updateSmartFolderFound() { const count = state.library.assets.filter((asset) => !asset.deletedAt && !asset.locked && matchesSavedFilters(asset, currentSmartFolderFilters())).length; $('#smart-folder-found').textContent = `Found ${count} item${count === 1 ? '' : 's'}`; }
function renderSmartFolderRules() {
  $('#smart-folder-rules').innerHTML = smartFolderRules.map((rule, index) => `<div class="smart-rule" data-rule-index="${index}"><select data-rule-part="field">${smartFieldOptions.map(([value,label]) => `<option value="${value}" ${rule.field === value ? 'selected' : ''}>${label}</option>`).join('')}</select><select data-rule-part="operator">${operatorsForSmartField(rule.field).map(([value,label]) => `<option value="${value}" ${rule.operator === value ? 'selected' : ''}>${label}</option>`).join('')}</select>${rule.field==='privacyEffect'?`<select data-rule-part="value"><option value="true" ${rule.value!=='false'?'selected':''}>Effect applied</option><option value="false" ${rule.value==='false'?'selected':''}>Effect not applied</option></select>`:`<input data-rule-part="value" value="${escapeHtml(rule.value || '')}" placeholder="Value" ${rule.field === 'tags' ? 'data-smart-tag-input="true" aria-autocomplete="list" aria-controls="tag-autocomplete"' : ''} ${(rule.operator === 'null' || rule.operator === 'not-null' || rule.field === 'collection') ? 'disabled' : ''}/>`}<button data-remove-rule title="Remove rule">−</button></div>`).join(''); $('#smart-folder-rules').querySelectorAll('[data-smart-tag-input]').forEach((input) => enableTagAutocomplete(input)); updateSmartFolderFound();
}
function openSmartFolderDialog(parentId=null,folder=null){editingSmartFolderId=folder?.id||null;smartFolderDialogParentId=folder?.parentId??parentId;smartFolderRules=folder?.filters?.rules?.map((rule)=>({...rule}))||[{field:'tags',operator:'contains',value:''}];$('#smart-folder-name').value=folder?.name||'';$('#smart-folder-match').value=folder?.filters?.ruleMatch||'all';const parent=state.library.smartFolders.find((item)=>item.id===parentId);$('#smart-folder-dialog header strong').textContent=folder?'Edit Smart Folder':parent?`New Smart Subfolder in ${parent.name}`:'New Smart Folder';$('#create-smart-folder').textContent=folder?'Save Changes':'Create';renderSmartFolderRules();if(!$('#smart-folder-dialog').open)$('#smart-folder-dialog').showModal();setTimeout(()=>$('#smart-folder-name').focus(),0);}
$('#smart-folder-rules').addEventListener('input', (event) => { const row = event.target.closest('[data-rule-index]'); if (!row || !event.target.dataset.rulePart) return; smartFolderRules[Number(row.dataset.ruleIndex)][event.target.dataset.rulePart] = event.target.value; updateSmartFolderFound(); });
$('#smart-folder-rules').addEventListener('change', (event) => { const row=event.target.closest('[data-rule-index]'),rule=row&&smartFolderRules[Number(row.dataset.ruleIndex)]; if(event.target.dataset.rulePart==='field'&&rule){ const allowed=operatorsForSmartField(rule.field); if(!allowed.some(([value])=>value===rule.operator)) rule.operator=allowed[0][0]; if(rule.field==='collection') rule.value='';if(rule.field==='privacyEffect'){rule.operator='equals';rule.value='true';} } if (event.target.dataset.rulePart === 'operator' || event.target.dataset.rulePart === 'field') renderSmartFolderRules(); });
$('#smart-folder-rules').addEventListener('click', (event) => { const button = event.target.closest('[data-remove-rule]'); if (!button) return; smartFolderRules.splice(Number(button.closest('[data-rule-index]').dataset.ruleIndex), 1); if (!smartFolderRules.length) smartFolderRules.push({ field: 'tags', operator: 'contains', value: '' }); renderSmartFolderRules(); });
$('#smart-folder-match').addEventListener('change', updateSmartFolderFound);
$('#add-smart-rule').addEventListener('click', () => { smartFolderRules.push({ field: 'name', operator: 'contains', value: '' }); renderSmartFolderRules(); });
const closeSmartFolderDialog=()=>{$('#smart-folder-dialog').close();smartFolderDialogParentId=null;editingSmartFolderId=null;$('#create-smart-folder').textContent='Create';};
$('#close-smart-folder-dialog').addEventListener('click', closeSmartFolderDialog); $('#cancel-smart-folder').addEventListener('click', closeSmartFolderDialog);
$('#create-smart-folder').addEventListener('click',async()=>{const name=$('#smart-folder-name').value.trim();if(!name){$('#smart-folder-name').focus();return;}try{const folder=editingSmartFolderId?await window.pigeon.updateSmartFolder(editingSmartFolderId,name,currentSmartFolderFilters()):await window.pigeon.createSmartFolder(name,currentSmartFolderFilters(),smartFolderDialogParentId),existing=state.library.smartFolders.find((item)=>item.id===folder.id);if(existing)Object.assign(existing,folder);else state.library.smartFolders.push(folder);renderSidebar(false);if(state.smartFolderId===folder.id)renderGrid();closeSmartFolderDialog();}catch(error){showToast(error.message);}});
async function createCollectionPrompt(parentId = null) {
  const parent = state.library.collections.find((item) => item.id === parentId), name = await requestText({ title: parent ? `New Subfolder in ${parent.name}` : 'Create a Collection', message: parent ? 'The new collection will appear nested beneath this collection.' : 'Collections organize references without moving the original files.', label: 'Collection name', placeholder: 'Collection name', confirmText: parent ? 'Create Subfolder' : 'Create Collection' });
  if (!name?.trim()) return null;
  try { const collection=await window.pigeon.createCollection(name.trim(),parentId);if(collection&&!state.library.collections.some((item)=>item.id===collection.id)){state.library.collections.push(collection);renderSidebar(false);}return collection;} catch (error) { showToast(error.message); return null; }
}
$('#add-collection').addEventListener('click', () => createCollectionPrompt());
$('#save-smart-folder').addEventListener('click', () => openSmartFolderDialog());
$$('[data-sidebar-sort]').forEach((button)=>button.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();const type=button.dataset.sidebarSort,current=state.library.settings?.sidebarSort?.[type]||'manual',options=[['manual','Manual order'],['name-asc','Name · A to Z'],['name-desc','Name · Z to A'],['updated-desc','Last updated · newest'],['updated-asc','Last updated · oldest']];closeFloatingMenus();elements.contextMenu.innerHTML=options.map(([value,label])=>`<button data-sort-value="${value}"><span>${label}</span><span class="menu-check">${current===value?'✓':''}</span></button>`).join('');elements.contextMenu.querySelectorAll('[data-sort-value]').forEach((item)=>item.addEventListener('click',async()=>{hideContextMenu();state.library.settings=state.library.settings||{};state.library.settings.sidebarSort={...(state.library.settings.sidebarSort||{}),[type]:item.dataset.sortValue};renderSidebar(false);await window.pigeon.setSidebarSort(type,item.dataset.sortValue);}));elements.contextMenu.classList.remove('hidden');positionMenu(elements.contextMenu,button.getBoundingClientRect().right,button.getBoundingClientRect().bottom);}));
$('#batch-tag').addEventListener('click', () => {
  tagAssignmentTargetIds = expandedTagTargetIds(); renderTagSuggestions(); $('#batch-tag-input').value = '';
  if (!$('#tag-assignment-dialog').open) $('#tag-assignment-dialog').showModal();
  setTimeout(() => $('#batch-tag-input').focus(), 0);
});
$('#icon-picker-search').addEventListener('input', (event) => renderIconPicker(event.target.value));
$('#icon-picker-grid').addEventListener('click', (event) => { const button = event.target.closest('[data-icon-name]'); if (button) chooseItemIcon(button.dataset.iconName); });
$('#reset-item-icon').addEventListener('click', () => chooseItemIcon(null));
const closeIconPicker = () => { if ($('#icon-picker-dialog').open) $('#icon-picker-dialog').close(); iconPickerTarget = null; };
$('#close-icon-picker').addEventListener('click', closeIconPicker); $('#cancel-icon-picker').addEventListener('click', closeIconPicker);
$('#confirm-text-entry').addEventListener('click', () => finishTextEntry(true));
$('#cancel-text-entry').addEventListener('click', () => finishTextEntry(false));
$('#close-text-entry').addEventListener('click', () => finishTextEntry(false));
$('#text-entry-tag-pills').addEventListener('click', (event) => { const button = event.target.closest('[data-remove-entry-tag]'); if (!button) return; textEntryTagValues.delete(button.dataset.removeEntryTag.toLowerCase()); renderTextEntryTagPills(); });
$('#text-entry-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); if (textEntryTagMode) { addTextEntryTags(event.currentTarget.value.split(',')); event.currentTarget.value = ''; hideTagAutocomplete(); } else finishTextEntry(true); } });
$('#text-entry-dialog').addEventListener('cancel', (event) => { event.preventDefault(); finishTextEntry(false); });
const closeTagAssignment = () => $('#tag-assignment-dialog').close();
$('#close-tag-assignment').addEventListener('click', closeTagAssignment);
$('#cancel-tag-assignment').addEventListener('click', closeTagAssignment);
$('#apply-tag-assignment').addEventListener('click', async () => {
  const tags = [...new Set($('#batch-tag-input').value.split(',').map((tag) => tag.trim()).filter(Boolean))];
  if (!tags.length) return;
  await addTagsToAssets(tagAssignmentTargetIds, tags); closeTagAssignment();
});
$('#batch-tag-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); $('#apply-tag-assignment').click(); } });
$('#batch-collection').addEventListener('click', async () => {
  const names = (state.library.collections || []).map((item) => item.name).join(', ');
  const name = await requestText({ title: 'Add to Collection', message: names ? `Available: ${names}` : 'Create a collection first.', label: 'Collection name', confirmText: 'Add' });
  const collection = (state.library.collections || []).find((item) => item.name.toLowerCase() === String(name).toLowerCase());
  if (collection) await addAssetsToCollectionWithoutGridRefresh([...state.selectedIds],collection);
  else if (name) showToast('Collection not found');
});
$('#batch-auto-tag').addEventListener('click', () => window.pigeon.autoTag([...state.selectedIds]));
$('#batch-stack').addEventListener('click', async () => { await window.pigeon.stackAssets([...state.selectedIds]); clearSelection(); });
$('#batch-unstack').addEventListener('click', async () => { await window.pigeon.unstackAssets([...state.selectedIds]); clearSelection(); });
$('#batch-favorite').addEventListener('click', () => window.pigeon.batchUpdateAssets([...state.selectedIds], { favorite: true }));
$('#batch-trash').addEventListener('click', () => window.pigeon.batchUpdateAssets([...state.selectedIds], { trash: true }));
$('#batch-clear').addEventListener('click', () => { clearSelection(); renderGrid(); });
const refreshLibrarySources = async () => { showToast('Refreshing source status and media details…'); const result = await window.pigeon.refreshSources(); showToast(`Refresh complete · ${result.online}/${result.total} locations online`); };
$('#rescan-button').addEventListener('click', refreshLibrarySources);
$('#refresh-button').addEventListener('click', refreshLibrarySources);
$('#filter-button').addEventListener('click', () => $('#filter-bar').classList.toggle('hidden'));
$$('.filter-chip[data-facet]').forEach((button) => button.addEventListener('click', (event) => {
  event.stopPropagation();
  if (state.openFacet === button.dataset.facet && !elements.facetPopover.classList.contains('hidden')) { elements.facetPopover.classList.add('hidden'); state.openFacet = null; return; }
  elements.appMenu.classList.add('hidden');
  renderFacetPopover(button.dataset.facet, button);
}));
$('#clear-filters').addEventListener('click', () => {
  Object.values(state.filters).forEach((values) => values.clear());
  state.kind = 'visual'; resetRenderLimit(); updateFilterChips(); renderGrid(); closeFloatingMenus(); showToast('Filters cleared · showing images and videos');
});
$('#app-menu-button').addEventListener('click', (event) => {
  event.stopPropagation(); elements.facetPopover.classList.add('hidden'); elements.appSubmenu.classList.add('hidden'); elements.appMenu.classList.toggle('hidden');
});
elements.appMenu.querySelectorAll('[data-menu-group]').forEach((button) => {
  button.addEventListener('mouseenter', () => showAppSubmenu(button.dataset.menuGroup, button));
  button.addEventListener('click', (event) => { event.stopPropagation(); showAppSubmenu(button.dataset.menuGroup, button); });
});
elements.appMenu.querySelectorAll('[data-menu-action]').forEach((button) => button.addEventListener('click', async () => {
  await executeMenuAction(button.dataset.menuAction); closeFloatingMenus();
}));
const updateLayoutButton = () => { const labels = { grid: ['layout', 'Masonry thumbnails'], justified: ['all', 'Equal-height rows'], list: ['menu', 'List view'] }; $('#layout-button').innerHTML = iconSvg(labels[state.layout][0]); $('#layout-button').title = labels[state.layout][1]; };
updateLayoutButton();
$('#layout-button').addEventListener('click', () => { const layouts = ['grid', 'justified', 'list']; state.layout = layouts[(layouts.indexOf(state.layout) + 1) % layouts.length]; localStorage.setItem('pigeon.layout', state.layout); updateLayoutButton(); renderGrid(); });
function openOrderByPopover(){const popover=$('#order-by-popover'),button=$('#order-by-button'),order=currentAssetOrder(),scope=state.collectionId?state.library.collections.find((item)=>item.id===state.collectionId)?.name:state.smartFolderId?state.library.smartFolders.find((item)=>item.id===state.smartFolderId)?.name:state.locationId?(state.locationSubfolder?.split('/').pop()||state.library.locations.find((item)=>item.id===state.locationId)?.name):elements.title.textContent;$('#order-by-field').value=order.field;$('#order-by-scope').textContent=scope||'Current view';$('#order-ascending').classList.toggle('active',order.direction==='asc');$('#order-descending').classList.toggle('active',order.direction==='desc');const rect=button.getBoundingClientRect();popover.style.left=`${Math.min(window.innerWidth-292,Math.max(8,rect.right-284))}px`;popover.style.top=`${rect.bottom+6}px`;popover.classList.toggle('hidden');button.setAttribute('aria-expanded',String(!popover.classList.contains('hidden')));}
async function applyCurrentAssetOrder(direction=currentAssetOrder().direction){const order={field:$('#order-by-field').value,direction},scope=assetOrderScopeKey();state.library.settings=state.library.settings||{};state.library.settings.assetOrders={...(state.library.settings.assetOrders||{}),[scope]:order};$('#order-ascending').classList.toggle('active',direction==='asc');$('#order-descending').classList.toggle('active',direction==='desc');resetRenderLimit();renderGrid();await window.pigeon.setAssetOrder(scope,order);}
$('#order-by-button').addEventListener('click',(event)=>{event.stopPropagation();openOrderByPopover();});$('#order-by-field').addEventListener('change',()=>applyCurrentAssetOrder());$('#order-ascending').addEventListener('click',()=>applyCurrentAssetOrder('asc'));$('#order-descending').addEventListener('click',()=>applyCurrentAssetOrder('desc'));$('#reset-item-order').addEventListener('click',()=>{$('#order-by-field').value='modified';applyCurrentAssetOrder('desc');});
$('#inspector-toggle').addEventListener('click', (event) => { elements.inspector.classList.toggle('hidden-panel'); event.currentTarget.classList.toggle('selected'); });
elements.search.addEventListener('input',()=>{state.query=elements.search.value;state.gridScrollTop=0;resetRenderLimit();if(searchRenderFrame)cancelAnimationFrame(searchRenderFrame);searchRenderFrame=requestAnimationFrame(()=>{searchRenderFrame=null;renderGrid();});});
const acceptsManagedDrop = () => !state.locationId && !state.collectionId && !state.smartFolderId && ['all', 'uncategorized', 'tags'].includes(state.view);
function updateMarqueeSelection(event){if(!marqueeSelection)return;marqueeSelection.currentX=event.clientX;marqueeSelection.currentY=event.clientY;const wrapRect=elements.gridWrap.getBoundingClientRect(),left=Math.min(marqueeSelection.startX,event.clientX),right=Math.max(marqueeSelection.startX,event.clientX),top=Math.min(marqueeSelection.startY,event.clientY),bottom=Math.max(marqueeSelection.startY,event.clientY),marquee=$('#selection-marquee');marquee.classList.remove('hidden');marquee.style.left=`${left-wrapRect.left+elements.gridWrap.scrollLeft}px`;marquee.style.top=`${top-wrapRect.top+elements.gridWrap.scrollTop}px`;marquee.style.width=`${right-left}px`;marquee.style.height=`${bottom-top}px`;const next=new Set(marqueeSelection.base);for(const card of elements.grid.querySelectorAll('.asset-card')){const rect=card.getBoundingClientRect(),intersects=rect.right>=left&&rect.left<=right&&rect.bottom>=top&&rect.top<=bottom;if(intersects)next.add(card.dataset.assetId);else if(!marqueeSelection.base.has(card.dataset.assetId))next.delete(card.dataset.assetId);}const changed=[...new Set([...state.selectedIds,...next])].filter((id)=>state.selectedIds.has(id)!==next.has(id));state.selectedIds=next;state.selectedId=[...next].at(-1)||null;paintChangedSelectionCards(changed);scheduleSelectionInspector();const edge=54,speed=event.clientY<wrapRect.top+edge?-Math.ceil((wrapRect.top+edge-event.clientY)/4):event.clientY>wrapRect.bottom-edge?Math.ceil((event.clientY-(wrapRect.bottom-edge))/4):0;marqueeSelection.scrollSpeed=Math.max(-22,Math.min(22,speed));}
function runMarqueeAutoScroll(){if(!marqueeSelection){marqueeScrollFrame=null;return;}if(marqueeSelection.scrollSpeed){elements.gridWrap.scrollTop+=marqueeSelection.scrollSpeed;updateMarqueeSelection({clientX:marqueeSelection.currentX,clientY:marqueeSelection.currentY});}marqueeScrollFrame=requestAnimationFrame(runMarqueeAutoScroll);}
function finishMarqueeSelection(){if(!marqueeSelection)return;suppressMarqueeClick=marqueeSelection.moved;marqueeSelection=null;$('#selection-marquee').classList.add('hidden');if(marqueeScrollFrame)cancelAnimationFrame(marqueeScrollFrame);marqueeScrollFrame=null;renderBatchBar();scheduleSelectionInspector();}
elements.gridWrap.addEventListener('pointerdown',(event)=>{if(event.button!==0||isInternalViewerOpen()||state.mapOpen||event.target.closest('.asset-card,button,input,textarea,select,a,.stack-badge'))return;marqueeSelection={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,currentX:event.clientX,currentY:event.clientY,base:event.ctrlKey||event.metaKey?new Set(state.selectedIds):new Set(),moved:false,scrollSpeed:0};elements.gridWrap.setPointerCapture(event.pointerId);if(!marqueeScrollFrame)marqueeScrollFrame=requestAnimationFrame(runMarqueeAutoScroll);});
elements.gridWrap.addEventListener('pointermove',(event)=>{if(!marqueeSelection||event.pointerId!==marqueeSelection.pointerId)return;if(!marqueeSelection.moved&&Math.hypot(event.clientX-marqueeSelection.startX,event.clientY-marqueeSelection.startY)<4)return;marqueeSelection.moved=true;event.preventDefault();updateMarqueeSelection(event);});
elements.gridWrap.addEventListener('pointerup',(event)=>{if(marqueeSelection?.pointerId===event.pointerId)finishMarqueeSelection();});elements.gridWrap.addEventListener('pointercancel',finishMarqueeSelection);
elements.grid.addEventListener('click',(event)=>{if(!suppressMarqueeClick)return;suppressMarqueeClick=false;event.preventDefault();event.stopImmediatePropagation();},true);
const hasExternalFiles = (event) => { const transfer = event.dataTransfer; return Boolean(transfer && (transfer.files?.length || [...(transfer.items || [])].some((item) => item.kind === 'file') || [...(transfer.types || [])].some((type) => String(type).toLowerCase() === 'files'))); };
function droppedFilePaths(event) { return [...(event.dataTransfer?.files || [])].map((file) => window.pigeon.pathForDroppedFile(file)).filter(Boolean); }
elements.gridWrap.addEventListener('dragover', (event) => { if (!hasExternalFiles(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = acceptsManagedDrop() ? 'copy' : 'none'; elements.gridWrap.classList.toggle('external-drop', acceptsManagedDrop()); });
elements.gridWrap.addEventListener('dragleave', (event) => { if (!elements.gridWrap.contains(event.relatedTarget)) elements.gridWrap.classList.remove('external-drop'); });
elements.gridWrap.addEventListener('drop', async (event) => {
  if (!hasExternalFiles(event)) return;
  event.preventDefault(); elements.gridWrap.classList.remove('external-drop');
  if (!acceptsManagedDrop()) { showToast('Drop files in All, Uncategorized, or All Tags'); return; }
  const files = [...(event.dataTransfer.files || [])]; if (!files.length) { showToast('No local files were found in that drop'); return; }
  const paths = droppedFilePaths(event);
  if (!paths.length) { showToast('Pigeon could not access those file paths. Try dragging them from File Explorer.'); return; }
  showToast(`Importing ${paths.length} file${paths.length === 1 ? '' : 's'}…`);
  try { const result = await window.pigeon.importDroppedFiles(paths); showToast(result.imported ? `${result.imported} file${result.imported === 1 ? '' : 's'} added to Needs Organization` : 'No supported local files were imported'); }
  catch (error) { showToast(error.message); }
});
const sidebarScroll=$('#sidebar-tree-scroll');sidebarScroll.addEventListener('scroll',()=>{const labels=[...sidebarScroll.querySelectorAll('.collapsible-section-label:not(.preference-hidden)')],top=sidebarScroll.getBoundingClientRect().top;let current=labels[0];for(const label of labels)if(label.getBoundingClientRect().top<=top+2)current=label;for(const label of labels)label.classList.toggle('pinned-section',label===current&&current.getBoundingClientRect().top<=top+2);},{passive:true});
document.addEventListener('dragover', (event) => { if (hasExternalFiles(event)) event.preventDefault(); });
document.addEventListener('drop', (event) => { if (hasExternalFiles(event)) event.preventDefault(); });
elements.gridWrap.addEventListener('wheel', (event) => {
  if((event.ctrlKey||event.shiftKey)&&preferences.wheelBehavior==='scroll'){event.preventDefault();elements.gridWrap.scrollTop+=event.deltaY||event.deltaX;return;}
  if (isInternalViewerOpen() || state.mapOpen || !event.ctrlKey && !event.metaKey || preferences.wheelBehavior === 'scroll') return;
  event.preventDefault();
  if (preferences.wheelBehavior === 'navigate') navigateAssets(event.deltaY > 0 ? 'ArrowRight' : 'ArrowLeft');
  else { const zoom = $('#zoom-slider'); zoom.value = String(Math.max(Number(zoom.min), Math.min(Number(zoom.max), Number(zoom.value) + (event.deltaY < 0 ? 12 : -12)))); zoom.dispatchEvent(new Event('input', { bubbles: true })); }
}, { passive: false });
elements.gridWrap.addEventListener('scroll', () => {
  if (!isInternalViewerOpen() && !suppressGridScroll && !state.mapOpen) state.gridScrollTop = elements.gridWrap.scrollTop;
  clearTimeout(navigationSaveTimer); navigationSaveTimer = setTimeout(saveNavigationState, 180);
}, { passive: true });
function setThumbnailZoom(value,{persist=true,render=true}={}){const slider=$('#zoom-slider'),next=Math.max(Number(slider.min),Math.min(Number(slider.max),Number(value)));slider.value=String(next);document.documentElement.style.setProperty('--card-width',`${next}px`);document.documentElement.style.setProperty('--justified-row-height',`${Math.max(52,Math.min(320,next*.58))}px`);if(persist){const settings=thumbnailSizeSettings();settings.scopes={...(settings.scopes||{}),[thumbnailSizeScopeKey()]:next};localStorage.setItem(thumbnailSizeStorage(),JSON.stringify(settings));}$('#zoom-set-default').classList.toggle('hidden',next===portfolioThumbnailDefault());if(render)renderGrid();}
$('#zoom-slider').addEventListener('input',(event)=>setThumbnailZoom(event.target.value));
$('#zoom-out').addEventListener('click',()=>setThumbnailZoom(Number($('#zoom-slider').value)-Number($('#zoom-slider').step||8)));
$('#zoom-in').addEventListener('click',()=>setThumbnailZoom(Number($('#zoom-slider').value)+Number($('#zoom-slider').step||8)));
$('#zoom-set-default').addEventListener('click',()=>{const settings=thumbnailSizeSettings();settings.default=Number($('#zoom-slider').value);localStorage.setItem(thumbnailSizeStorage(),JSON.stringify(settings));$('#zoom-set-default').classList.add('hidden');showToast('Portfolio thumbnail default updated');});
elements.note.addEventListener('change', () => updateSelected({ note: elements.note.value.trim() }));
let inspectorRenamePending = false;
const commitInspectorFilename = async () => { if (!state.selectedId || inspectorRenamePending) return; inspectorRenamePending = true; try { await renameAssetFile(state.selectedId, elements.assetName.value); } finally { inspectorRenamePending = false; } };
elements.assetName.addEventListener('change', commitInspectorFilename);
elements.assetName.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); commitInspectorFilename(); elements.assetName.blur(); }
  else if (event.key === 'Escape') { event.preventDefault(); const asset = state.library.assets.find((item) => item.id === state.selectedId); elements.assetName.value = asset?.name || ''; elements.assetName.blur(); }
});
async function commitTagInput() {
  const additions = elements.tags.value.split(',').map((tag) => tag.trim()).filter(Boolean);
  if (!state.selectedId || !additions.length) return;
  const targets = expandedTagTargetIds(); elements.tags.value = '';
  await addTagsToAssets(targets, additions);
}
elements.tags.addEventListener('change', commitTagInput);
elements.tags.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commitTagInput(); } });
$('#viewer-previous').addEventListener('click', () => navigateViewer(-1));
$('#viewer-next').addEventListener('click', () => navigateViewer(1));
$('#viewer-fit').addEventListener('click', toggleViewerFit);
async function rotateViewerAsset(direction) {
  const asset = state.library.assets.find((item) => item.id === state.viewerAssetId);
  if (!asset || asset.kind !== 'image') return;
  state.selectedId = asset.id;
  await updateSelected({ rotation: ((asset.rotation || 0) + direction + 360) % 360 });
  renderGrid(); renderInternalViewer();
}
async function duplicateViewerAsset(){const duplicate=await window.pigeon.duplicateAsset(state.viewerAssetId);if(duplicate)showToast(`Duplicated as ${duplicate.filename}`);}
async function resetViewerEdits(){cancelViewerCrop();const updated=await window.pigeon.resetInlineEdits(state.viewerAssetId),asset=state.library.assets.find((item)=>item.id===state.viewerAssetId);if(asset)Object.assign(asset,updated);elements.viewerImage.src=protectedUrl(updated.mediaUrl);renderInspector();renderInternalViewer();showToast('Original image restored');}
async function favoriteViewerAsset(){state.selectedId=state.viewerAssetId;await toggleSelectedFavourite();renderInternalViewer();}
function showViewerContextMenu(event){event.preventDefault();event.stopPropagation();const asset=state.library.assets.find((item)=>item.id===state.viewerAssetId),image=asset?.kind==='image';closeFloatingMenus();elements.contextMenu.innerHTML=`${image?'<button data-viewer-action="rotate-left"><span>Rotate left</span></button><button data-viewer-action="rotate-right"><span>Rotate right</span></button><button data-viewer-action="crop"><span>Crop…</span></button><button data-viewer-action="duplicate"><span>Duplicate</span></button><button data-viewer-action="reset" '+(asset.editedPath?'':'disabled')+'><span>Restore original</span></button><hr>':''}<button data-viewer-action="favorite"><span>${asset?.favorite?'Remove from favourites':'Add to favourites'}</span></button><button data-viewer-action="fit"><span>${state.viewerFit?'Zoom to actual size':'Fit to window'}</span></button><button data-viewer-action="open"><span>Open with default app</span></button>`;elements.contextMenu.querySelectorAll('[data-viewer-action]').forEach((button)=>button.addEventListener('click',async()=>{const action=button.dataset.viewerAction;elements.contextMenu.classList.add('hidden');if(action==='rotate-left')await rotateViewerAsset(-90);if(action==='rotate-right')await rotateViewerAsset(90);if(action==='crop')beginViewerCrop();if(action==='duplicate')await duplicateViewerAsset();if(action==='reset')await resetViewerEdits();if(action==='favorite')await favoriteViewerAsset();if(action==='fit')toggleViewerFit();if(action==='open')await window.pigeon.openAsset(state.viewerAssetId);}));elements.contextMenu.classList.remove('hidden');positionMenu(elements.contextMenu,event.clientX,event.clientY);}
elements.mediaViewer.addEventListener('contextmenu',showViewerContextMenu);
$('#map-globe-mode').addEventListener('click', () => { state.mapMode = 'globe'; state.mapGlobeZoom = 1; renderMap(); });
$('#map-street-mode').addEventListener('click', () => { state.mapMode = 'street'; state.mapZoom = Math.max(3, state.mapZoom); renderMap(); });
$('#map-cancel').addEventListener('click', closeMapView);
$('#map-save').addEventListener('click', async () => {
  if (!state.mapPoint) return;
  await window.pigeon.batchUpdateAssets(state.mapSelectionIds, { geo: state.mapPoint });
  for (const id of state.mapSelectionIds) { const asset = state.library.assets.find((item) => item.id === id); if (asset) asset.geo = { ...state.mapPoint, updatedAt: Date.now() }; }
  showToast(`Location set for ${state.mapSelectionIds.length} image${state.mapSelectionIds.length === 1 ? '' : 's'}`); closeMapView();
});
const applyMapSearchResult = (result) => {
  if (!result) return;
  state.mapPoint = { lat: result.lat, lon: result.lon, address: result.label }; state.mapCenter = { lat: result.lat, lon: result.lon }; state.mapMode = 'street'; $('#map-search-input').value = result.label; populateMapResults([]); renderMap();
};
const populateMapResults = (results) => {
  mapSuggestions = results;
  const list = $('#map-search-results'); list.innerHTML = results.map((result, index) => `<button type="button" class="map-search-result" role="option" data-map-result="${index}">${escapeHtml(result.label)}</button>`).join(''); list._results = results; list.classList.toggle('hidden', !results.length);
};
const runMapSearch = async () => {
  const query = $('#map-search-input').value.trim(); if (!query) return;
  const exact = mapSuggestions.find((result) => result.label.toLowerCase() === query.toLowerCase()); if (exact) { applyMapSearchResult(exact); return; }
  $('#map-search-button').textContent = 'Searching…';
  try { const results = await window.pigeon.searchMap(query); populateMapResults(results); if (!results.length) showToast('No matching address found'); else applyMapSearchResult(results[0]); }
  catch (error) { showToast(`${error.message} · You can still choose a point manually`); }
  finally { $('#map-search-button').textContent = 'Search'; }
};
const requestMapSuggestions = () => {
  clearTimeout(mapSearchTimer); const query = $('#map-search-input').value.trim(), generation = ++mapSuggestionGeneration;
  const exact = mapSuggestions.find((result) => result.label.toLowerCase() === query.toLowerCase()); if (exact) { applyMapSearchResult(exact); return; }
  if (query.length < 3) { populateMapResults([]); return; }
  mapSearchTimer = setTimeout(async () => { try { const results = await window.pigeon.suggestMap(query); if (generation === mapSuggestionGeneration) populateMapResults(results); } catch { /* Search button and manual selection remain available. */ } }, 400);
};
$('#map-search-button').addEventListener('click', runMapSearch);
$('#map-search-input').addEventListener('input', requestMapSuggestions);
$('#map-search-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); runMapSearch(); } else if (event.key === 'Escape') populateMapResults([]); });
$('#map-search-results').addEventListener('mousedown', (event) => { const option = event.target.closest('[data-map-result]'); if (!option) return; event.preventDefault(); applyMapSearchResult(event.currentTarget._results?.[Number(option.dataset.mapResult)]); });
document.addEventListener('pointerdown', (event) => { if (!event.target.closest('.map-search')) populateMapResults([]); });
elements.mapCanvas.addEventListener('pointerdown', (event) => {
  const rect = elements.mapCanvas.getBoundingClientRect();
  mapDrag = { x: event.clientX, y: event.clientY, moved: false, center: { ...state.mapCenter }, centerWorld: worldPixel(state.mapCenter.lat, state.mapCenter.lon, Math.round(state.mapZoom)), rect };
  elements.mapCanvas.setPointerCapture(event.pointerId); event.preventDefault();
});
elements.mapCanvas.addEventListener('pointermove', (event) => {
  if (!mapDrag) return; const dx = event.clientX - mapDrag.x, dy = event.clientY - mapDrag.y; if (Math.hypot(dx,dy) > 3) mapDrag.moved = true;
  if (!mapDrag.moved) return;
  if (state.mapMode === 'globe') state.mapCenter = { lat: Math.max(-80, Math.min(80, mapDrag.center.lat + dy * .25)), lon: ((mapDrag.center.lon - dx * .35 + 540) % 360) - 180 };
  else state.mapCenter = geoFromWorld(mapDrag.centerWorld.x - dx, mapDrag.centerWorld.y - dy, Math.round(state.mapZoom));
  scheduleMapRender();
});
elements.mapCanvas.addEventListener('pointerup', (event) => {
  if (!mapDrag) return; const drag = mapDrag; mapDrag = null; if (drag.moved) return;
  const rect = elements.mapCanvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
  let point;
  if (state.mapMode === 'globe') point = globePointFromCanvas(x,y,rect.width,rect.height);
  else { const center = worldPixel(state.mapCenter.lat,state.mapCenter.lon,Math.round(state.mapZoom)); point = geoFromWorld(center.x + x - rect.width/2, center.y + y - rect.height/2, Math.round(state.mapZoom)); }
  if (point) { state.mapPoint = { ...point, address: '' }; renderMap(); }
});
elements.mapCanvas.addEventListener('pointercancel', () => { mapDrag = null; });
elements.mapCanvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const rect = elements.mapCanvas.getBoundingClientRect(), cursorX = event.clientX - rect.left, cursorY = event.clientY - rect.top;
  if (state.mapMode === 'globe') {
    const cursorPoint = globePointFromCanvas(cursorX, cursorY, rect.width, rect.height);
    if (event.deltaY < 0 && state.mapGlobeZoom >= 1.55) {
      if (cursorPoint) state.mapCenter = { lat: cursorPoint.lat, lon: cursorPoint.lon };
      state.mapMode = 'street'; state.mapZoom = 3;
    } else {
      const oldZoom = state.mapGlobeZoom, newZoom = Math.max(.62, Math.min(1.65, oldZoom + (event.deltaY < 0 ? .12 : -.12)));
      if (cursorPoint && newZoom !== oldZoom) {
        const factor = 1 - oldZoom / newZoom, lonDelta = ((cursorPoint.lon - state.mapCenter.lon + 540) % 360) - 180;
        state.mapCenter = { lat: Math.max(-85, Math.min(85, state.mapCenter.lat + (cursorPoint.lat - state.mapCenter.lat) * factor)), lon: ((state.mapCenter.lon + lonDelta * factor + 540) % 360) - 180 };
      }
      state.mapGlobeZoom = newZoom;
    }
  } else {
    const oldZoom = Math.round(state.mapZoom), oldCenter = worldPixel(state.mapCenter.lat, state.mapCenter.lon, oldZoom);
    const cursorGeo = geoFromWorld(oldCenter.x + cursorX - rect.width / 2, oldCenter.y + cursorY - rect.height / 2, oldZoom);
    if (event.deltaY > 0 && oldZoom <= 2) { state.mapMode = 'globe'; state.mapGlobeZoom = 1.55; state.mapCenter = cursorGeo; }
    else {
      const newZoom = Math.max(2, Math.min(18, oldZoom + (event.deltaY < 0 ? 1 : -1))), cursorWorld = worldPixel(cursorGeo.lat, cursorGeo.lon, newZoom);
      state.mapZoom = newZoom; state.mapCenter = geoFromWorld(cursorWorld.x - cursorX + rect.width / 2, cursorWorld.y - cursorY + rect.height / 2, newZoom);
    }
  }
  renderMap();
}, { passive: false });
$('.viewer-stage').addEventListener('scroll', updateViewerMinimap, { passive: true });
$('.viewer-stage').addEventListener('pointerdown', (event) => {
  if (state.viewerFit || event.button !== 0 || event.target !== elements.viewerImage) return;
  const stage = $('.viewer-stage');
  viewerPanStart = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
  stage.classList.add('dragging'); stage.setPointerCapture(event.pointerId); event.preventDefault();
});
$('.viewer-stage').addEventListener('pointermove', (event) => {
  if (!viewerPanStart) return;
  const stage = $('.viewer-stage');
  stage.scrollLeft = viewerPanStart.left - (event.clientX - viewerPanStart.x);
  stage.scrollTop = viewerPanStart.top - (event.clientY - viewerPanStart.y);
});
const stopViewerPan = () => { viewerPanStart = null; $('.viewer-stage').classList.remove('dragging'); updateViewerMinimap(); };
$('.viewer-stage').addEventListener('pointerup', stopViewerPan);
$('.viewer-stage').addEventListener('pointercancel', stopViewerPan);
elements.viewerImage.addEventListener('load', () => { applyViewerImageFit(); updateViewerCropOverlay(); });
$('#viewer-crop-overlay').addEventListener('pointerdown', (event) => {
  if (!state.viewerCropMode) return;
  const content = viewerImageContentRect();
  viewerCropDrag = { startX: event.clientX, startY: event.clientY, crop: { ...state.viewerCrop }, handle: event.target.dataset.cropHandle || 'move', content };
  event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation();
});
$('#viewer-crop-overlay').addEventListener('pointermove', (event) => {
  if (!viewerCropDrag) return;
  const dx = (event.clientX - viewerCropDrag.startX) / Math.max(1, viewerCropDrag.content.width);
  const dy = (event.clientY - viewerCropDrag.startY) / Math.max(1, viewerCropDrag.content.height);
  const original = viewerCropDrag.crop, handle = viewerCropDrag.handle; let { x, y, width, height } = original;
  if (handle === 'move') { x = Math.max(0, Math.min(1 - width, original.x + dx)); y = Math.max(0, Math.min(1 - height, original.y + dy)); }
  else {
    if (handle.includes('w')) { const right = original.x + original.width; x = Math.max(0, Math.min(right - .05, original.x + dx)); width = right - x; }
    if (handle.includes('e')) width = Math.max(.05, Math.min(1 - original.x, original.width + dx));
    if (handle.includes('n')) { const bottom = original.y + original.height; y = Math.max(0, Math.min(bottom - .05, original.y + dy)); height = bottom - y; }
    if (handle.includes('s')) height = Math.max(.05, Math.min(1 - original.y, original.height + dy));
  }
  state.viewerCrop = { x, y, width, height }; updateViewerCropOverlay();
});
const stopViewerCropDrag = () => { viewerCropDrag = null; };
$('#viewer-crop-overlay').addEventListener('pointerup', stopViewerCropDrag);
$('#viewer-crop-overlay').addEventListener('pointercancel', stopViewerCropDrag);
$('.viewer-stage').addEventListener('wheel',(event)=>{if(elements.viewerImage.classList.contains('hidden'))return;event.preventDefault();const stage=$('.viewer-stage'),rect=stage.getBoundingClientRect(),cursorX=event.clientX-rect.left,cursorY=event.clientY-rect.top,oldScale=state.viewerFit?viewerFitScale():state.viewerZoom,imageRect=elements.viewerImage.getBoundingClientRect(),sourceX=(event.clientX-imageRect.left)/Math.max(oldScale,.001),sourceY=(event.clientY-imageRect.top)/Math.max(oldScale,.001),factor=Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.0025),next=Math.max(.02,Math.min(12,oldScale*factor));state.viewerFit=false;state.viewerZoom=next;elements.mediaViewer.classList.add('full-view');elements.viewerMinimap.classList.remove('hidden');$('#viewer-fit').textContent='Full';applyViewerImageFit();requestAnimationFrame(()=>{const newRect=elements.viewerImage.getBoundingClientRect();stage.scrollLeft+=newRect.left+sourceX*next-event.clientX;stage.scrollTop+=newRect.top+sourceY*next-event.clientY;updateViewerMinimap();});},{passive:false});
$('#viewer-line-numbers').addEventListener('change',(event)=>elements.viewerTextReader.classList.toggle('hide-line-numbers',!event.target.checked));
$('#contact-sheet-columns').addEventListener('input',renderContactSheet);$('#contact-sheet-rows').addEventListener('input',renderContactSheet);$('#contact-sheet-order').addEventListener('change',renderContactSheet);$('#contact-sheet-labels').addEventListener('click',(event)=>{state.contactSheetLabels=!state.contactSheetLabels;event.currentTarget.setAttribute('aria-pressed',String(state.contactSheetLabels));renderContactSheet();});$('#contact-sheet-export').addEventListener('click',async()=>{const rect=elements.contactSheetPages.getBoundingClientRect(),result=await window.pigeon.exportContactSheet($('#contact-sheet-export-format').value,{x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(Math.min(rect.height,window.innerHeight-rect.y))});if(result)showToast('Contact sheet exported');});$('#contact-sheet-print').addEventListener('click',()=>window.print());$('#contact-sheet-close').addEventListener('click',closeContactSheet);$('.sidebar').addEventListener('click',closeContactSheet);
$('#duplicate-similarity').addEventListener('input', (event) => {
  state.duplicateSimilarity = Number(event.target.value); $('#duplicate-similarity-value').textContent = `${state.duplicateSimilarity}%`; localStorage.setItem('pigeon.duplicateSimilarity', String(state.duplicateSimilarity));
  clearTimeout(refreshSimilarityGroups.sliderTimer); refreshSimilarityGroups.sliderTimer = setTimeout(() => refreshSimilarityGroups(), 180);
});
$('#show-all-duplicate-groups').addEventListener('click', () => selectView('duplicates', 'Duplicates'));
$('#close-annotations').addEventListener('click',closeAnnotationEditor);
$$('[data-tool]').forEach((button) => button.addEventListener('click', () => { state.annotationTool = button.dataset.tool; }));
$('#undo-annotation').addEventListener('click', () => { if (state.workingEdits.crop) state.workingEdits.crop = null; else state.workingAnnotations.pop(); renderAnnotations(); });
const previewEditRotation = () => { elements.annotationStage.style.transform = `rotate(${state.workingEdits.rotate}deg) scale(${state.workingEdits.rotate % 180 ? .72 : 1}) scaleX(${state.workingEdits.flip ? -1 : 1})`; };
$('#rotate-left').addEventListener('click', () => { state.workingEdits.rotate = (state.workingEdits.rotate + 270) % 360; previewEditRotation(); });
$('#rotate-right').addEventListener('click', () => { state.workingEdits.rotate = (state.workingEdits.rotate + 90) % 360; previewEditRotation(); });
$('#flip-image').addEventListener('click', () => { state.workingEdits.flip = !state.workingEdits.flip; previewEditRotation(); });
$('#edit-brightness').addEventListener('input', (event) => { state.workingEdits.brightness = Number(event.target.value) / 100; elements.annotationStage.style.filter = `brightness(${state.workingEdits.brightness})`; });
elements.annotationStage.addEventListener('pointerdown', (event) => {
  if (!['rect', 'crop'].includes(state.annotationTool)) return;
  const rect = elements.annotationStage.getBoundingClientRect(); annotationStart = { x: event.clientX - rect.left, y: event.clientY - rect.top };
});
elements.annotationStage.addEventListener('pointerup', async (event) => {
  const asset = state.library.assets.find((item) => item.id === state.selectedId);
  if (!asset) return;
  const rect = elements.annotationStage.getBoundingClientRect();
  if (state.annotationTool === 'text') {
    const text = await requestText({ title: 'Add Annotation Text', label: 'Text', confirmText: 'Add' });
    if (text) state.workingAnnotations.push({ type: 'text', text, x: (event.clientX - rect.left) / rect.width * asset.width, y: (event.clientY - rect.top) / rect.height * asset.height, size: 30, color: $('#annotation-color').value });
  } else if (annotationStart) {
    const end = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const region = { x: Math.min(annotationStart.x, end.x) / rect.width * asset.width, y: Math.min(annotationStart.y, end.y) / rect.height * asset.height, width: Math.abs(end.x - annotationStart.x) / rect.width * asset.width, height: Math.abs(end.y - annotationStart.y) / rect.height * asset.height };
    if (state.annotationTool === 'crop') state.workingEdits.crop = region;
    else state.workingAnnotations.push({ type: 'rect', ...region, stroke: 4, color: $('#annotation-color').value });
    annotationStart = null;
  }
  renderAnnotations();
});
$('#save-annotations').addEventListener('click',async()=>{const updated=await window.pigeon.updateAsset(state.selectedId,{annotations:state.workingAnnotations}),asset=state.library.assets.find((item)=>item.id===state.selectedId);if(asset&&updated)Object.assign(asset,updated);closeAnnotationEditor();showToast('Annotations saved');});
$('#export-annotations').addEventListener('click', async () => { const target = await window.pigeon.exportAnnotated(state.selectedId, state.workingAnnotations, state.workingEdits); if (target) showToast(`Exported ${target}`); });
$('#subfolder-content-toggle').addEventListener('click', () => { state.includeSubfolderContent = !state.includeSubfolderContent; localStorage.setItem('pigeon.includeSubfolderContent', String(state.includeSubfolderContent)); resetRenderLimit(); render(); });
$('#settings-button').addEventListener('click', openSettings);
$('.brand-menu').addEventListener('click', (event) => {
  event.stopPropagation(); const switcher = $('#portfolio-switcher'), opening = switcher.classList.contains('hidden');
  if (!opening) { closePortfolioSwitcher(); return; }
  $('#portfolio-switcher-search').value = ''; renderPortfolioSwitcher(); switcher.classList.remove('hidden'); event.currentTarget.setAttribute('aria-expanded', 'true'); setTimeout(() => $('#portfolio-switcher-search').focus(), 0);
});
$('.brand-menu').addEventListener('keydown', (event) => { if (event.target !== event.currentTarget) return; if (['Enter', ' ', 'ArrowDown'].includes(event.key)) { event.preventDefault(); event.currentTarget.click(); } else if (event.key === 'Escape') closePortfolioSwitcher(); });
$('#portfolio-switcher').addEventListener('click', (event) => event.stopPropagation());
$('#close-portfolio-switcher').addEventListener('click', closePortfolioSwitcher);
$('#portfolio-switcher-search').addEventListener('input', (event) => renderPortfolioSwitcher(event.target.value));
$('#portfolio-switcher-search').addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); closePortfolioSwitcher(); } });
$('#portfolio-switcher-list').addEventListener('click', (event) => { const item = event.target.closest('[data-portfolio-id]'); if (item) switchPortfolioTo(item.dataset.portfolioId); });
$('#quick-create-portfolio').addEventListener('click', async () => {
  const name = await requestText({ title: 'Create a Portfolio', message: 'Enter a name for the portfolio. Each portfolio keeps its locations, collections, and tags separate.', label: 'Portfolio name', placeholder: 'Portfolio name', confirmText: 'Create Portfolio' }); if (!name?.trim()) return;
  try { const portfolio = await window.pigeon.createPortfolio(name.trim()); state.library.portfolios.push(portfolio); renderPortfolioManager(); await switchPortfolioTo(portfolio.id); } catch (error) { showToast(error.message); }
});
$('#manage-portfolios').addEventListener('click', () => { closePortfolioSwitcher(); openSettings(); });
document.addEventListener('click', closePortfolioSwitcher);
$('#new-portfolio').addEventListener('click', async () => {
  const name = await requestText({ title: 'Create a Portfolio', message: 'Enter a name for the portfolio. Each portfolio keeps its locations, collections, and tags separate.', label: 'Portfolio name', placeholder: 'Portfolio name', confirmText: 'Create Portfolio' }); if (!name?.trim()) return;
  try { const portfolio = await window.pigeon.createPortfolio(name.trim()); state.library.portfolios.push(portfolio); renderPortfolioManager(); $('#portfolio-select').value = portfolio.id; } catch (error) { showToast(error.message); }
});
$('#add-existing-portfolio').addEventListener('click',async()=>{try{const portfolio=await window.pigeon.addExistingPortfolio();if(!portfolio)return;if(!state.library.portfolios.some((item)=>item.id===portfolio.id))state.library.portfolios.push(portfolio);renderPortfolioManager();renderPortfolioSwitcher();$('#portfolio-select').value=portfolio.id;showToast(`${portfolio.name} added`);}catch(error){showToast(error.message);}});
$('#rename-portfolio').addEventListener('click', async () => {
  const id = $('#portfolio-select').value; const current = state.library.portfolios.find((item) => item.id === id); if (!current) return;
  const name = await requestText({ title: 'Rename Portfolio', label: 'Portfolio name', value: current.name, confirmText: 'Rename' }); if (!name?.trim()) return;
  try { const updated = await window.pigeon.renamePortfolio(id, name.trim()); current.name = updated.name; renderPortfolioManager(); $('#portfolio-select').value = id; } catch (error) { showToast(error.message); }
});
$('#switch-portfolio').addEventListener('click', () => switchPortfolioTo($('#portfolio-select').value));
$('#delete-portfolio').addEventListener('click', async () => {
  const id = $('#portfolio-select').value; const current = state.library.portfolios.find((item) => item.id === id); if (!current || !(await requestConfirmation({ title: 'Delete Portfolio', message: `Delete “${current.name}”? Its portfolio index will be removed; original files remain unchanged.`, confirmText: 'Delete' }))) return;
  try { await window.pigeon.removePortfolio(id); state.library.portfolios = state.library.portfolios.filter((item) => item.id !== id); renderPortfolioManager(); } catch (error) { showToast(error.message); }
});
$$('[data-preference-page]').forEach((button) => button.addEventListener('click', () => { $$('[data-preference-page]').forEach((item) => item.classList.toggle('active', item === button)); $$('[data-preference-content]').forEach((page) => page.classList.toggle('active', page.dataset.preferenceContent === button.dataset.preferencePage)); $('#preferences-title').textContent = button.textContent.replace(/Local/g, '').trim(); }));
$('#preferences-search').addEventListener('input', (event) => { const query = event.target.value.toLowerCase(); $$('[data-preference-page]').forEach((button) => button.classList.toggle('hidden', Boolean(query) && !button.textContent.toLowerCase().includes(query))); });
$('#tree-level-colors').addEventListener('input',(event)=>{const row=event.target.closest('[data-tree-level-color]');if(!row||event.target.type!=='color')return;preferences.treeLevelColors[Number(row.dataset.treeLevelColor)]=validTreeColor(event.target.value);row.querySelector('code').textContent=event.target.value;applyTreeLevelColors();renderSidebar(false);});
$('#tree-level-colors').addEventListener('click',(event)=>{const button=event.target.closest('[data-delete-tree-level]');if(!button||preferences.treeLevelColors.length<=1)return;preferences.treeLevelColors.splice(Number(button.dataset.deleteTreeLevel),1);applyTreeLevelColors();renderTreeLevelColorSettings();renderSidebar(false);});
$('#add-tree-level-color').addEventListener('click',()=>{const index=preferences.treeLevelColors.length;preferences.treeLevelColors.push(defaultTreeLevelColors[index%defaultTreeLevelColors.length]);applyTreeLevelColors();renderTreeLevelColorSettings();renderSidebar(false);});
$('#apply-preferences').addEventListener('click', () => applyPreferences(false));
$('#save-preferences').addEventListener('click', () => { applyPreferences(true); $('#settings-dialog').close(); });
$('#choose-auto-import-folder').addEventListener('click', async () => { const folder = await window.pigeon.chooseAutoImportFolder(); if (folder) { preferences.autoImportFolder = folder; $('#auto-import-folder').textContent = folder; } });
$('#rebuild-ai-index').addEventListener('click', async () => { showToast('Rebuilding the local visual index…'); const ids = state.library.assets.filter((asset) => asset.kind === 'image').map((asset) => asset.id); await window.pigeon.autoTag(ids); showToast('Local visual index rebuilt'); });
$('#add-model-provider').addEventListener('click', async () => { const endpoint = await requestText({ title: 'Add Local Model Provider', label: 'Local endpoint', placeholder: 'http://127.0.0.1:11434', confirmText: 'Add' }); if (endpoint) { const providers = JSON.parse(localStorage.getItem('pigeon.localModelProviders') || '[]'); providers.push(endpoint); localStorage.setItem('pigeon.localModelProviders', JSON.stringify([...new Set(providers)])); showToast('Local model provider saved'); } });
$('#import-model-config').addEventListener('click', () => showToast('Model configuration import is available through the plugin folder'));
$('#regenerate-developer-token').addEventListener('click', () => { const token = crypto.randomUUID().replace(/-/g, ''); localStorage.setItem('pigeon.developerToken', token); $('#developer-token').value = token; });
$('#close-settings').addEventListener('click', () => $('#settings-dialog').close());
$('#about-dialog').addEventListener('click',closeAboutView);
$('#about-github').addEventListener('click',()=>window.pigeon.openExternal($('#about-dialog').dataset.repository));
window.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!$('#about-dialog').classList.contains('hidden')){event.preventDefault();closeAboutView();}},true);
function revealShortcutPressed(event){const configured=String(preferences.thumbnailEffectRevealKey||'Alt').replace('Control','Ctrl').split('+'),key=configured.at(-1),eventKey=event.key==='Control'?'Ctrl':event.key==='Meta'?'Meta':event.key.length===1?event.key.toUpperCase():event.key,required=new Set(configured.slice(0,-1));return eventKey===key&&(!required.has('Ctrl')||event.ctrlKey)&&(!required.has('Alt')||event.altKey)&&(!required.has('Shift')||event.shiftKey)&&(!required.has('Meta')||event.metaKey);}
const updateThumbnailRevealModifier=(event,pressed)=>{if(!revealShortcutPressed(event))return;state.thumbnailEffectRevealPressed=pressed;document.body.classList.toggle('thumbnail-effect-reveal',pressed);};window.addEventListener('keydown',(event)=>updateThumbnailRevealModifier(event,true),true);window.addEventListener('keyup',(event)=>updateThumbnailRevealModifier(event,false),true);window.addEventListener('blur',()=>{state.thumbnailEffectRevealPressed=false;document.body.classList.remove('thumbnail-effect-reveal');});
$('#encrypt-locked-folders').addEventListener('change', (event) => { state.encryptLockedFolders = event.target.checked; localStorage.setItem('pigeon.encryptLockedFolders', String(state.encryptLockedFolders)); });
$('#confirm-folder-moves').addEventListener('change', (event) => { state.confirmFolderMoves = event.target.checked; localStorage.setItem('pigeon.confirmFolderMoves', String(state.confirmFolderMoves)); });
$$('[id^="thumbnail-title-line-"]').forEach((select, index) => select.addEventListener('change', (event) => { state.thumbnailTitleLines[index] = event.target.value; localStorage.setItem(`pigeon.thumbnailTitleLine${index + 1}`, event.target.value); renderGrid(); }));
$('#clear-favorite-shortcut').addEventListener('click', () => {
  state.favoriteShortcut = ''; localStorage.removeItem('pigeon.favoriteShortcut'); $('#favorite-shortcut').value = '';
});
$('#clear-location-shortcut').addEventListener('click', () => { state.locationShortcut = ''; localStorage.removeItem('pigeon.locationShortcut'); $('#location-shortcut').value = ''; });
$('#clear-thumbnail-effect-shortcut').addEventListener('click',()=>{state.thumbnailEffectShortcut='B';localStorage.setItem('pigeon.thumbnailEffectShortcut','B');$('#thumbnail-effect-shortcut').value='B';});
$('#clear-thumbnail-effect-reveal-shortcut').addEventListener('click',()=>{preferences.thumbnailEffectRevealKey='Alt';$('#thumbnail-effect-reveal-shortcut').value='Alt';applyPreferences(true);});
$('#favorite-shortcut').addEventListener('keydown', (event) => {
  event.preventDefault(); event.stopPropagation();
  if (event.key === 'Backspace' || event.key === 'Delete') { state.favoriteShortcut = ''; localStorage.removeItem('pigeon.favoriteShortcut'); event.currentTarget.value = ''; return; }
  const shortcut = shortcutFromEvent(event);
  if (!shortcut) return;
  state.favoriteShortcut = shortcut; localStorage.setItem('pigeon.favoriteShortcut', shortcut); event.currentTarget.value = shortcut;
});
$('#location-shortcut').addEventListener('keydown', (event) => {
  event.preventDefault(); event.stopPropagation();
  if (event.key === 'Backspace' || event.key === 'Delete') { state.locationShortcut = ''; localStorage.removeItem('pigeon.locationShortcut'); event.currentTarget.value = ''; return; }
  const shortcut = shortcutFromEvent(event); if (!shortcut) return;
  state.locationShortcut = shortcut; localStorage.setItem('pigeon.locationShortcut', shortcut); event.currentTarget.value = shortcut;
});
$('#thumbnail-effect-shortcut').addEventListener('focus',(event)=>event.currentTarget.select());$('#thumbnail-effect-shortcut').addEventListener('keydown',(event)=>{event.preventDefault();event.stopPropagation();if(['Control','Shift','Alt','Meta'].includes(event.key))return;if(event.key==='Backspace'||event.key==='Delete'){state.thumbnailEffectShortcut='';localStorage.removeItem('pigeon.thumbnailEffectShortcut');event.currentTarget.value='';showToast('Thumbnail effect shortcut cleared');return;}const shortcut=shortcutFromEvent(event);if(!shortcut)return;state.thumbnailEffectShortcut=shortcut;localStorage.setItem('pigeon.thumbnailEffectShortcut',shortcut);event.currentTarget.value=shortcut;showToast(`Thumbnail effect shortcut set to ${shortcut}`);});
$('#thumbnail-effect-reveal-shortcut').addEventListener('focus',(event)=>event.currentTarget.select());$('#thumbnail-effect-reveal-shortcut').addEventListener('keydown',(event)=>{event.preventDefault();event.stopPropagation();if(event.key==='Backspace'||event.key==='Delete'){preferences.thumbnailEffectRevealKey='';event.currentTarget.value='';applyPreferences(true);return;}const shortcut=['Control','Shift','Alt','Meta'].includes(event.key)?{Control:'Ctrl',Shift:'Shift',Alt:'Alt',Meta:'Meta'}[event.key]:shortcutFromEvent(event);if(!shortcut)return;preferences.thumbnailEffectRevealKey=shortcut;event.currentTarget.value=shortcut;applyPreferences(true);});
$('#thumbnail-effect-strength').addEventListener('input',(event)=>{preferences.thumbnailEffectStrength=Number(event.currentTarget.value);applyThumbnailEffectPreferences();});document.querySelector('[data-pref="thumbnailEffectMode"]').addEventListener('change',()=>{collectPreferenceInputs();preferences.thumbnailEffectStrength=preferences.thumbnailEffectMode==='pixelate'?50:12;applyThumbnailEffectPreferences();});
$('#feature-shortcut-search').addEventListener('input',(event)=>renderBuiltInShortcuts(event.currentTarget.value));
$('#new-shortcut-action').addEventListener('click',()=>openShortcutActionDialog());
$('#close-shortcut-action').addEventListener('click',closeShortcutActionDialog);$('#cancel-shortcut-action').addEventListener('click',closeShortcutActionDialog);
$('#shortcut-action-key').addEventListener('keydown',(event)=>{event.preventDefault();event.stopPropagation();if(event.key==='Backspace'||event.key==='Delete'){event.currentTarget.value='';return;}const shortcut=shortcutFromEvent(event);if(shortcut)event.currentTarget.value=shortcut;});
$('#add-shortcut-step').addEventListener('click',()=>renderShortcutActionSteps([...readShortcutActionSteps(),{type:'addTags',value:''}]));
$('#shortcut-action-steps').addEventListener('change',(event)=>{if(!event.target.matches('[data-shortcut-step-type]'))return;const steps=readShortcutActionSteps(),index=Number(event.target.dataset.shortcutStepType);steps[index]={type:event.target.value,value:''};renderShortcutActionSteps(steps);});
$('#shortcut-action-steps').addEventListener('click',(event)=>{const button=event.target.closest('[data-remove-shortcut-step]');if(!button)return;const steps=readShortcutActionSteps();steps.splice(Number(button.dataset.removeShortcutStep),1);renderShortcutActionSteps(steps);});
$('#save-shortcut-action').addEventListener('click',()=>{const name=$('#shortcut-action-name').value.trim(),shortcut=$('#shortcut-action-key').value,steps=readShortcutActionSteps();if(!name){showToast('Enter an action name');return;}if(!steps.length){showToast('Add at least one step');return;}const duplicate=shortcut&&shortcutActions.some((action)=>action.shortcut===shortcut&&action.id!==editingShortcutActionId);if(duplicate){showToast('That shortcut is already assigned');return;}const action={id:editingShortcutActionId||crypto.randomUUID(),name,shortcut,steps};const index=shortcutActions.findIndex((item)=>item.id===action.id);if(index>=0)shortcutActions[index]=action;else shortcutActions.push(action);persistShortcutActions();renderShortcutActions();closeShortcutActionDialog();showToast('Shortcut action saved');});
$('#shortcut-actions-list').addEventListener('click',(event)=>{const edit=event.target.closest('[data-edit-shortcut-action]'),remove=event.target.closest('[data-remove-shortcut-action]');if(edit)openShortcutActionDialog(shortcutActions.find((action)=>action.id===edit.dataset.editShortcutAction));if(remove){shortcutActions=shortcutActions.filter((action)=>action.id!==remove.dataset.removeShortcutAction);persistShortcutActions();renderShortcutActions();}});
function showQuickActions(anchor){closeFloatingMenus();elements.appSubmenu.innerHTML=`<div class="quick-actions-heading"><strong>Actions</strong><button data-quick-new-action>＋ New Action</button></div>${shortcutActions.length?shortcutActions.map((action)=>`<div class="quick-action-row"><button data-quick-action="${action.id}"><span>${escapeHtml(action.name)}</span>${action.shortcut?`<kbd>${escapeHtml(action.shortcut)}</kbd>`:''}</button><button class="quick-action-edit" data-quick-edit="${action.id}" title="Edit ${escapeHtml(action.name)}">✎</button></div>`).join(''):'<p class="quick-actions-empty">Combine tags, collections, ratings and metadata into reusable actions.</p>'}`;elements.appSubmenu.querySelector('[data-quick-new-action]')?.addEventListener('click',()=>{elements.appSubmenu.classList.add('hidden');openShortcutActionDialog();});elements.appSubmenu.querySelectorAll('[data-quick-action]').forEach((button)=>button.addEventListener('click',()=>{elements.appSubmenu.classList.add('hidden');runShortcutAction(shortcutActions.find((action)=>action.id===button.dataset.quickAction));}));elements.appSubmenu.querySelectorAll('[data-quick-edit]').forEach((button)=>button.addEventListener('click',()=>{elements.appSubmenu.classList.add('hidden');openShortcutActionDialog(shortcutActions.find((action)=>action.id===button.dataset.quickEdit));}));elements.appSubmenu.classList.remove('hidden');const rect=anchor.getBoundingClientRect();elements.appSubmenu.style.left=`${Math.min(rect.left,window.innerWidth-elements.appSubmenu.offsetWidth-8)}px`;elements.appSubmenu.style.top=`${rect.bottom+4}px`;}
$('#quick-action-button').addEventListener('click',(event)=>{event.stopPropagation();showQuickActions(event.currentTarget);});
$('#pin-button').addEventListener('click', async (event) => {
  const pinned = await window.pigeon.toggleAlwaysOnTop();
  event.currentTarget.classList.toggle('selected', pinned);
  showToast(pinned ? 'Pigeon will stay on top' : 'Always on top disabled');
});
$('#sidebar-collapse').addEventListener('click', () => showToast('Portfolio navigation'));
document.addEventListener('keydown', (event) => {
  const editing = event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]');
  if(!editing&&event.key==='Escape'&&!elements.contactSheetView.classList.contains('hidden')){event.preventDefault();closeContactSheet();return;}
  const shortcutAction=!editing&&shortcutActions.find((action)=>action.shortcut&&action.shortcut===shortcutFromEvent(event));if(shortcutAction){event.preventDefault();runShortcutAction(shortcutAction).catch((error)=>showToast(error.message));return;}
  if (!editing && event.key === 'F2' && state.selectedId && !isInternalViewerOpen()) { event.preventDefault(); beginInspectorFilenameRename(); return; }
  if (!editing && state.viewerCropMode && event.key === 'Enter') { event.preventDefault(); applyViewerCrop(); return; }
  if (!editing && state.viewerCropMode && event.key === 'Escape') { event.preventDefault(); cancelViewerCrop(); return; }
  if(!editing&&isInternalViewerOpen()&&['Escape','Enter'].includes(event.key)){event.preventDefault();closeInternalViewer();return;}
  if (!editing && state.mapOpen && event.key === 'Escape') { event.preventDefault(); closeMapView(); return; }
  const commandKey = event.metaKey || event.ctrlKey;
  if(!editing&&event.ctrlKey&&event.altKey&&/^[1-9]$/.test(event.key)){event.preventDefault();window.pigeon.centerWindowOnDisplay(Number(event.key)-1).then((exact)=>showToast(exact?`Moved to display ${event.key}`:'Requested display unavailable · moved to primary display'));return;}
  if(!editing&&commandKey&&event.key.toLowerCase()==='a'){event.preventDefault();const ids=filteredAssets().map((asset)=>asset.id);state.selectedIds=new Set(ids);state.selectedId=ids[0]||null;state.selectionAnchorId=state.selectedId;updateCardSelectionStyles();renderInspector();showToast(`${ids.length} item${ids.length===1?'':'s'} selected`);return;}
  if(!editing&&commandKey&&event.key.toLowerCase()==='c'){event.preventDefault();const ids=state.selectedIds.size?[...state.selectedIds]:state.selectedId?[state.selectedId]:[];window.pigeon.copyAssets(ids).then((result)=>showToast(`${result.copied} file${result.copied===1?'':'s'} copied to clipboard`)).catch((error)=>showToast(error.message));return;}
  if(!editing&&commandKey&&event.key.toLowerCase()==='v'){event.preventDefault();window.pigeon.pasteAssets().then((result)=>showToast(result.imported?`${result.imported} file${result.imported===1?'':'s'} pasted into Needs Organization`:'Clipboard does not contain files or an image')).catch((error)=>showToast(error.message));return;}
  if (commandKey && (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd')) { event.preventDefault(); applyWindowZoom(state.uiZoom + .1); return; }
  if (commandKey && (event.key === '-' || event.code === 'NumpadSubtract')) { event.preventDefault(); applyWindowZoom(state.uiZoom - .1); return; }
  if (commandKey && event.key === '0') { event.preventDefault(); applyWindowZoom(1); return; }
  if (!editing && state.favoriteShortcut && shortcutFromEvent(event) === state.favoriteShortcut) { event.preventDefault(); toggleSelectedFavourite(); return; }
  if (!editing && state.locationShortcut && shortcutFromEvent(event) === state.locationShortcut) { event.preventDefault(); openMapView(isInternalViewerOpen() ? [state.viewerAssetId] : [...state.selectedIds]); return; }
  const builtInShortcut=!editing?shortcutFromEvent(event):'';
  const viewShortcuts={'Ctrl+1':['all','All'],'Ctrl+2':['uncategorized','Uncategorized'],'Ctrl+3':['untagged','Untagged'],'Ctrl+4':['recent','Recently added'],'Ctrl+6':['tags','All Tags'],'Ctrl+7':['trash','Trash']};if(viewShortcuts[builtInShortcut]){event.preventDefault();selectView(...viewShortcuts[builtInShortcut]);return;}
  const facetShortcuts={'Alt+F':'folder','Alt+T':'tags','Alt+C':'color','Alt+S':'shape','Alt+R':'rating','Alt+E':'types'};if(facetShortcuts[builtInShortcut]){event.preventDefault();const facet=facetShortcuts[builtInShortcut],anchor=document.querySelector(`[data-facet="${facet}"]`);renderFacetPopover(facet,anchor);return;}
  if(builtInShortcut==='Ctrl+Shift+Alt+F'){event.preventDefault();$('#clear-filters').click();return;}
  if(['Alt+1','Alt+2','Alt+4'].includes(builtInShortcut)){event.preventDefault();state.layout={'Alt+1':'grid','Alt+2':'justified','Alt+4':'list'}[builtInShortcut];localStorage.setItem('pigeon.layout',state.layout);updateLayoutButton();renderGrid();return;}
  if(builtInShortcut==='Ctrl+Alt+1'){event.preventDefault();$('.app-shell').classList.toggle('sidebar-collapsed');return;}
  if(builtInShortcut==='Ctrl+Alt+2'){event.preventDefault();$('#inspector-toggle').click();return;}
  if(builtInShortcut==='Ctrl+Enter'&&state.selectedId){event.preventDefault();window.pigeon.revealAsset(state.selectedId);return;}
  if(builtInShortcut==='Shift+Enter'&&state.selectedId){event.preventDefault();window.pigeon.openAsset(state.selectedId);return;}
  if(builtInShortcut==='Ctrl+Alt+R'&&state.selectedIds.size){event.preventDefault();window.pigeon.rebuildThumbnails([...state.selectedIds]).then((result)=>{const updates=new Map((result.assets||[]).map((asset)=>[asset.id,asset]));for(const asset of state.library.assets)if(updates.has(asset.id))Object.assign(asset,updates.get(asset.id));reconcileThumbnailCards([...updates.keys()]);showToast(`${result.rebuilt} thumbnails rebuilt`);}).catch((error)=>showToast(error.message));return;}
  if(builtInShortcut==='Ctrl+T'&&state.selectedIds.size){event.preventDefault();$('#batch-tag').click();return;}
  if(!editing&&state.thumbnailEffectShortcut&&shortcutFromEvent(event)===state.thumbnailEffectShortcut){event.preventDefault();toggleThumbnailEffect().catch((error)=>showToast(error.message));return;}
  if (state.mapOpen) return;
  if (!editing && !commandKey && event.code === 'Space') { if(isInternalViewerOpen()||preferences.spacebar==='preview'){event.preventDefault();if(isInternalViewerOpen())closeInternalViewer();else if(state.selectedId)openInternalViewer(state.selectedId);return;} }
  if (!editing && !commandKey && !event.altKey && event.key === 'Delete' && !isInternalViewerOpen()) { event.preventDefault(); handleDeleteSelection().catch((error)=>showToast(error.message)); return; }
  if (!editing && !commandKey && !event.altKey && /^[1-5]$/.test(event.key)) {
    const assetId = isInternalViewerOpen() ? state.viewerAssetId : state.selectedId;
    const asset = state.library.assets.find((item) => item.id === assetId);
    if (asset && ['image', 'video'].includes(asset.kind)) { event.preventDefault(); state.selectedId = asset.id; updateSelected({ rating: Number(event.key) }); }
    return;
  }
  if (!editing && commandKey && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    const ids = isInternalViewerOpen() ? [state.viewerAssetId] : [...state.selectedIds];
    Promise.all(ids.filter((id) => state.library.assets.find((asset) => asset.id === id)?.kind === 'image').map((id) => window.pigeon.duplicateAsset(id))).catch((error) => showToast(error.message));
    return;
  }
  if (commandKey && event.shiftKey && event.key.toLowerCase() === 'j') { event.preventDefault(); openDiagnosticsConsole(); return; }
  if (commandKey && event.key.toLowerCase() === 'k') { event.preventDefault(); elements.search.focus(); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') { event.preventDefault(); addFolder(); }
  if (!editing && isInternalViewerOpen() && event.key === '`') { event.preventDefault(); toggleViewerFit(); }
  else if (!editing && isInternalViewerOpen() && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); navigateViewer(event.key === 'ArrowLeft' ? -1 : 1); }
  else if (!editing && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); navigateAssets(event.key); }
  else if(!editing&&event.key==='Home'){event.preventDefault();elements.gridWrap.scrollTo({top:0,behavior:'smooth'});}
  else if(!editing&&event.key==='End'){event.preventDefault();elements.gridWrap.scrollTo({top:elements.gridWrap.scrollHeight,behavior:'smooth'});}
  if (!editing && !isInternalViewerOpen() && (event.key === 'PageDown' || event.key === 'PageUp')) { event.preventDefault(); elements.gridWrap.scrollBy({ top: (event.key === 'PageDown' ? 1 : -1) * elements.gridWrap.clientHeight * 0.85, behavior: 'smooth' }); }
  if (event.key === 'Escape') { if (isInternalViewerOpen()) closeInternalViewer(); elements.addMenu.classList.add('hidden'); closeFloatingMenus(); }
});

const backgroundTasks = new Map();
let backgroundTaskPortfolioId = null;
function renderBackgroundProgress() {
  const tasks = [...backgroundTasks.values()].filter((task) => !task.portfolioId || task.portfolioId === state.library.activePortfolioId).sort((a,b)=>b.updatedAt-a.updatedAt), panel = elements.backgroundProgress;
  panel.classList.toggle('hidden', !tasks.length); if (!tasks.length) return;
  const total = tasks.reduce((sum,task)=>sum+task.total,0), completed = tasks.reduce((sum,task)=>sum+Math.min(task.completed,task.total||task.completed),0), indeterminate = tasks.some((task)=>!task.total);
  $('#background-progress-label').textContent = tasks.length > 1 ? `${tasks.length} background operations` : tasks[0].label;
  $('#background-progress-detail').textContent = tasks.length > 1 ? tasks.map((task)=>task.detail||task.label).filter(Boolean).slice(0,2).join(' · ') : tasks[0].detail;
  panel.classList.toggle('indeterminate', indeterminate); $('#background-progress-fill').style.width = indeterminate ? '32%' : `${total ? Math.max(2, Math.min(100, completed/total*100)) : 100}%`;
}
window.pigeon.onBackgroundProgress((task) => {
  if (task.portfolioId && state.library.activePortfolioId && task.portfolioId !== state.library.activePortfolioId) return;
  const terminal = task.done || (task.total > 0 && task.completed >= task.total); backgroundTasks.set(task.id, { ...task, done: terminal }); renderBackgroundProgress();
  if (terminal) setTimeout(() => { if (backgroundTasks.get(task.id)?.updatedAt === task.updatedAt) { backgroundTasks.delete(task.id); renderBackgroundProgress(); } }, 1400);
});
let diagnosticsEntries = [], diagnosticsLevel = 'all', consoleTab = 'logs', telemetryTimer = null;
function renderDiagnosticsConsole() {
  const entries = diagnosticsEntries.filter((entry) => diagnosticsLevel === 'all' || entry.level === diagnosticsLevel), list = $('#diagnostics-list');
  $('#diagnostics-summary').textContent = `${diagnosticsEntries.filter((entry)=>entry.level==='error').length} errors · ${diagnosticsEntries.filter((entry)=>entry.level==='warning').length} warnings · ${diagnosticsEntries.length} total`;
  list.innerHTML = entries.length ? entries.slice().reverse().map((entry) => `<div class="diagnostic-row ${escapeHtml(entry.level)}" data-diagnostic-id="${entry.id}"><span class="diagnostic-time">${new Date(entry.timestamp).toLocaleTimeString()}</span><span class="diagnostic-level">${escapeHtml(entry.level)}</span><span class="diagnostic-portfolio">${escapeHtml(entry.portfolioId || 'application')}</span><span class="diagnostic-message">${escapeHtml(entry.message)}${entry.context ? `<small class="diagnostic-context">${escapeHtml(entry.context)}</small>` : ''}</span><span class="diagnostic-row-actions"><button data-copy-diagnostic title="Copy log details" aria-label="Copy log details">${iconSvg('duplicate')}</button><button data-remove-diagnostic title="Remove log" aria-label="Remove log">×</button></span></div>`).join('') : '<div class="diagnostics-empty">No diagnostics recorded for this filter.</div>';
}
function formatTelemetryBytes(value) { const bytes = Number(value) || 0; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`; if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`; return `${(bytes / 1024 ** 3).toFixed(2)} GB`; }
function renderTelemetry(snapshot) { const collective = snapshot.collective || {}; $('#diagnostics-summary').textContent = `${collective.activeThreads || 0} worker threads · ${(collective.cpu || 0).toFixed(1)}% CPU · ${formatTelemetryBytes(collective.memoryBytes)} memory`; $('#telemetry-summary').innerHTML = [['Threads',collective.activeThreads || 0],['Files',`${collective.filesCompleted || 0} / ${collective.filesTotal || 0}`],['CPU',`${(collective.cpu || 0).toFixed(1)}% / ${collective.cpuLimit || 30}%`],['GPU',`${(collective.gpuCpu || 0).toFixed(1)}%`],['Memory',formatTelemetryBytes(collective.memoryBytes)],['GPU memory',formatTelemetryBytes(collective.gpuMemoryBytes)]].map(([label,value]) => `<div class="telemetry-metric"><small>${label}</small><strong>${value}</strong></div>`).join(''); const rows = [...(snapshot.threads || []).map((thread) => ({ ...thread, label: `${thread.type} · Thread ${thread.threadId}`, detail: thread.currentFile || thread.portfolioId, gpu: 0 })), ...(snapshot.processes || []).map((process) => ({ ...process, label: `${process.type} · PID ${process.pid}`, detail: 'Electron process', filesCompleted: 0, filesTotal: 0, gpu: String(process.type).toLowerCase().includes('gpu') ? process.cpu : 0, startedAt: snapshot.timestamp }))]; $('#telemetry-list').innerHTML = rows.length ? rows.map((row) => `<div class="telemetry-row"><span class="telemetry-thread"><strong>${escapeHtml(row.label)}</strong><small title="${escapeHtml(row.detail || '')}">${escapeHtml(row.detail || row.status || '')}</small></span><span>${row.filesCompleted || 0} / ${row.filesTotal || 0}</span><span>${(row.cpu || 0).toFixed(1)}%</span><span>${(row.gpu || 0).toFixed(1)}%</span><span>${formatTelemetryBytes(row.memoryBytes)}</span><span>${Math.max(0,Math.round((snapshot.timestamp-(row.startedAt || snapshot.timestamp))/1000))}s</span></div>`).join('') : '<div class="telemetry-empty">No background threads are active.</div>'; }
async function refreshTelemetry() { if (consoleTab !== 'telemetry' || $('#diagnostics-console').classList.contains('hidden')) return; try { renderTelemetry(await window.pigeon.getTelemetry()); } catch (error) { showToast(error.message); } }
function selectConsoleTab(tab) { consoleTab = tab; $$('[data-console-tab]').forEach((button) => button.classList.toggle('active', button.dataset.consoleTab === tab)); $('#diagnostics-list').classList.toggle('hidden', tab !== 'logs'); $('#telemetry-panel').classList.toggle('hidden', tab !== 'telemetry'); $('#diagnostic-level-filters').classList.toggle('hidden', tab !== 'logs'); $('#diagnostics-copy-all').classList.toggle('hidden', tab !== 'logs'); clearInterval(telemetryTimer); telemetryTimer = null; if (tab === 'telemetry') { refreshTelemetry(); telemetryTimer = setInterval(refreshTelemetry, 1000); } else renderDiagnosticsConsole(); }
function diagnosticText(entry) { return `[${new Date(entry.timestamp).toISOString()}] [${entry.level.toUpperCase()}] [${entry.portfolioId || 'application'}] ${entry.message}${entry.context ? `\n${entry.context}` : ''}`; }
$('#diagnostics-list').addEventListener('click', async (event) => { const row = event.target.closest('[data-diagnostic-id]'); if (!row) return; const entry = diagnosticsEntries.find((item) => item.id === row.dataset.diagnosticId); if (!entry) return; if (event.target.closest('[data-copy-diagnostic]')) { await window.pigeon.copyText(diagnosticText(entry)); showToast('Log details copied'); } if (event.target.closest('[data-remove-diagnostic]')) { await window.pigeon.removeDiagnostic(entry.id); diagnosticsEntries = diagnosticsEntries.filter((item) => item.id !== entry.id); renderDiagnosticsConsole(); } });
async function openDiagnosticsConsole() { diagnosticsEntries = await window.pigeon.getDiagnostics(); renderDiagnosticsConsole(); $('#diagnostics-console').classList.remove('hidden'); selectConsoleTab(consoleTab); }
$$('[data-console-tab]').forEach((button) => button.addEventListener('click', () => selectConsoleTab(button.dataset.consoleTab)));
$('#diagnostics-close').addEventListener('click', () => { $('#diagnostics-console').classList.add('hidden'); clearInterval(telemetryTimer); telemetryTimer = null; });
$('#diagnostics-fullscreen').addEventListener('click', (event) => { const consolePanel = $('#diagnostics-console'), fullscreen = consolePanel.classList.toggle('fullscreen'); event.currentTarget.setAttribute('aria-pressed', String(fullscreen)); event.currentTarget.textContent = fullscreen ? 'Dock Console' : 'Full Screen'; });
$('#diagnostics-resizer').addEventListener('pointerdown', (event) => { if ($('#diagnostics-console').classList.contains('fullscreen')) return; event.preventDefault(); const startY=event.clientY,startHeight=$('#diagnostics-console').getBoundingClientRect().height; const move=(pointer)=>{ const height=Math.max(160,Math.min(window.innerHeight-100,startHeight+startY-pointer.clientY)); document.documentElement.style.setProperty('--console-height',`${height}px`); localStorage.setItem('pigeon.consoleHeight',String(height)); }; const stop=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',stop); }; window.addEventListener('pointermove',move); window.addEventListener('pointerup',stop); });
const savedConsoleHeight=Number(localStorage.getItem('pigeon.consoleHeight')); if(Number.isFinite(savedConsoleHeight)) document.documentElement.style.setProperty('--console-height',`${Math.max(160,savedConsoleHeight)}px`);
$('#diagnostics-clear').addEventListener('click', async () => { await window.pigeon.clearDiagnostics(); diagnosticsEntries = []; renderDiagnosticsConsole(); });
$('#diagnostics-copy-all').addEventListener('click', async () => { const visible = diagnosticsEntries.filter((entry) => diagnosticsLevel === 'all' || entry.level === diagnosticsLevel); await window.pigeon.copyText(visible.map(diagnosticText).join('\n\n')); showToast(`${visible.length} visible log${visible.length === 1 ? '' : 's'} copied`); });
$('#diagnostics-open-file').addEventListener('click', () => window.pigeon.openDiagnosticsFile());
$$('[data-diagnostic-level]').forEach((button) => button.addEventListener('click', () => { diagnosticsLevel = button.dataset.diagnosticLevel; $$('[data-diagnostic-level]').forEach((item)=>item.classList.toggle('active',item===button)); renderDiagnosticsConsole(); }));
window.pigeon.onDiagnostic((entry) => { diagnosticsEntries.push(entry); if (diagnosticsEntries.length > 1000) diagnosticsEntries.shift(); if (!$('#diagnostics-console').classList.contains('hidden')) renderDiagnosticsConsole(); });
window.pigeon.onError((message) => { showToast(message); window.pigeon.logDiagnostic('error', message, 'Main process error notification'); });
window.addEventListener('beforeunload', saveNavigationState);
window.addEventListener('unhandledrejection', (event) => { const message = event.reason?.message || 'Operation failed'; showToast(message); window.pigeon.reportFatal('renderer:unhandledrejection',event.reason?.stack||message); event.preventDefault(); });
window.addEventListener('error', (event) => { const message = event.message || 'Unexpected UI error'; showToast(message); window.pigeon.reportFatal('renderer:error',event.error?.stack||message,`${event.filename || 'renderer'}:${event.lineno || 0}:${event.colno || 0}`); },true);
window.addEventListener('securitypolicyviolation',(event)=>window.pigeon.reportFatal('renderer:securitypolicyviolation',event.violatedDirective,`${event.blockedURI} · ${event.sourceFile}:${event.lineNumber}`));

if (window.pigeon.platform === 'darwin') $('#window-controls').classList.add('hidden');
else {
  $('#window-minimize').addEventListener('click', () => window.pigeon.minimizeWindow());
  $('#window-maximize').addEventListener('click', async () => $('#window-maximize').classList.toggle('maximized', await window.pigeon.toggleMaximizeWindow()));
  $('#window-close').addEventListener('click', () => window.pigeon.closeWindow());
  window.pigeon.onWindowState((maximized) => $('#window-maximize').classList.toggle('maximized', maximized));
  $('.toolbar').addEventListener('dblclick', (event) => { if (!event.target.closest('button, input, .search-box')) window.pigeon.toggleMaximizeWindow(); });
}
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    setPanelWidth('sidebar', panelWidth('--sidebar-width'));
    setPanelWidth('inspector', panelWidth('--inspector-width'));
    elements.grid.querySelectorAll('.asset-preview.quarter-turned img').forEach(fitRotatedThumbnail); scheduleMasonry(); applyViewerImageFit(); updateViewerCropOverlay();
  }, 80);
});

function loadMoreAssets() {
  const total = filteredAssets().length;
  if (state.renderLimit >= total) return;
  state.renderLimit = Math.min(total, state.renderLimit + 240);
  renderGrid();
}
elements.sentinel.addEventListener('click', loadMoreAssets);
const loadMoreObserver = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) loadMoreAssets(); }, { root: elements.gridWrap, rootMargin: '700px 0px' });
elements.gridWrap.addEventListener('scroll',()=>{thumbnailScrollUntil=Date.now()+320;clearTimeout(thumbnailSettleTimer);scheduleSettledThumbnailLoads();},{passive:true});

applyStaticIcons(); populatePreferenceInputs(); applyPreferences(false);
window.pigeon.onLibraryChanged((library) => {
  if(scanRenderHandle!==null){(window.cancelIdleCallback||clearTimeout)(scanRenderHandle);scanRenderHandle=null;}clearTimeout(streamRenderTimer);rendererAssetIndexes.clear();elements.grid.innerHTML='';elements.grid.classList.add('hidden');
  if (backgroundTaskPortfolioId && library.activePortfolioId && backgroundTaskPortfolioId !== library.activePortfolioId) { backgroundTasks.clear(); renderBackgroundProgress(); }
  backgroundTaskPortfolioId = library.activePortfolioId || backgroundTaskPortfolioId;
  state.streamGeneration = library.streamGeneration || 0;
  state.library = libraryCoreSafe(library); state.duplicateGroups = []; state.duplicateIds.clear();
  if (!state.library.loading && !state.library.assetStreamPending && !(state.library.totalAssets ?? state.library.assets.length)) finishStartupSplash();
  if (!state.library.loading && !state.library.assetStreamPending && state.navigationRestoredPortfolioId !== state.library.activePortfolioId) { restoreNavigationState(); updateFilterChips(); }
  resetRenderLimit();
  render(); scheduleFolderTreeBuild();
});
window.pigeon.onSidebarChanged(({collections,smartFolders,settings,activePortfolioId})=>{if(activePortfolioId!==state.library.activePortfolioId)return;state.library.collections=collections||state.library.collections;state.library.smartFolders=smartFolders||state.library.smartFolders;state.library.settings={...(state.library.settings||{}),...(settings||{})};renderSidebar(false);renderTagSuggestions();});
window.pigeon.onLibraryAssets(({ generation, assets, done }) => {
  if (generation !== state.streamGeneration) return;
  for(const asset of assets){if(asset.locked)continue;rendererAssetIndexes.set(asset.id,state.library.assets.length);state.library.assets.push(asset);}
  if (!done) return;
  state.library.assetStreamPending=false;state.library.totalAssets=state.library.assets.length;refreshDuplicateIds();if(state.view==='duplicates'&&state.duplicateSourceId)refreshSimilarityGroups();render();finishStartupSplash();scheduleFolderTreeBuild();if(isInternalViewerOpen())renderInternalViewer();
});
function scheduleScanGridRender(){ if(scanRenderHandle!==null)return; const run=()=>{scanRenderHandle=null;if(performance.now()-lastUserInteractionAt<250){scheduleScanGridRender();return;}renderGrid();updateLocationProgressUI();}; scanRenderHandle=window.requestIdleCallback?requestIdleCallback(run,{timeout:1500}):setTimeout(run,750); }
window.pigeon.onScanAssets(({portfolioId,locationId,assets,done})=>{ if(portfolioId!==state.library.activePortfolioId||state.library.loading||state.library.assetStreamPending)return; const wasEmpty=state.library.assets.length===0; let added=0; for(const asset of assets){const index=rendererAssetIndexes.get(asset.id);if(index===undefined){rendererAssetIndexes.set(asset.id,state.library.assets.length);state.library.assets.push(asset);added+=1;}else state.library.assets[index]=asset;} state.library.totalAssets=state.library.assets.length; const location=state.library.locations.find((item)=>item.id===locationId);if(location)location.assetCount=(location.assetCount||0)+added; updateLocationProgressUI(); if(done){refreshDuplicateIds();scheduleFolderTreeBuild();scheduleScanGridRender();}else if(wasEmpty&&added)scheduleScanGridRender(); });
function updateLocationProgressUI() { for (const location of state.library.locations) { const row=elements.locationList.querySelector(`[data-location-id="${location.id}"]`); if (!row) continue; row.classList.toggle('offline',!location.online); row.classList.toggle('scanning',Boolean(location.scanning)); const count=row.querySelector('.location-root-button small'); if(count) count.textContent=location.assetCount||0; } const scanning=state.library.locations.find((location)=>location.scanning),progress=scanning?.scanProgress; if(scanning) elements.status.textContent=`Indexing ${scanning.name}… ${progress?.inspected||0}${progress?.discovered?` / ${progress.discovered}`:''}`; }
window.pigeon.onLocationsChanged(({ locations, loading, totalAssets }) => {
  const structureChanged = locations.length !== state.library.locations.length || locations.some((location,index)=>location.id!==state.library.locations[index]?.id || location.path!==state.library.locations[index]?.path);
  state.library.locations = locations; state.library.loading = loading; state.library.totalAssets = totalAssets;
  if(structureChanged){ renderSidebar(false); scheduleFolderTreeBuild(); } else updateLocationProgressUI();
});
window.pigeon.onThumbnailReady(({ id, previewUrl, mediaUrl, width, height, duration, failed, error, dominantColor, histogram, palette, perceptualHash, exif, embeddedMetadata, technicalMetadata }) => {
  const asset = state.library.assets[rendererAssetIndexes.get(id)];
  if (asset) {
    if (failed) { asset.thumbnailPath = null; asset.thumbnailFailedAt = Date.now(); asset.thumbnailFailedModified = asset.modified; asset.thumbnailError = error || 'Preview unavailable'; }
    else { asset.thumbnailPath = asset.thumbnailPath || 'cached'; asset.thumbnailFailedAt = null; asset.thumbnailFailedModified = null; asset.thumbnailError = null; }
    asset.previewUrl = previewUrl || asset.previewUrl;
    asset.mediaUrl = mediaUrl || asset.mediaUrl;
    asset.width = width || asset.width;
    asset.height = height || asset.height;
    asset.duration = duration || asset.duration;
    asset.dominantColor = dominantColor || asset.dominantColor;
    asset.histogram = histogram || asset.histogram;
    asset.palette = palette || asset.palette;
    asset.perceptualHash = perceptualHash || asset.perceptualHash;
    asset.exif = exif || asset.exif;
    asset.embeddedMetadata = embeddedMetadata || asset.embeddedMetadata;
    asset.technicalMetadata = technicalMetadata || asset.technicalMetadata;
    if(perceptualHash&&state.view==='duplicates'&&state.duplicateSourceId){clearTimeout(refreshSimilarityGroups.thumbnailTimer);refreshSimilarityGroups.thumbnailTimer=setTimeout(()=>refreshSimilarityGroups(),450);}
  }
  if (isInternalViewerOpen() && state.viewerAssetId === id) renderInternalViewer();
  const card = elements.grid.querySelector(`[data-asset-id="${id}"]`);
  const preview = card?.querySelector('.asset-preview'), placeholder = preview?.querySelector('.asset-image-placeholder');
  if (placeholder && failed) placeholder.outerHTML = `<div class="asset-file asset-preview-failed" title="${escapeHtml(error || 'Preview unavailable')}"><span class="file-glyph">${iconFor(asset?.kind)}</span><span class="file-ext">${escapeHtml(asset?.extension || 'FILE')}</span><small>Preview unavailable</small></div>`;
  else if (placeholder) {
    const image = document.createElement('img'); image.alt = asset?.name || 'Asset thumbnail'; image.loading = 'lazy'; image.addEventListener('load', () => { fitRotatedThumbnail(image); scheduleMasonry(); }, { once: true }); image.src = previewUrl; placeholder.replaceWith(image);
    if (asset?.kind === 'video') image.insertAdjacentHTML('afterend', `<span class="media-preview-badge video-play-badge">${iconSvg('video')}<span>${asset.duration ? formatMediaTime(asset.duration) : ''}</span></span>`);
    if (asset?.kind === 'audio') image.insertAdjacentHTML('afterend', `<span class="media-preview-badge audio-badge">${iconSvg('audio')}<span>${asset.duration ? formatMediaTime(asset.duration) : ''}</span></span><span class="media-scrub-time">00:00</span>`);
  } else if (preview && asset?.thumbnailPath && !preview.querySelector('img')) preview.innerHTML = `<img src="${previewUrl}" loading="lazy" alt="${escapeHtml(asset.name)}" />`;
  const dimensions = card?.querySelector('[data-title-field="dimensions"]'); if (dimensions && asset?.width && asset?.height) { dimensions.textContent = `${asset.width} × ${asset.height}`; dimensions.title = dimensions.textContent; }
  if (card && asset?.width && asset?.height) { const ratio = asset.width / asset.height; card.style.setProperty('--asset-ratio', String(ratio)); preview?.style.setProperty('--preview-ratio', String(ratio)); }
  if (state.selectedId === id) { if (asset?.kind === 'image' && !failed) elements.inspectorImage.src = protectedUrl(previewUrl); renderInspector(); }
  scheduleMasonry();
});
window.pigeon.getLibrary().then((library) => {
  if (state.streamGeneration !== 0) return;
  state.library = libraryCoreSafe(library);
  if (!state.library.loading && !state.library.assetStreamPending && !(state.library.totalAssets ?? state.library.assets.length)) finishStartupSplash();
  if (!state.library.loading && !state.library.assetStreamPending && state.navigationRestoredPortfolioId !== state.library.activePortfolioId) { restoreNavigationState(); updateFilterChips(); }
  render();
});
