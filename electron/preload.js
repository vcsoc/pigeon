const { contextBridge, ipcRenderer, webUtils } = require('electron');
function reportFatal(source,error,context=''){try{ipcRenderer.send('diagnostics:fatal',{source,message:error?.stack||error?.message||String(error),context:String(context||'')});}catch{}}
process.on('uncaughtException',(error,origin)=>reportFatal('preload:uncaughtException',error,origin));
process.on('unhandledRejection',(error)=>reportFatal('preload:unhandledRejection',error));
process.on('warning',(warning)=>reportFatal('preload:warning',warning));
const startupVersion=process.argv.find((argument)=>argument.startsWith('--pigeon-app-version='))?.slice('--pigeon-app-version='.length)||'';
window.addEventListener('DOMContentLoaded',()=>{const target=document.getElementById('startup-version');if(target&&startupVersion)target.textContent=`Version ${startupVersion}`;},{once:true});

contextBridge.exposeInMainWorld('pigeon', {
  getLibrary: () => ipcRenderer.invoke('library:get'),
  rendererReady: () => ipcRenderer.invoke('renderer:ready'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  getLegalDocuments: () => ipcRenderer.invoke('app:legal-documents'),
  getDiagnostics: () => ipcRenderer.invoke('diagnostics:get'),
  getTelemetry: () => ipcRenderer.invoke('telemetry:get'),
  listBackgroundThreads:()=>ipcRenderer.invoke('background-threads:list'),
  setBackgroundThreadPaused:(id,paused)=>ipcRenderer.invoke('background-threads:set-paused',{id,paused}),
  setAllBackgroundThreadsPaused:(paused)=>ipcRenderer.invoke('background-threads:set-all-paused',Boolean(paused)),
  reorderBackgroundThreads:(ids)=>ipcRenderer.invoke('background-threads:reorder',Array.from(ids||[])),
  recordPerformanceSpan: (span) => ipcRenderer.send('performance:renderer-span', span),
  acknowledgeAssetBatch: (payload) => ipcRenderer.send('library:assets-consumed', payload),
  prioritizeThumbnails: (payload) => ipcRenderer.send('thumbnails:prioritize', payload),
  buildFolderTree: (payload) => ipcRenderer.invoke('folder-tree:build', payload),
  logDiagnostic: (level, message, context = '') => ipcRenderer.invoke('diagnostics:log', { level, message, context }),
  reportFatal: (source, message, context = '') => ipcRenderer.send('diagnostics:fatal', { source, message: String(message || 'Unknown fatal error'), context: String(context || '') }),
  clearDiagnostics: () => ipcRenderer.invoke('diagnostics:clear'),
  removeDiagnostic: (id) => ipcRenderer.invoke('diagnostics:remove', id),
  openDiagnosticsFile: () => ipcRenderer.invoke('diagnostics:open-file'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  searchMap: (query) => ipcRenderer.invoke('map:search', query),
  suggestMap: (query) => ipcRenderer.invoke('map:suggest', query),
  createPortfolio: (name) => ipcRenderer.invoke('portfolio:create', name),
  addExistingPortfolio: () => ipcRenderer.invoke('portfolio:add-existing'),
  renamePortfolio: (id, name) => ipcRenderer.invoke('portfolio:rename', { id, name }),
  switchPortfolio: (id) => ipcRenderer.invoke('portfolio:switch', id),
  removePortfolio: (id) => ipcRenderer.invoke('portfolio:remove', id),
  transferToPortfolio: (payload) => ipcRenderer.invoke('portfolio:transfer', payload),
  addFolder: () => ipcRenderer.invoke('library:add-folder'),
  addDefaultPictures: () => ipcRenderer.invoke('library:add-default-pictures'),
  addFiles: () => ipcRenderer.invoke('library:add-files'),
  pathForDroppedFile: (file) => { try { return webUtils.getPathForFile(file); } catch { return ''; } },
  importDroppedFiles: (paths, target = {}) => ipcRenderer.invoke('library:import-dropped-files', { paths: Array.from(paths || []).filter((value) => typeof value === 'string' && value.trim()), target }),
  moveAssetsToFolder: (ids, locationId, subfolder = '') => ipcRenderer.invoke('assets:move-to-folder', { ids, locationId, subfolder }),
  moveCollectionToFolder: (collectionId, locationId, subfolder = '') => ipcRenderer.invoke('collection:move-to-folder', { collectionId, locationId, subfolder }),
  moveAssetsToPath: (ids, folderPath) => ipcRenderer.invoke('assets:move-to-path', { ids, folderPath }),
  autoRenameAssets: (ids, pattern) => ipcRenderer.invoke('assets:auto-rename', { ids, pattern }),
  startAssetDrag: (ids) => ipcRenderer.invoke('assets:start-drag', ids),
  rebuildThumbnails: (ids) => ipcRenderer.invoke('assets:rebuild-thumbnails', ids),
  getEmbeddedMetadata: (id) => ipcRenderer.invoke('asset:embedded-metadata', id),
  getAssetDetails: (id) => ipcRenderer.invoke('asset:details', id),
  removeLocation: (id) => ipcRenderer.invoke('library:remove-location', id),
  rescan: (id) => ipcRenderer.invoke('library:rescan', id),
  refreshSources: () => ipcRenderer.invoke('library:refresh-sources'),
  createCollection: (name, parentId, id = null) => ipcRenderer.invoke('collection:create', { name, parentId, id }),
  duplicateGroupStructure: (type, id, subfolder = '') => ipcRenderer.invoke('group:duplicate-structure', { type, id, subfolder }),
  createPhysicalSubfolder: (locationId, subfolder, name) => ipcRenderer.invoke('folder:create-physical', { locationId, subfolder, name }),
  deletePhysicalFolder: (locationId, subfolder = '') => ipcRenderer.invoke('folder:delete-physical', { locationId, subfolder }),
  movePhysicalFolder: (sourceLocationId, sourceSubfolder, destinationLocationId, destinationParentSubfolder = '', name = null) => ipcRenderer.invoke('folder:move-physical', { sourceLocationId, sourceSubfolder, destinationLocationId, destinationParentSubfolder, name }),
  renameCollection: (id, name) => ipcRenderer.invoke('collection:rename', { id, name }),
  moveCollection: (id, parentId) => ipcRenderer.invoke('collection:move', { id, parentId }),
  reorderSidebarItems: (type, parentId, orderedIds) => ipcRenderer.invoke('sidebar:reorder-items', { type, parentId, orderedIds }),
  setSidebarSort: (type, sort) => ipcRenderer.invoke('sidebar:set-sort', { type, sort }),
  setSidebarBranchSort: (type, branch, sort) => ipcRenderer.invoke('sidebar:set-branch-sort', { type, branch, sort }),
  setAssetOrder: (scope, order) => ipcRenderer.invoke('assets:set-order', { scope, order }),
  setCollectionPassword: (id, password, encrypt) => ipcRenderer.invoke('collection:set-password', { id, password, encrypt }),
  unlockCollection: (id, password) => ipcRenderer.invoke('collection:unlock', { id, password }),
  lockCollectionNow: (id) => ipcRenderer.invoke('collection:lock-now', id),
  removeCollectionPassword: (id, password) => ipcRenderer.invoke('collection:remove-password', { id, password }),
  setFolderPassword: (locationId, subfolder, password) => ipcRenderer.invoke('folder:set-password', { locationId, subfolder, password }),
  unlockFolder: (locationId, subfolder, password) => ipcRenderer.invoke('folder:unlock', { locationId, subfolder, password }),
  lockFolderNow: (locationId, subfolder) => ipcRenderer.invoke('folder:lock-now', { locationId, subfolder }),
  removeFolderPassword: (locationId, subfolder, password) => ipcRenderer.invoke('folder:remove-password', { locationId, subfolder, password }),
  removeCollection: (id) => ipcRenderer.invoke('collection:remove', id),
  createSmartFolder: (name, filters, parentId = null) => ipcRenderer.invoke('smart-folder:create', { name, filters, parentId }),
  renameSmartFolder: (id, name) => ipcRenderer.invoke('smart-folder:rename', { id, name }),
  updateSmartFolder: (id, name, filters) => ipcRenderer.invoke('smart-folder:update', { id, name, filters }),
  moveSmartFolder: (id, parentId) => ipcRenderer.invoke('smart-folder:move', { id, parentId }),
  removeSmartFolder: (id) => ipcRenderer.invoke('smart-folder:remove', id),
  setItemIcon: (type, id, icon) => ipcRenderer.invoke('item:set-icon', { type, id, icon }),
  setFolderAutoTags: (locationId, subfolder, tags) => ipcRenderer.invoke('folder:set-auto-tags', { locationId, subfolder, tags }),
  setCollectionAutoTags: (collectionId, tags) => ipcRenderer.invoke('collection:set-auto-tags', { collectionId, tags }),
  copyText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  copyAssets: (ids) => ipcRenderer.invoke('clipboard:copy-assets', ids),
  pasteAssets: () => ipcRenderer.invoke('clipboard:paste-assets'),
  batchUpdateAssets: (ids, operation, options = {}) => ipcRenderer.invoke('assets:batch-update', { ids, operation, options }),
  stackAssets: (ids) => ipcRenderer.invoke('assets:stack', ids),
  unstackAssets: (ids) => ipcRenderer.invoke('assets:unstack', ids),
  findDuplicates: () => ipcRenderer.invoke('assets:duplicates'),
  findSimilar: (id) => ipcRenderer.invoke('assets:similar', id),
  findSimilarGroups: (accuracy, sourceId = null) => ipcRenderer.invoke('assets:similar-groups', { accuracy, sourceId }),
  autoTag: (ids) => ipcRenderer.invoke('assets:auto-tag', ids),
  renameTag: (from, to) => ipcRenderer.invoke('tags:rename', { from, to }),
  deleteTag: (tag) => ipcRenderer.invoke('tags:delete', tag),
  deleteTags: (tags) => ipcRenderer.invoke('tags:delete', tags),
  emptyTrash: (mode = 'permanent', ids = null) => ipcRenderer.invoke('trash:empty', { mode, ids }),
  importUrl: (url) => ipcRenderer.invoke('library:import-url', url),
  importClipboard: () => ipcRenderer.invoke('library:import-clipboard'),
  captureScreen: () => ipcRenderer.invoke('library:capture-screen'),
  backupLibrary: () => ipcRenderer.invoke('library:backup'),
  restoreBackup: () => ipcRenderer.invoke('library:restore-backup'),
  configureSync: () => ipcRenderer.invoke('library:configure-sync'),
  syncNow: () => ipcRenderer.invoke('library:sync-now'),
  applyInlineCrop: (id, crop) => ipcRenderer.invoke('asset:apply-inline-crop', { id, crop }),
  resetInlineEdits: (id) => ipcRenderer.invoke('asset:reset-inline-edits', id),
  saveImageEdits:(id,edits,annotations=[])=>ipcRenderer.invoke('asset:save-image-edits',{id,edits,annotations}),
  prepareImageEdit:(id)=>ipcRenderer.invoke('asset:prepare-image-edit',id),
  previewAiRemoval:(id,maskDataUrl,previousToken=null)=>ipcRenderer.invoke('asset:ai-remove-preview',{id,maskDataUrl,previousToken}),
  acceptAiRemoval:(id,token)=>ipcRenderer.invoke('asset:ai-remove-accept',{id,token}),
  discardAiRemoval:(token)=>ipcRenderer.invoke('asset:ai-remove-discard',token),
  convertImage:(id,format)=>ipcRenderer.invoke('asset:convert-image',{id,format}),
  duplicateAsset: (id) => ipcRenderer.invoke('asset:duplicate', id),
  exportAnnotated: (id, annotations, edits) => ipcRenderer.invoke('asset:export-annotated', { id, annotations, edits }),
  exportGroup: (type, id) => ipcRenderer.invoke('library:export-group', { type, id }),
  exportAsset: (id) => ipcRenderer.invoke('asset:export', id),
  readTextAsset: (id) => ipcRenderer.invoke('asset:read-text', id),
  exportContactSheet: (format, rect) => ipcRenderer.invoke('contact-sheet:export', { format, rect }),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  installUpdate: (version) => ipcRenderer.invoke('app:install-update', version),
  openBrowserExtensionFolder: () => ipcRenderer.invoke('extension:open-folder'),
  listPlugins: () => ipcRenderer.invoke('plugins:list'),
  openPluginsFolder: () => ipcRenderer.invoke('plugins:open-folder'),
  runPlugin: (name) => ipcRenderer.invoke('plugins:run', name),
  updateAsset: (id, patch) => ipcRenderer.invoke('asset:update', { id, patch }),
  renameAssetFile: (id, name) => ipcRenderer.invoke('asset:rename-file', { id, name }),
  revealAsset: (id) => ipcRenderer.invoke('asset:reveal', id),
  ensurePlayable: (id, options = {}) => ipcRenderer.invoke('asset:ensure-playable', { id, options }),
  monitorHoverControl: (enabled) => ipcRenderer.send('hover-control:monitor', Boolean(enabled)),
  onHoverControl: (callback) => { const handler=(_event,pressed)=>callback(Boolean(pressed));ipcRenderer.on('hover-control:changed',handler);return()=>ipcRenderer.removeListener('hover-control:changed',handler); },
  openAsset: (id) => ipcRenderer.invoke('asset:open', id),
  openAssetWith: (id) => ipcRenderer.invoke('asset:open-with', id),
  platform: process.platform,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  setWindowZoom: (factor) => ipcRenderer.invoke('window:set-zoom', factor),
  centerWindowOnDisplay: (index) => ipcRenderer.invoke('window:center-display', index),
  updatePreferences: (preferences) => ipcRenderer.invoke('preferences:update', preferences),
  chooseAutoImportFolder: () => ipcRenderer.invoke('preferences:auto-import-folder'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggle-always-on-top'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  resolveFileConflict: (payload) => ipcRenderer.send('file-conflict:resolve', payload),
  onFileConflictPrompt: (callback) => { const handler=(_event,value)=>callback(value);ipcRenderer.on('file-conflict:prompt',handler);return()=>ipcRenderer.removeListener('file-conflict:prompt',handler); },
  onError: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('app:error', handler);
    return () => ipcRenderer.removeListener('app:error', handler);
  },
  onWindowState: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('window:maximized', handler);
    return () => ipcRenderer.removeListener('window:maximized', handler);
  },
  onThumbnailReady: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('thumbnail:ready', handler);
    return () => ipcRenderer.removeListener('thumbnail:ready', handler);
  },
  onAssetsPatched: (callback) => {
    const handler=(_event,value)=>callback(value);
    ipcRenderer.on('assets:patched',handler);
    return()=>ipcRenderer.removeListener('assets:patched',handler);
  },
  onBackgroundProgress: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('background:progress', handler);
    return () => ipcRenderer.removeListener('background:progress', handler);
  },
  onDiagnostic: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('diagnostics:entry', handler);
    return () => ipcRenderer.removeListener('diagnostics:entry', handler);
  },
  onLibraryChanged: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('library:changed', handler);
    return () => ipcRenderer.removeListener('library:changed', handler);
  },
  onSidebarChanged: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('sidebar:changed', handler);
    return () => ipcRenderer.removeListener('sidebar:changed', handler);
  },
  onLibraryAssets: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('library:assets', handler);
    return () => ipcRenderer.removeListener('library:assets', handler);
  },
  onLibraryAssetsComplete: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('library:assets-complete', handler);
    return () => ipcRenderer.removeListener('library:assets-complete', handler);
  },
  onLibraryAssetsDelta: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('library:assets-delta', handler);
    return () => ipcRenderer.removeListener('library:assets-delta', handler);
  },
  onLibraryAssetsDeltaComplete: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('library:assets-delta-complete', handler);
    return () => ipcRenderer.removeListener('library:assets-delta-complete', handler);
  },
  onScanAssets: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('scan:assets', handler);
    return () => ipcRenderer.removeListener('scan:assets', handler);
  },
  onLocationsChanged: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('locations:changed', handler);
    return () => ipcRenderer.removeListener('locations:changed', handler);
  }
});
