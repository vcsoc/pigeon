const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('pigeon', {
  getLibrary: () => ipcRenderer.invoke('library:get'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  getDiagnostics: () => ipcRenderer.invoke('diagnostics:get'),
  getTelemetry: () => ipcRenderer.invoke('telemetry:get'),
  logDiagnostic: (level, message, context = '') => ipcRenderer.invoke('diagnostics:log', { level, message, context }),
  clearDiagnostics: () => ipcRenderer.invoke('diagnostics:clear'),
  removeDiagnostic: (id) => ipcRenderer.invoke('diagnostics:remove', id),
  openDiagnosticsFile: () => ipcRenderer.invoke('diagnostics:open-file'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  searchMap: (query) => ipcRenderer.invoke('map:search', query),
  suggestMap: (query) => ipcRenderer.invoke('map:suggest', query),
  createPortfolio: (name) => ipcRenderer.invoke('portfolio:create', name),
  renamePortfolio: (id, name) => ipcRenderer.invoke('portfolio:rename', { id, name }),
  switchPortfolio: (id) => ipcRenderer.invoke('portfolio:switch', id),
  removePortfolio: (id) => ipcRenderer.invoke('portfolio:remove', id),
  transferToPortfolio: (payload) => ipcRenderer.invoke('portfolio:transfer', payload),
  addFolder: () => ipcRenderer.invoke('library:add-folder'),
  addFiles: () => ipcRenderer.invoke('library:add-files'),
  pathForDroppedFile: (file) => { try { return webUtils.getPathForFile(file); } catch { return ''; } },
  importDroppedFiles: (paths, target = {}) => ipcRenderer.invoke('library:import-dropped-files', { paths: Array.from(paths || []).filter((value) => typeof value === 'string' && value.trim()), target }),
  removeLocation: (id) => ipcRenderer.invoke('library:remove-location', id),
  rescan: (id) => ipcRenderer.invoke('library:rescan', id),
  refreshSources: () => ipcRenderer.invoke('library:refresh-sources'),
  createCollection: (name, parentId) => ipcRenderer.invoke('collection:create', { name, parentId }),
  renameCollection: (id, name) => ipcRenderer.invoke('collection:rename', { id, name }),
  moveCollection: (id, parentId) => ipcRenderer.invoke('collection:move', { id, parentId }),
  setCollectionPassword: (id, password, encrypt) => ipcRenderer.invoke('collection:set-password', { id, password, encrypt }),
  unlockCollection: (id, password) => ipcRenderer.invoke('collection:unlock', { id, password }),
  lockCollectionNow: (id) => ipcRenderer.invoke('collection:lock-now', id),
  removeCollectionPassword: (id, password) => ipcRenderer.invoke('collection:remove-password', { id, password }),
  removeCollection: (id) => ipcRenderer.invoke('collection:remove', id),
  createSmartFolder: (name, filters, parentId = null) => ipcRenderer.invoke('smart-folder:create', { name, filters, parentId }),
  renameSmartFolder: (id, name) => ipcRenderer.invoke('smart-folder:rename', { id, name }),
  moveSmartFolder: (id, parentId) => ipcRenderer.invoke('smart-folder:move', { id, parentId }),
  removeSmartFolder: (id) => ipcRenderer.invoke('smart-folder:remove', id),
  setItemIcon: (type, id, icon) => ipcRenderer.invoke('item:set-icon', { type, id, icon }),
  setFolderAutoTags: (locationId, subfolder, tags) => ipcRenderer.invoke('folder:set-auto-tags', { locationId, subfolder, tags }),
  setCollectionAutoTags: (collectionId, tags) => ipcRenderer.invoke('collection:set-auto-tags', { collectionId, tags }),
  copyText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  batchUpdateAssets: (ids, operation, options = {}) => ipcRenderer.invoke('assets:batch-update', { ids, operation, options }),
  stackAssets: (ids) => ipcRenderer.invoke('assets:stack', ids),
  unstackAssets: (ids) => ipcRenderer.invoke('assets:unstack', ids),
  findDuplicates: () => ipcRenderer.invoke('assets:duplicates'),
  findSimilar: (id) => ipcRenderer.invoke('assets:similar', id),
  findSimilarGroups: (accuracy, sourceId = null) => ipcRenderer.invoke('assets:similar-groups', { accuracy, sourceId }),
  autoTag: (ids) => ipcRenderer.invoke('assets:auto-tag', ids),
  renameTag: (from, to) => ipcRenderer.invoke('tags:rename', { from, to }),
  deleteTag: (tag) => ipcRenderer.invoke('tags:delete', tag),
  emptyTrash: () => ipcRenderer.invoke('trash:empty'),
  importUrl: (url) => ipcRenderer.invoke('library:import-url', url),
  importClipboard: () => ipcRenderer.invoke('library:import-clipboard'),
  captureScreen: () => ipcRenderer.invoke('library:capture-screen'),
  backupLibrary: () => ipcRenderer.invoke('library:backup'),
  restoreBackup: () => ipcRenderer.invoke('library:restore-backup'),
  configureSync: () => ipcRenderer.invoke('library:configure-sync'),
  syncNow: () => ipcRenderer.invoke('library:sync-now'),
  applyInlineCrop: (id, crop) => ipcRenderer.invoke('asset:apply-inline-crop', { id, crop }),
  resetInlineEdits: (id) => ipcRenderer.invoke('asset:reset-inline-edits', id),
  duplicateAsset: (id) => ipcRenderer.invoke('asset:duplicate', id),
  exportAnnotated: (id, annotations, edits) => ipcRenderer.invoke('asset:export-annotated', { id, annotations, edits }),
  exportGroup: (type, id) => ipcRenderer.invoke('library:export-group', { type, id }),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  openBrowserExtensionFolder: () => ipcRenderer.invoke('extension:open-folder'),
  listPlugins: () => ipcRenderer.invoke('plugins:list'),
  openPluginsFolder: () => ipcRenderer.invoke('plugins:open-folder'),
  runPlugin: (name) => ipcRenderer.invoke('plugins:run', name),
  updateAsset: (id, patch) => ipcRenderer.invoke('asset:update', { id, patch }),
  renameAssetFile: (id, name) => ipcRenderer.invoke('asset:rename-file', { id, name }),
  revealAsset: (id) => ipcRenderer.invoke('asset:reveal', id),
  ensurePlayable: (id, options = {}) => ipcRenderer.invoke('asset:ensure-playable', { id, options }),
  openAsset: (id) => ipcRenderer.invoke('asset:open', id),
  openAssetWith: (id) => ipcRenderer.invoke('asset:open-with', id),
  platform: process.platform,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  setWindowZoom: (factor) => ipcRenderer.invoke('window:set-zoom', factor),
  updatePreferences: (preferences) => ipcRenderer.invoke('preferences:update', preferences),
  chooseAutoImportFolder: () => ipcRenderer.invoke('preferences:auto-import-folder'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggle-always-on-top'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
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
  onLibraryAssets: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('library:assets', handler);
    return () => ipcRenderer.removeListener('library:assets', handler);
  },
  onLocationsChanged: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('locations:changed', handler);
    return () => ipcRenderer.removeListener('locations:changed', handler);
  }
});
