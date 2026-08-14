const { app, BrowserWindow, dialog, ipcMain, protocol, shell, clipboard, desktopCapturer, crashReporter, utilityProcess, screen, nativeImage } = require('electron');
const fsp = require('node:fs/promises');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const sharp = require('sharp');
const libraryCore = require('./library-core');
const { createLibraryStore } = require('./database');
const ffmpegExecutable = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
const os = require('node:os');
const { availableMemoryBytes } = require('./system-resources');
const { extractAffinityPreview } = require('./affinity-preview');
const { isMissingUpdateMetadataError } = require('./update-support');
const { extractSnagxPreview } = require('./snagx-preview');
const { execFile, spawn } = require('node:child_process');
const { Worker } = require('node:worker_threads');
const chokidar = require('chokidar');
const { autoUpdater } = require('electron-updater');
autoUpdater.disableWebInstaller = true;

protocol.registerSchemesAsPrivileged([
  { scheme: 'pigeon-asset', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } },
  { scheme: 'pigeon-map', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.ico', '.avif', '.tif', '.tiff', '.svg', '.psd']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv', '.ogv']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.oga', '.opus']);
const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.woff', '.woff2']);
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.af', '.afdesign', '.afphoto', '.pspimage', '.ai', '.sketch', '.free', '.fig', '.eps', '.snagx']);
const AFFINITY_PREVIEW_EXTENSIONS = new Set(['AF', 'AFDESIGN', 'AFPHOTO']);
const PREVIEWABLE_DOCUMENT_EXTENSIONS = new Set(['PDF', 'AI', 'EPS', 'SKETCH', 'FREE', 'AF', 'AFDESIGN', 'AFPHOTO', 'SNAGX']);
const watchers = new Map();
const thumbnailWorkers = [];
const thumbnailQueue = [];
const videoPreparationJobs = new Map();
const thumbnailPreparationJobs = new Map();
const unlockedCollections = new Map();
const unlockedFolders = new Map();
let mainWindow,hoverControlProcess=null,hoverControlPressed=false;
function startHoverControlMonitor(){if(process.platform!=='win32'||hoverControlProcess)return;const script=`Add-Type -Name K -Namespace P -MemberDefinition '[DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);';$last=-1;while($true){$v=if(([P.K]::GetAsyncKeyState(0x11)-band 0x8000)-ne 0){1}else{0};if($v-ne $last){[Console]::Out.WriteLine($v);[Console]::Out.Flush();$last=$v};Start-Sleep -Milliseconds 70}`;const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['ignore','pipe','ignore']});hoverControlProcess=child;let pending='';child.stdout.on('data',(chunk)=>{pending+=chunk;const lines=pending.split(/\r?\n/);pending=lines.pop();for(const line of lines){const pressed=line.trim()==='1';if(pressed!==hoverControlPressed){hoverControlPressed=pressed;mainWindow?.webContents.send('hover-control:changed',pressed);}}});child.once('exit',()=>{if(hoverControlProcess===child)hoverControlProcess=null;});}
function stopHoverControlMonitor(){const child=hoverControlProcess;hoverControlProcess=null;if(child)child.kill();hoverControlPressed=false;mainWindow?.webContents.send('hover-control:changed',false);}
let mediaServer = null, mediaServerPort = 0;
const mediaServerToken = crypto.randomBytes(24).toString('hex');
let databaseFile;
let legacyJsonFile;
let databaseWorker;
let databaseRequestId = 0;
const databaseRequests = new Map();
let databaseSaveInFlight = null, pendingDatabaseSnapshot = null;
let thumbnailDir;
let importsDir;
let backupDir;
let pluginsDir;
let portfolioRegistryFile;
let portfolioRegistrySave=Promise.resolve();
let mapTileDir;
let portfolios = [];
let activePortfolioId = 'default';
let library = libraryCore.migrateLibrary({ loading: true });
let saveTimer;
const watcherRefreshTimers = new Map();
const watcherIgnoreUntil = new Map();
const backgroundRuns = new Map();
const portfolioBackgroundTimers = new Set();
const backgroundHashWorkers = new Set();
const workerTelemetry = new Map();
let backgroundEpoch = 0;
const INDEX_CPU_LIMIT = 20;
const INDEX_BATCH_SIZE = 24;
const SCAN_INLINE_HASH_MAX_BYTES = 8 * 1024 * 1024;
const MAX_BACKGROUND_THREADS = 4;
const INDEX_WORKER_COUNT = Math.max(1,Math.min(MAX_BACKGROUND_THREADS,Math.max(1,Math.floor(os.cpus().length/3))));
const THUMBNAIL_WORKER_COUNT = 2;
const BACKGROUND_HASH_WORKERS = 2;
const PDF_WORKER_LIMIT = 1;
const LARGE_SCAN_WORKER_LIMIT = 2;
const MIN_FREE_MEMORY_BYTES = 2 * 1024 * 1024 * 1024;
let activePdfWorkers = 0;
const pdfWorkerWaiters = [];
let activeSimilarityJob=null;
let diagnosticsFile;
let diagnosticEntries = [];
const fatalDiagnosticsFile=path.join(app.getPath('userData'),'fatal-errors.jsonl');
const originalConsoleError = console.error.bind(console), originalConsoleWarn = console.warn.bind(console);
function writeFatalDiagnostic(source,error,context=''){try{fs.appendFileSync(fatalDiagnosticsFile,`${JSON.stringify({timestamp:Date.now(),source,message:diagnosticValue(error),context:diagnosticValue(context),portfolioId:activePortfolioId})}\n`);}catch{}}
function diagnosticValue(value) { if (value instanceof Error) return value.stack || value.message; if (typeof value === 'string') return value; try { return JSON.stringify(value); } catch { return String(value); } }
function recordDiagnostic(level, message, context = null) {
  const entry = { id: crypto.randomUUID(), timestamp: Date.now(), level, portfolioId: activePortfolioId, message: diagnosticValue(message), context: context ? diagnosticValue(context) : '' };
  diagnosticEntries.push(entry); if (diagnosticEntries.length > 1000) diagnosticEntries = diagnosticEntries.slice(-1000);
  if (diagnosticsFile) fsp.appendFile(diagnosticsFile, `${JSON.stringify(entry)}\n`).catch(() => {});
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('diagnostics:entry', entry);
  return entry;
}
console.error = (...values) => { originalConsoleError(...values); recordDiagnostic('error', values.map(diagnosticValue).join(' ')); };
console.warn = (...values) => { originalConsoleWarn(...values); recordDiagnostic('warning', values.map(diagnosticValue).join(' ')); };
process.on('uncaughtExceptionMonitor',(error,origin)=>writeFatalDiagnostic('main:uncaughtExceptionMonitor',error,origin));
process.on('uncaughtException', (error,origin) => { writeFatalDiagnostic('main:uncaughtException',error,origin); console.error('Uncaught application error:', error); });
if (!process.argv.includes('--smoke-test')) process.on('unhandledRejection', (error,promise) => { writeFatalDiagnostic('main:unhandledRejection',error,String(promise)); console.error('Unhandled promise rejection:', error); });
process.on('warning',(warning)=>recordDiagnostic('warning',`Node warning: ${warning.name}`,warning.stack||warning.message));
process.on('multipleResolves',(type,_promise,value)=>recordDiagnostic('warning',`Promise resolved more than once: ${type}`,value));
let broadcastTimer;
let libraryStreamGeneration = 0;
let lastBackupAt = 0;
const smokeTest = process.argv.includes('--smoke-test');
const smokeSeeded = process.argv.includes('--smoke-seeded');
const smokeLarge = process.argv.includes('--smoke-large');
const pendingProtocolUrls = [];
if (smokeTest) {
  const watchdog = setTimeout(() => { console.error('[smoke] exceeded 45-second limit'); app.exit(1); }, smokeLarge ? 45000 : 19000); watchdog.unref();
  process.on('unhandledRejection', (error) => { console.error(`[smoke] failed: ${error?.stack || error}`); app.exit(1); });
}
if (smokeTest) {
  const smokeProfile = path.join(os.tmpdir(), 'pigeon-smoke-profile');
  if (smokeSeeded) fs.rmSync(smokeProfile, { recursive: true, force: true });
  app.setPath('userData', smokeProfile);
}
const crashDumpDirectory=path.join(app.getPath('userData'),'crashes'); fs.mkdirSync(crashDumpDirectory,{recursive:true}); app.setPath('crashDumps',crashDumpDirectory); crashReporter.start({uploadToServer:false,compress:false});
const runtimePreferencesFile = path.join(app.getPath('userData'), 'runtime-preferences.json');
const windowStateFile=path.join(app.getPath('userData'),'window-state.json');
try { const runtimePreferences = JSON.parse(fs.readFileSync(runtimePreferencesFile, 'utf8')); if (runtimePreferences.hardwareAcceleration === false) app.disableHardwareAcceleration(); } catch { /* Defaults remain enabled. */ }
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();

function makeId(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);
}
function trackWorker(worker, type, detail = {}) {
  const id = `${type}:${worker.threadId}:${Date.now()}`,progressId=`${activePortfolioId}:worker:${id}`,label=String(type).split('-').map((part)=>part[0]?.toUpperCase()+part.slice(1)).join(' '),showProgress=!['database','thumbnail','index-scan','fingerprint'].includes(type); workerTelemetry.set(id, { id, worker, threadId: worker.threadId, type, portfolioId: detail.portfolioId || activePortfolioId, status: 'running', startedAt: Date.now(), filesTotal: detail.filesTotal || 0, filesCompleted: 0, currentFile: '', batch: detail.batch || 0,progressId });
  if(showProgress)reportBackgroundProgress(progressId,{label:`${label} worker`,detail:detail.filesTotal?`${Number(detail.filesTotal).toLocaleString()} items`:'Running in background',total:detail.filesTotal||0});
  worker.on('error',(error)=>{writeFatalDiagnostic(`worker:${type}:error`,error,{id,threadId:worker.threadId});recordDiagnostic('error',`${type} worker exception`,error);if(showProgress)reportBackgroundProgress(progressId,{label:`${label} worker failed`,detail:error.message,done:true,status:'failed'});});
  worker.on('messageerror',(error)=>{writeFatalDiagnostic(`worker:${type}:messageerror`,error,{id,threadId:worker.threadId});recordDiagnostic('error',`${type} worker message could not be deserialized`,error);});
  worker.once('exit', (code) => {const entry=workerTelemetry.get(id),successful=code===0||Boolean(entry?.filesTotal&&entry.filesCompleted>=entry.filesTotal);workerTelemetry.delete(id);if(showProgress)reportBackgroundProgress(progressId,{label:successful?`${label} worker complete`:`${label} worker stopped`,detail:successful?'Background work finished':`Exit code ${code}`,completed:entry?.filesTotal||0,total:entry?.filesTotal||0,done:true,status:successful?'completed':'failed'});if(code!==0&&!successful&&!entry?.expectedExit&&!app.isQuitting)recordDiagnostic('error',`${type} worker exited unexpectedly`,{id,code});}); return workerTelemetry.get(id);
}
async function workerResourceTelemetry(entry) { try { const [cpuUsage, heap] = await Promise.all([typeof entry.worker.cpuUsage === 'function' ? entry.worker.cpuUsage(entry.lastCpuUsage).catch(() => null) : null, typeof entry.worker.getHeapStatistics === 'function' ? entry.worker.getHeapStatistics().catch(() => null) : null]); const elapsed = Math.max(1, Date.now() - (entry.lastSampleAt || entry.startedAt)); entry.lastSampleAt = Date.now(); if (cpuUsage) entry.lastCpuUsage = cpuUsage; return { cpu: cpuUsage ? Math.min(100, ((cpuUsage.user + cpuUsage.system) / 1000 / elapsed) * 100) : (entry.worker.performance?.eventLoopUtilization()?.utilization || 0) * 100, memoryBytes: heap?.usedHeapSize || entry.memoryBytes || 0 }; } catch { return { cpu: 0, memoryBytes: entry.memoryBytes || 0 }; } }
async function telemetrySnapshot() {
  const metrics = app.getAppMetrics(), cpu = metrics.reduce((sum, item) => sum + (item.cpu?.percentCPUUsage || 0), 0), memoryBytes = metrics.reduce((sum, item) => sum + (item.memory?.workingSetSize || 0) * 1024, 0), gpuProcesses = metrics.filter((item) => String(item.type).toLowerCase().includes('gpu'));
  const threads = await Promise.all([...workerTelemetry.values()].map(async (entry) => { const resource = await workerResourceTelemetry(entry); return { id: entry.id, threadId: entry.threadId, type: entry.type, portfolioId: entry.portfolioId, status: entry.status, startedAt: entry.startedAt, filesCompleted: entry.filesCompleted, filesTotal: entry.filesTotal, currentFile: entry.currentFile, batch: entry.batch, ...resource }; }));
  return { timestamp: Date.now(), collective: { cpu, memoryBytes, gpuCpu: gpuProcesses.reduce((sum, item) => sum + (item.cpu?.percentCPUUsage || 0), 0), gpuMemoryBytes: gpuProcesses.reduce((sum, item) => sum + (item.memory?.workingSetSize || 0) * 1024, 0), filesCompleted: threads.reduce((sum, item) => sum + item.filesCompleted, 0), filesTotal: threads.reduce((sum, item) => sum + item.filesTotal, 0), activeThreads: threads.length, logicalCpus: os.cpus().length, cpuLimit: INDEX_CPU_LIMIT }, threads, processes: metrics.map((item) => ({ pid: item.pid, type: item.type, cpu: item.cpu?.percentCPUUsage || 0, memoryBytes: (item.memory?.workingSetSize || 0) * 1024 })) };
}
async function waitForIndexCpuBudget(run) { while (backgroundRunActive(run)) { const [snapshot,freeMemory]=await Promise.all([telemetrySnapshot(),availableMemoryBytes()]); if (snapshot.collective.cpu < INDEX_CPU_LIMIT && freeMemory>=MIN_FREE_MEMORY_BYTES) return true; reportBackgroundProgress(run.progressId,{label:freeMemory<MIN_FREE_MEMORY_BYTES?'Background work paused for memory':'Background work yielding to your laptop',detail:freeMemory<MIN_FREE_MEMORY_BYTES?`Waiting for available memory · ${Math.round(freeMemory/1024/1024)} MB available`:`CPU ${Math.round(snapshot.collective.cpu)}% · limit ${INDEX_CPU_LIMIT}%`,status:'paused'}); await new Promise((resolve) => setTimeout(resolve, freeMemory<MIN_FREE_MEMORY_BYTES?1200:500)); } return false; }
function scanWorkActive(){return [...backgroundRuns.values()].some((run)=>run.type==='scan'&&backgroundRunActive(run));}
async function waitForScanIdle(run){while(backgroundRunActive(run)&&scanWorkActive())await backgroundDelay(500,run);return backgroundRunActive(run);}

function kindFor(extension) {
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (FONT_EXTENSIONS.has(extension)) return 'font';
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';
  return 'file';
}

function collectionAncestors(id){const result=[];let current=library.collections.find((item)=>item.id===id);while(current){result.push(current);current=current.parentId?library.collections.find((item)=>item.id===current.parentId):null;}return result;}
function isCollectionLocked(id) {return collectionAncestors(id).some((collection)=>collection.lock&&!unlockedCollections.has(collection.id));}
function folderLockKey(locationId,subfolder=''){return`${locationId}:${normalizedSubfolder(subfolder).toLowerCase()}`;}
function folderLocks(){return Object.values(library.settings?.folderLocks||{});}
function assetRelativeFolder(asset){const location=library.locations.find((item)=>item.id===asset.locationId);if(!location)return'';const relative=path.relative(location.path,path.dirname(asset.path)).replace(/\\/g,'/');return relative==='.'?'':normalizedSubfolder(relative).toLowerCase();}
function matchingFolderLocks(asset){const folder=assetRelativeFolder(asset);return folderLocks().filter((rule)=>rule.locationId===asset.locationId&&(!rule.subfolder||folder===rule.subfolder||folder.startsWith(`${rule.subfolder}/`)));}
function isAssetLocked(asset) { return (asset.collectionIds || []).some(isCollectionLocked)||matchingFolderLocks(asset).some((rule)=>!unlockedFolders.has(folderLockKey(rule.locationId,rule.subfolder))); }
function publicCollections() {return library.collections.map((collection)=>{const lockSource=collectionAncestors(collection.id).find((item)=>item.lock&&!unlockedCollections.has(item.id));return{...collection,lock:collection.lock?{enabled:true,encrypted:Boolean(collection.lock.encrypted)}:lockSource?{enabled:true,inherited:true}:null,lockSourceId:lockSource?.id||null,locked:Boolean(lockSource)};});}
function publicFolderLocks(){return Object.fromEntries(folderLocks().map((rule)=>[folderLockKey(rule.locationId,rule.subfolder),{locationId:rule.locationId,subfolder:rule.subfolder,locked:!unlockedFolders.has(folderLockKey(rule.locationId,rule.subfolder))}]));}
function rendererVisibleAssets(){return library.assets.filter((asset)=>!isAssetLocked(asset));}
function publicLibrarySummary() {
  const { assets, collections, settings={}, ...metadata } = library,visibleAssets=rendererVisibleAssets();
  return { ...metadata,settings:{...settings,folderLocks:publicFolderLocks()},collections:publicCollections(),portfolios:portfolios.map(({ id, name })=>({ id, name })),activePortfolioId,assets:[],totalAssets:visibleAssets.length,assetStreamPending:!library.loading };
}
function passwordKey(password, salt) { return crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256'); }
function passwordDigest(key) { return crypto.createHash('sha256').update(key).digest('hex'); }
async function encryptFileCopy(source, target, key) {
  const input = await fsp.readFile(source);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(input), cipher.final()]);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, Buffer.concat([iv, cipher.getAuthTag(), body]));
  return target;
}
async function decryptFileCopy(source, key) {
  const input = await fsp.readFile(source);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, input.subarray(0, 12));
  decipher.setAuthTag(input.subarray(12, 28));
  return Buffer.concat([decipher.update(input.subarray(28)), decipher.final()]);
}
async function encryptCollectionCopies(collection, key) {
  const vault = path.join(thumbnailDir, 'locked', collection.id);
  for (const asset of library.assets.filter((item) => item.kind === 'image' && (item.collectionIds || []).includes(collection.id))) {
    asset.encryptedMediaPaths = { ...(asset.encryptedMediaPaths || {}), [collection.id]: await encryptFileCopy(asset.path, path.join(vault, `${asset.id}.media.enc`), key) };
    if (asset.thumbnailPath && await pathAvailable(asset.thumbnailPath)) asset.encryptedThumbnailPaths = { ...(asset.encryptedThumbnailPaths || {}), [collection.id]: await encryptFileCopy(asset.thumbnailPath, path.join(vault, `${asset.id}.thumb.enc`), key) };
  }
}

function previewUrlFor(asset, location = library.locations.find((item) => item.id === asset.locationId)) {
  const sourceState = location?.checking ? 'checking' : location?.online === true ? 'online' : 'offline';
  return `pigeon-asset://asset/${asset.id}?v=${asset.editedAt || asset.modified || 0}&s=${sourceState}&t=${asset.thumbnailPath || asset.editedPath ? 1 : 0}&edited=${asset.editedPath ? 1 : 0}`;
}
function mediaUrlFor(asset) { const query = `proxy=${asset.proxyPath && asset.proxyVersion === 3 ? 1 : 0}&edited=${asset.editedPath ? 1 : 0}&v=${asset.editedAt || asset.modified || 0}`, streamable = asset.kind === 'video' || asset.kind === 'audio'; return mediaServerPort && streamable ? `http://127.0.0.1:${mediaServerPort}/asset/${asset.id}?token=${mediaServerToken}&${query}` : `pigeon-asset://asset/${asset.id}?original=1&${query}`; }
async function startMediaServer() {
  if (mediaServer) return; mediaServer = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1'); if (url.searchParams.get('token') !== mediaServerToken || !url.pathname.startsWith('/asset/')) { response.writeHead(403).end(); return; }
      const id = decodeURIComponent(url.pathname.slice('/asset/'.length)), asset = library.assets.find((item) => item.id === id); if (!asset || isAssetLocked(asset)) { response.writeHead(404).end(); return; }
      const useProxy = url.searchParams.get('proxy') === '1' && asset.proxyPath, useEdited = url.searchParams.get('edited') === '1' && asset.editedPath, source = useEdited || useProxy || asset.path, stat = await fsp.stat(source), extension = path.extname(source).toLowerCase(), mime = ({ '.mp4':'video/mp4', '.m4v':'video/mp4', '.mov':'video/quicktime', '.webm':'video/webm', '.ogv':'video/ogg', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.m4a':'audio/mp4', '.aac':'audio/aac', '.flac':'audio/flac', '.ogg':'audio/ogg', '.oga':'audio/ogg', '.opus':'audio/ogg' })[extension] || 'application/octet-stream', match = request.headers.range?.match(/bytes=(\d+)-(\d*)/), headers = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600', 'Access-Control-Allow-Origin': '*' };
      let start = 0, end = stat.size - 1, status = 200; if (match) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; if (start > end) { response.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` }).end(); return; } status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`; }
      headers['Content-Length'] = String(end - start + 1); response.writeHead(status, headers); const stream = fs.createReadStream(source, { start, end }); stream.on('error', () => response.destroy()); request.on('close', () => stream.destroy()); stream.pipe(response);
    } catch { if (!response.headersSent) response.writeHead(404); response.end(); }
  });
  await new Promise((resolve, reject) => { mediaServer.once('error', reject); mediaServer.listen(0, '127.0.0.1', () => { mediaServerPort = mediaServer.address().port; resolve(); }); });
}
function compatibilityStreamUrl(asset) { return `pigeon-asset://asset/${asset.id}?original=1&stream=1&duration=${asset.duration || 0}&v=${asset.modified || 0}&session=${Date.now()}`; }

function publicAssetForRenderer(asset,location){ const {encryptedMediaPaths,encryptedThumbnailPaths,...publicAsset}=asset; return {...publicAsset,locked:isAssetLocked(asset),previewUrl:previewUrlFor(asset,location),mediaUrl:mediaUrlFor(asset)}; }
const scanBroadcastQueues=new Map();
function broadcastScanAssets(location,assets,done=false){if(!mainWindow||mainWindow.isDestroyed()||!assets.length&&!done)return;const visibleAssets=assets.filter((asset)=>!isAssetLocked(asset)),key=`${activePortfolioId}:${location.id}`,queue=scanBroadcastQueues.get(key)||{items:[],running:false};for(let offset=0;offset<visibleAssets.length;offset+=100)queue.items.push({portfolioId:activePortfolioId,locationId:location.id,assets:visibleAssets.slice(offset,offset+100).map((asset)=>publicAssetForRenderer(asset,location)),done:false});if(done){if(queue.items.length)queue.items.at(-1).done=true;else queue.items.push({portfolioId:activePortfolioId,locationId:location.id,assets:[],done:true});}scanBroadcastQueues.set(key,queue);if(queue.running)return;queue.running=true;const drain=()=>{const message=queue.items.shift();if(!message){queue.running=false;scanBroadcastQueues.delete(key);return;}if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('scan:assets',message);setTimeout(drain,16);};drain();}
function broadcastSidebar(){if(!mainWindow||mainWindow.isDestroyed())return;mainWindow.webContents.send('sidebar:changed',{collections:publicCollections(),smartFolders:library.smartFolders,settings:{sidebarSort:library.settings?.sidebarSort||{},sidebarBranchSort:library.settings?.sidebarBranchSort||{}},activePortfolioId});}
function broadcast() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const generation = ++libraryStreamGeneration;
  mainWindow.webContents.send('library:changed', { ...publicLibrarySummary(), streamGeneration: generation });
  const locationsById = new Map(library.locations.map((location) => [location.id, location])),visibleAssets=rendererVisibleAssets();
  let offset = 0;
  const sendNextBatch = () => {
    if (generation !== libraryStreamGeneration || !mainWindow || mainWindow.isDestroyed()) return;
    const assets = visibleAssets.slice(offset, offset + 500).map((asset) => publicAssetForRenderer(asset,locationsById.get(asset.locationId)));
    offset += assets.length;
    const done = offset >= visibleAssets.length;
    mainWindow.webContents.send('library:assets', { generation, assets, done });
    if (done && smokeTest) console.log('[smoke] asset stream complete');
    if (!done) setTimeout(sendNextBatch, 20);
  };
  setImmediate(sendNextBatch);
}

function broadcastLocations() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('locations:changed', {
    locations: library.locations,
    loading: library.loading,
    totalAssets: library.assets.length
  });
}

function scheduleBroadcast(delay = 80) {
  clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(broadcastLocations, delay);
}
function reportBackgroundProgress(id, { label, detail = '', completed = 0, total = 0, done = false, status = done ? 'completed' : 'running' } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('background:progress', { id, portfolioId: activePortfolioId, label: String(label || 'Working…'), detail: String(detail || ''), completed: Math.max(0, Number(completed) || 0), total: Math.max(0, Number(total) || 0), done: Boolean(done), status, updatedAt: Date.now() });
}
function beginBackgroundRun(type, suffix = '') {
  const key = `${activePortfolioId}:${type}:${suffix}`; const existing = backgroundRuns.get(key); if (existing && !existing.cancelled) return null;
  const run = { key, type, portfolioId: activePortfolioId, epoch: backgroundEpoch, library, cancelled: false, progressId: `${activePortfolioId}:${type}${suffix ? `:${suffix}` : ''}` }; backgroundRuns.set(key, run); return run;
}
function backgroundRunActive(run) { return Boolean(run && !run.cancelled && run.epoch === backgroundEpoch && run.portfolioId === activePortfolioId && run.library === library && !app.isQuitting); }
function finishBackgroundRun(run) { if (run && backgroundRuns.get(run.key) === run) backgroundRuns.delete(run.key); }
function backgroundDelay(ms, run) { return new Promise((resolve) => setTimeout(() => resolve(backgroundRunActive(run)), ms)); }
async function retryBackground(operation, run, { attempts = 3, timeout = 10000, baseDelay = 100, label = 'Background operation' } = {}) {
  let lastError; for (let attempt = 0; attempt < attempts && backgroundRunActive(run); attempt += 1) { try { return await withTimeout(operation(attempt), timeout, `${label} timed out`); } catch (error) { lastError = error; recordDiagnostic(attempt + 1 < attempts ? 'warning' : 'error', `${label} failed`, { attempt: attempt + 1, error: error.message }); if (attempt + 1 < attempts && !(await backgroundDelay(baseDelay * 2 ** attempt, run))) break; } }
  return { ok: false, message: lastError?.message || `${label} cancelled` };
}
function schedulePortfolioBackground(callback, delay = 0) { const portfolioId = activePortfolioId, epoch = backgroundEpoch; const timer = setTimeout(() => { portfolioBackgroundTimers.delete(timer); if (portfolioId === activePortfolioId && epoch === backgroundEpoch && !app.isQuitting) callback(); }, delay); portfolioBackgroundTimers.add(timer); return timer; }
async function cancelPortfolioBackground(reason = 'Portfolio switched') {
  backgroundEpoch += 1; for (const run of backgroundRuns.values()) { run.cancelled = true; reportBackgroundProgress(run.progressId, { label: run.type, detail: reason, done: true, status: 'paused' }); } backgroundRuns.clear();
  for (const timer of portfolioBackgroundTimers) clearTimeout(timer); portfolioBackgroundTimers.clear();
  while (thumbnailQueue.length) thumbnailQueue.shift().resolve({ ok: false, cancelled: true, message: reason });
  for (const worker of thumbnailWorkers.splice(0)) { clearTimeout(worker.jobTimer); worker.currentJob?.resolve({ ok: false, cancelled: true, message: reason }); worker.currentJob = null; worker.terminate().catch(() => {}); }
  for (const worker of backgroundHashWorkers) worker.terminate().catch(() => {}); backgroundHashWorkers.clear();
  for (const child of activeFfmpegChildren) child.kill();
  if(activeSimilarityJob){activeSimilarityJob.resolve([]);activeSimilarityJob.worker.terminate().catch(()=>{});activeSimilarityJob=null;}
}

async function writeBackup(reason = 'automatic') {
  if(scanWorkActive())throw new Error('Backup deferred until indexing completes');
  await fsp.mkdir(backupDir, { recursive: true }); if(databaseSaveInFlight)await databaseSaveInFlight;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-'),target=path.join(backupDir,`pigeon-${reason}-${stamp}.db`);
  await sendDatabaseRequest('backup',null,target);
  const backups=(await fsp.readdir(backupDir)).filter((name)=>name.endsWith('.db')).sort().reverse();
  await Promise.all(backups.slice(20).map((name)=>fsp.rm(path.join(backupDir,name),{force:true})));
  lastBackupAt=Date.now(); return target;
}

function startDatabaseWorker() {
  if (databaseWorker) databaseWorker.terminate().catch(() => {});
  databaseWorker = new Worker(path.join(__dirname, 'database-worker.js'), { workerData: { databaseFile } }); trackWorker(databaseWorker, 'database');
  databaseWorker.on('message', ({ id, ok, message }) => { const request = databaseRequests.get(id); if (!request) return; databaseRequests.delete(id); ok ? request.resolve(true) : request.reject(new Error(message)); });
  databaseWorker.on('error', (error) => { recordDiagnostic('error', 'Database worker failed', error); for (const request of databaseRequests.values()) request.reject(error); databaseRequests.clear(); databaseWorker = null; });
}
function sendDatabaseRequest(action,snapshot,target=null) { if (!databaseWorker) startDatabaseWorker(); return new Promise((resolve,reject)=>{ const id=++databaseRequestId; databaseRequests.set(id,{resolve,reject}); databaseWorker.postMessage({id,action,library:snapshot,target}); }); }
function sendDatabaseSave(snapshot){ return sendDatabaseRequest('save',snapshot); }
function persistScanBatch(location,assets){ return sendDatabaseRequest('save-batch',{location:location?{...location,scanning:false,checking:false}:null,assets}); }
function persistAssetBatch(assets){return persistScanBatch(null,assets);}
function persistLibrary(snapshot = library) {
  pendingDatabaseSnapshot = snapshot; if(databaseSaveInFlight) return databaseSaveInFlight;
  databaseSaveInFlight=(async()=>{ while(pendingDatabaseSnapshot){ const next=pendingDatabaseSnapshot; pendingDatabaseSnapshot=null; await sendDatabaseSave(next); } })().finally(()=>{databaseSaveInFlight=null;}); return databaseSaveInFlight;
}
async function acquirePdfWorkerSlot(){ if(activePdfWorkers>=PDF_WORKER_LIMIT) await new Promise((resolve)=>pdfWorkerWaiters.push(resolve)); activePdfWorkers+=1; }
function releasePdfWorkerSlot(){ activePdfWorkers=Math.max(0,activePdfWorkers-1); pdfWorkerWaiters.shift()?.(); }
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => { if(scanWorkActive()){scheduleSave();return;} try { await persistLibrary(library); if (Date.now() - lastBackupAt > 60 * 60 * 1000) await writeBackup(); } catch (error) { recordDiagnostic('error', 'Could not save SQLite library', error); } }, scanWorkActive()?2000:120);
}

function portfolioDatabasePath(id) { return id === 'default' ? path.join(app.getPath('userData'), 'library.db') : path.join(app.getPath('userData'), 'portfolios', `${id}.db`); }
function scanQueuePath(portfolioId,locationId){ return path.join(app.getPath('userData'),'scan-queues',portfolioId,`${locationId}.json`); }
async function saveScanQueue(portfolioId,locationId,filePaths){ const target=scanQueuePath(portfolioId,locationId); await fsp.mkdir(path.dirname(target),{recursive:true}); await fsp.writeFile(`${target}.tmp`,JSON.stringify(filePaths)); await fsp.rename(`${target}.tmp`,target); }
async function loadScanQueue(portfolioId,locationId){ try{return JSON.parse(await fsp.readFile(scanQueuePath(portfolioId,locationId),'utf8'));}catch{return null;} }
async function removeScanQueue(portfolioId,locationId){ await fsp.rm(scanQueuePath(portfolioId,locationId),{force:true}); }
function portfolioLegacyJsonPath(portfolio) { return portfolio?.legacyFile || (portfolio?.file?.toLowerCase().endsWith('.json') ? portfolio.file : null); }
function initializeStoragePaths() {
  const legacyFile = path.join(app.getPath('userData'), 'library.json');
  portfolioRegistryFile = path.join(app.getPath('userData'), 'portfolios.json');
  portfolios = [{ id: 'default', name: 'My Portfolio', database: portfolioDatabasePath('default'), legacyFile }];
  activePortfolioId = 'default';
  databaseFile = portfolioDatabasePath('default'); legacyJsonFile = smokeTest && process.env.PIGEON_SMOKE_LIBRARY ? process.env.PIGEON_SMOKE_LIBRARY : legacyFile;
  thumbnailDir = path.join(app.getPath('userData'), 'thumbnails');
  importsDir = path.join(app.getPath('userData'), 'imports');
  backupDir = path.join(app.getPath('userData'), 'backups');
  pluginsDir = path.join(app.getPath('userData'), 'plugins');
  mapTileDir = path.join(app.getPath('userData'), 'map-tiles');
  diagnosticsFile = path.join(app.getPath('userData'), 'diagnostics.jsonl');
  try { diagnosticEntries = fs.readFileSync(diagnosticsFile, 'utf8').trim().split(/\r?\n/).slice(-1000).map((line) => JSON.parse(line)); } catch { diagnosticEntries = []; }
}
function normalizedPortfolioDatabase(value){return path.resolve(String(value||'')).toLowerCase();}
async function isPortfolioDatabase(file){try{const handle=await fsp.open(file,'r'),header=Buffer.alloc(16);await handle.read(header,0,16,0);await handle.close();return header.toString('utf8')==='SQLite format 3\u0000';}catch{return false;}}
async function discoverPortfolioDatabases(){const directory=path.join(app.getPath('userData'),'portfolios');await fsp.mkdir(directory,{recursive:true});const known=new Set(portfolios.map((item)=>normalizedPortfolioDatabase(item.database||portfolioDatabasePath(item.id))));let recovered=0;for(const entry of await fsp.readdir(directory,{withFileTypes:true})){if(!entry.isFile()||path.extname(entry.name).toLowerCase()!=='.db')continue;const database=path.join(directory,entry.name),key=normalizedPortfolioDatabase(database);if(known.has(key)||!(await isPortfolioDatabase(database)))continue;const id=path.basename(entry.name,'.db'),stem=`Recovered Portfolio ${id.slice(0,8)}`;let name=stem,suffix=2;while(portfolios.some((item)=>item.name.toLowerCase()===name.toLowerCase()))name=`${stem} ${suffix++}`;portfolios.push({id,name,database,legacyFile:null,managed:false,recovered:true});known.add(key);recovered+=1;}if(recovered)recordDiagnostic('warning',`Recovered ${recovered} portfolio database${recovered===1?'':'s'} missing from the registry`);return recovered;}
async function savePortfolioRegistry() {
  if (smokeTest) return;
  const snapshot=JSON.stringify({ activePortfolioId, portfolios }, null, 2),target=portfolioRegistryFile,temporary=`${target}.tmp`,backup=`${target}.bak`;
  portfolioRegistrySave=portfolioRegistrySave.then(async()=>{await fsp.mkdir(path.dirname(target),{recursive:true});try{const current=await fsp.readFile(target,'utf8');JSON.parse(current);await fsp.writeFile(backup,current);}catch{}await fsp.writeFile(temporary,snapshot);const handle=await fsp.open(temporary,'r+');await handle.sync();await handle.close();await fsp.rename(temporary,target);}).catch((error)=>{recordDiagnostic('error','Could not save portfolio registry',error);throw error;});return portfolioRegistrySave;
}
async function loadPortfolioRegistry() {
  let parsed=null,loadError=null;
  for(const candidate of [portfolioRegistryFile,`${portfolioRegistryFile}.bak`])try{parsed=JSON.parse(await fsp.readFile(candidate,'utf8'));break;}catch(error){if(error.code!=='ENOENT')loadError=error;}
  if(parsed){if(Array.isArray(parsed.portfolios)&&parsed.portfolios.length)portfolios=parsed.portfolios.filter((item)=>item.id&&item.name).map((item)=>({id:item.id,name:item.name,database:item.database||portfolioDatabasePath(item.id),legacyFile:portfolioLegacyJsonPath(item),managed:item.managed!==false,recovered:Boolean(item.recovered)}));if(portfolios.some((item)=>item.id===parsed.activePortfolioId))activePortfolioId=parsed.activePortfolioId;}else if(loadError)recordDiagnostic('error','Could not load portfolio registry; searching for portfolio databases',loadError);
  await discoverPortfolioDatabases();
  const active = portfolios.find((item) => item.id === activePortfolioId) || portfolios[0];
  activePortfolioId = active.id; databaseFile = active.database || portfolioDatabasePath(active.id); legacyJsonFile = active.legacyFile || null;
  await savePortfolioRegistry();
}
async function saveLibraryNow() {
  clearTimeout(saveTimer); saveTimer = null;
  await persistLibrary(library);
}

async function loadLibraryInWorker() {
  await fsp.mkdir(thumbnailDir, { recursive: true });
  return new Promise((resolve) => {
    const worker = new Worker(path.join(__dirname, 'library-worker.js'), { workerData: { databaseFile, legacyJsonFile } }); trackWorker(worker, 'library-load');
    worker.once('message', (result) => {
      if (smokeTest) console.log('[smoke] library worker returned');
      if (result.library && Array.isArray(result.library.locations) && Array.isArray(result.library.assets)) {
        library = { ...libraryCore.migrateLibrary(result.library), loading: false }; for (const location of library.locations) { location.scanning = false; location.checking = false; location.rescanRequested = false; }
        let autoTagsReconciled = false; for (const asset of library.assets) { const before = (asset.tags || []).length; applyConfiguredCollectionTags(asset); if (asset.tags.length !== before) autoTagsReconciled = true; } if (autoTagsReconciled) scheduleSave();
      } else if (!result.error) library = { ...libraryCore.migrateLibrary({}), loading: false };
      else {
        library = { ...libraryCore.migrateLibrary({}), loading: false, loadError: result.error.message || null };
        console.error('Could not load SQLite library:', result.error);
      }
      resolve();
    });
    worker.once('error', (error) => {
      console.error('Library worker failed:', error);
      library = { version: 1, locations: [], assets: [], loading: false, loadError: error.message };
      resolve();
    });
  });
}

function execFileText(file, args, timeout = 4000) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout }, (error, stdout) => resolve(error ? '' : stdout.trim()));
  });
}

async function isRemovable(targetPath) {
  const resolved = path.resolve(targetPath);
  if (process.platform === 'win32') {
    const root = path.parse(resolved).root.replace('\\', '').replace(':', '');
    const script = `(Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='${root}:'\").DriveType`;
    const result = await execFileText('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
    return result === '2' || result === '4';
  }
  if (process.platform === 'darwin') return resolved.startsWith('/Volumes/');
  return resolved.startsWith('/media/') || resolved.startsWith('/mnt/') || resolved.startsWith('/run/media/');
}

function withTimeout(promise, timeout, message = 'Operation timed out') { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(message)), timeout); Promise.resolve(promise).then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); }); }); }
async function fileContainsAtom(filePath, atom) {
  return new Promise((resolve) => { const needle = Buffer.from(atom), stream = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 }); let tail = Buffer.alloc(0), settled = false; const finish = (value) => { if (settled) return; settled = true; stream.destroy(); resolve(value); }; stream.on('data', (chunk) => { const data = tail.length ? Buffer.concat([tail, chunk]) : chunk; if (data.includes(needle)) finish(true); else tail = data.subarray(Math.max(0, data.length - needle.length + 1)); }); stream.on('end', () => finish(false)); stream.on('error', () => finish(true)); });
}
async function pathAvailable(targetPath, timeout = 1800) {
  if (!targetPath) return false;
  try { await withTimeout(fsp.access(targetPath, fs.constants.F_OK), timeout, 'Path check timed out'); return true; }
  catch { return false; }
}

function finishThumbnailWorkerJob(worker, result, retire = false) {
  const job = worker.currentJob; if (!job) { if (retire) { const index = thumbnailWorkers.indexOf(worker); if (index >= 0) thumbnailWorkers.splice(index, 1); worker.terminate().catch(() => {}); dispatchThumbnailJobs(); } return; }
  clearTimeout(worker.jobTimer); worker.jobTimer = null; worker.busy = false; worker.currentJob = null; if (worker.telemetry) { worker.telemetry.filesCompleted += result?.ok ? 1 : 0; worker.telemetry.currentFile = ''; worker.telemetry.status = 'idle'; } job.resolve(result);
  if (retire) { const index = thumbnailWorkers.indexOf(worker); if (index >= 0) thumbnailWorkers.splice(index, 1); worker.terminate().catch(() => {}); }
  dispatchThumbnailJobs();
}
function startThumbnailWorker() {
  const worker = new Worker(path.join(__dirname, 'thumbnail-worker.js')); worker.telemetry = trackWorker(worker, 'thumbnail');
  worker.busy = false; worker.currentJob = null; worker.jobTimer = null;
  worker.on('message', (result) => finishThumbnailWorkerJob(worker, result));
  worker.on('error', (error) => { console.error('Thumbnail worker failed:', error); finishThumbnailWorkerJob(worker, { ok: false, message: error.message || 'Preview worker failed' }, true); });
  thumbnailWorkers.push(worker);
}

function dispatchThumbnailJobs() {
  const concurrency=scanWorkActive()?1:THUMBNAIL_WORKER_COUNT;
  while (thumbnailWorkers.length < concurrency) startThumbnailWorker();
  let dispatched=thumbnailWorkers.filter((worker)=>worker.busy).length;
  for (const worker of [...thumbnailWorkers]) {
    if (dispatched>=concurrency||worker.busy || !thumbnailQueue.length) continue;
    dispatched+=1;
    const job = thumbnailQueue.shift(); worker.busy = true; worker.currentJob = job; if (worker.telemetry) { worker.telemetry.filesTotal += 1; worker.telemetry.currentFile = job.source; worker.telemetry.status = 'running'; }
    worker.jobTimer = setTimeout(() => { recordDiagnostic('warning', 'Preview worker timed out', { source: job.source, timeout: 10000 }); finishThumbnailWorkerJob(worker, { ok: false, message: 'Preview generation timed out' }, true); }, 10000);
    worker.postMessage({ source: job.source, target: job.target });
  }
}

const activeFfmpegChildren = new Set();
function streamVideoCompatibility(asset, duration = asset.duration) {
  const partialPath = path.join(thumbnailDir, `${asset.id}.${Date.now()}.partial.mp4`), finalPath = path.join(thumbnailDir, `${asset.id}.preview.mp4`);
  const durationArgs = Number(duration) > 0 ? ['-t', String(Number(duration).toFixed(3))] : [], args = ['-nostdin', '-threads', '1', '-filter_threads', '1', '-hide_banner', '-loglevel', 'error', '-i', asset.path, ...durationArgs, '-map', '0:v:0', '-map', '0:a?', '-vf', 'scale=960:540:force_original_aspect_ratio=decrease:force_divisible_by=2', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-x264-params', 'threads=1:lookahead_threads=1:keyint=24:scenecut=0', '-crf', '29', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-frag_duration', '1000000', '-f', 'mp4', 'pipe:1'];
  const child = spawn(ffmpegExecutable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }), cache = fs.createWriteStream(partialPath); activeFfmpegChildren.add(child);
  if (process.platform === 'win32' && child.pid) execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `try { (Get-Process -Id ${child.pid}).PriorityClass = 'BelowNormal' } catch {}`], { windowsHide: true, timeout: 3000 }, () => {});
  let controller, canceled = false, stderr = '';
  child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-2000); });
  child.stdout.on('data', (chunk) => { cache.write(chunk); if (!canceled) { try { controller.enqueue(new Uint8Array(chunk)); } catch { canceled = true; child.kill(); } } });
  const finished = new Promise((resolve) => cache.on('finish', resolve).on('error', resolve));
  child.once('close', async (code) => {
    activeFfmpegChildren.delete(child); cache.end(); await finished;
    if (!canceled && code === 0) { try { await fsp.rm(finalPath, { force: true }); await fsp.rename(partialPath, finalPath); asset.proxyPath = finalPath; asset.proxyVersion = 2; scheduleSave(); broadcast(); } catch {} }
    else { fsp.rm(partialPath, { force: true }).catch(() => {}); if (stderr) console.error(`Compatibility stream failed for ${asset.filename}: ${stderr}`); }
    if (!canceled) { try { controller.close(); } catch {} }
  });
  child.once('error', (error) => { canceled = true; cache.destroy(); fsp.rm(partialPath, { force: true }).catch(() => {}); try { controller.error(error); } catch {} });
  const body = new ReadableStream({ start(value) { controller = value; }, cancel() { canceled = true; child.kill(); cache.destroy(); fsp.rm(partialPath, { force: true }).catch(() => {}); } });
  return new Response(body, { status: 200, headers: { 'content-type': 'video/mp4', 'accept-ranges': 'none', 'cache-control': 'no-store' } });
}
function probeVideoDuration(asset) {
  const complete = asset.mediaProbed && Number(asset.duration) > 0 && (asset.kind === 'audio' || asset.videoCodec) && (asset.kind !== 'video' || asset.width && asset.height);
  if (complete) return Promise.resolve(asset.duration);
  return new Promise((resolve) => { const child = execFile(ffmpegExecutable, ['-nostdin', '-hide_banner', '-i', asset.path, '-map', asset.kind === 'audio' ? '0:a:0' : '0:v:0', '-c', 'copy', '-t', '0.01', '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null'], { windowsHide: true, timeout: 4000, maxBuffer: 256 * 1024 }, (_error, _stdout, stderr = '') => { activeFfmpegChildren.delete(child); const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/), videoLine = stderr.match(/Video:\s*([^\r\n]+)/i)?.[1] || '', codec = videoLine.match(/^([^\s,(]+)/)?.[1]?.toLowerCase(), dimensions = videoLine.match(/(?:^|[,\s])(\d{2,6})x(\d{2,6})(?:[\s,]|$)/), audioCodec = stderr.match(/Audio:\s*([^\s,(]+)/i)?.[1]?.toLowerCase(); const duration = match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : 0; if (duration > 0) asset.duration = duration; if (codec) asset.videoCodec = codec; if (dimensions) { asset.width = Number(dimensions[1]); asset.height = Number(dimensions[2]); } asset.audioCodec = audioCodec || null; asset.mediaProbed = true; resolve(duration); }); activeFfmpegChildren.add(child); child.once('error', () => { activeFfmpegChildren.delete(child); resolve(0); }); if (process.platform === 'win32' && child.pid) execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `try { (Get-Process -Id ${child.pid}).PriorityClass = 'BelowNormal' } catch {}`], { windowsHide: true, timeout: 1000 }, () => {}); });
}
function runFfmpeg(args, timeout = 15 * 60 * 1000) {
  const limitedArgs = ['-nostdin', '-threads', '1', '-filter_threads', '1', ...args];
  return new Promise((resolve) => {
    const child = execFile(ffmpegExecutable, limitedArgs, { windowsHide: true, timeout, maxBuffer: 256 * 1024 }, (error) => resolve(!error)); activeFfmpegChildren.add(child); child.once('exit', () => activeFfmpegChildren.delete(child));
    if (process.platform === 'win32' && child.pid) execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `try { (Get-Process -Id ${child.pid}).PriorityClass = 'BelowNormal' } catch {}`], { windowsHide: true, timeout: 3000 }, () => {});
  });
}
function runVideoFfmpeg(args, timeout = 12000) { return runFfmpeg(args, Math.min(20000, timeout)); }
async function createVideoThumbnail(asset, target) {
  if (!smokeTest) await probeVideoDuration(asset);
  const thumbnailReady = asset.thumbnailPath || await runVideoFfmpeg(['-hide_banner', '-loglevel', 'error', '-ss', '0.25', '-i', asset.path, '-frames:v', '1', '-vf', 'scale=512:512:force_original_aspect_ratio=decrease', '-q:v', '5', '-y', target], 9000);
  return thumbnailReady ? { ok: true, target: asset.thumbnailPath || target, proxyPath: asset.proxyPath || null, width: asset.width, height: asset.height, duration: asset.duration } : null;
}
async function createAudioThumbnail(asset, target) {
  if (!smokeTest) await probeVideoDuration(asset);
  const ready = asset.thumbnailPath || await runVideoFfmpeg(['-hide_banner', '-loglevel', 'error', '-i', asset.path, '-filter_complex', 'aformat=channel_layouts=mono,showwavespic=s=900x240:colors=9aa4b8', '-frames:v', '1', '-q:v', '4', '-y', target], 9000);
  return ready ? { ok: true, target: asset.thumbnailPath || target, duration: asset.duration } : null;
}
async function extractZipPreview(source,target){const script=`Add-Type -AssemblyName System.IO.Compression.FileSystem;$z=[IO.Compression.ZipFile]::OpenRead($args[0]);try{$e=$z.Entries|Where-Object{$_.FullName -match '(?i)(^|/)(preview|thumbnail)(@2x)?\\.(png|jpe?g|webp)$'}|Sort-Object Length -Descending|Select-Object -First 1;if(!$e){exit 2};$s=$e.Open();$o=[IO.File]::Create($args[1]);try{$s.CopyTo($o)}finally{$o.Dispose();$s.Dispose()}}finally{$z.Dispose()}`;return new Promise((resolve)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',script,source,target],{windowsHide:true,timeout:8000,maxBuffer:64*1024},(error)=>resolve(!error)));}
async function createDocumentThumbnail(asset, target) {
  if (AFFINITY_PREVIEW_EXTENSIONS.has(asset.extension)) {
    if (asset.thumbnailPath && await pathAvailable(asset.thumbnailPath) && asset.proxyPath && await pathAvailable(asset.proxyPath)) return { ok:true,target:asset.thumbnailPath,proxyPath:asset.proxyPath,width:asset.width,height:asset.height };
    const extracted=await extractAffinityPreview(asset.path,path.join(thumbnailDir,`${asset.id}.affinity-preview`));
    if(!extracted){asset.proxyPath=null;asset.proxyVersion=null;return null;}
    try{const metadata=await sharp(extracted.target,{limitInputPixels:100*1024*1024}).metadata();await sharp(extracted.target,{limitInputPixels:100*1024*1024}).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).flatten({background:'#20232d'}).jpeg({quality:78}).toFile(target);asset.proxyPath=extracted.target;asset.proxyVersion=3;return{ok:true,target,proxyPath:extracted.target,width:extracted.width,height:extracted.height,technicalMetadata:{format:'affinity',affinityType:asset.extension.toLowerCase(),affinityVersion:extracted.affinityVersion,previewFormat:metadata.format,hasAlpha:metadata.hasAlpha}};}catch(error){await fsp.rm(extracted.target,{force:true});throw error;}
  }
  if (asset.extension==='SNAGX') {
    if (asset.thumbnailPath && await pathAvailable(asset.thumbnailPath) && asset.proxyPath && await pathAvailable(asset.proxyPath)) return { ok:true,target:asset.thumbnailPath,proxyPath:asset.proxyPath,width:asset.width,height:asset.height };
    const extracted=await extractSnagxPreview(asset.path,path.join(thumbnailDir,`${asset.id}.snagx-preview`));if(!extracted)return null;
    try{const metadata=await sharp(extracted.target).metadata();await sharp(extracted.target).rotate().resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).flatten({background:'#20232d'}).jpeg({quality:76}).toFile(target);asset.proxyPath=extracted.target;asset.proxyVersion=3;return{ok:true,target,proxyPath:extracted.target,width:metadata.width,height:metadata.height,technicalMetadata:{format:'snagx',previewEntry:extracted.entryName,previewFormat:metadata.format,hasAlpha:metadata.hasAlpha}};}catch(error){await fsp.rm(extracted.target,{force:true});throw error;}
  }
  if (asset.thumbnailPath && await pathAvailable(asset.thumbnailPath) && !(asset.extension==='PDF'&&asset.pdfPreviewVersion!==2)) return { ok: true, target: asset.thumbnailPath };
  if (asset.extension==='SKETCH'||asset.extension==='FREE'){if(process.platform!=='win32')return null;const extracted=`${target}.embedded`;if(!(await extractZipPreview(asset.path,extracted)))return null;try{const metadata=await sharp(extracted).metadata();await sharp(extracted).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).flatten({background:'#20232d'}).jpeg({quality:72}).toFile(target);return{ok:true,target,width:metadata.width,height:metadata.height};}finally{await fsp.rm(extracted,{force:true});}}
  if (asset.extension !== 'PDF') { const ready = await runVideoFfmpeg(['-hide_banner', '-loglevel', 'error', '-i', asset.path, '-frames:v', '1', '-vf', 'scale=512:512:force_original_aspect_ratio=decrease', '-q:v', '5', '-y', target], 9000); return ready ? { ok: true, target } : null; }
  await acquirePdfWorkerSlot(); try { return await new Promise((resolve) => { const child=utilityProcess.fork(path.join(__dirname,'pdf-thumbnail-child.js'),[],{serviceName:'Pigeon PDF preview'}); let settled=false; const finish=(result)=>{if(settled)return;settled=true;clearTimeout(timer);try{child.kill();}catch{} resolve(result?.ok?result:null);}; const timer=setTimeout(()=>{recordDiagnostic('warning','PDF preview timed out',{file:asset.path});finish(null);},30000); child.on('message',finish); child.on('error',(error)=>{recordDiagnostic('error','Isolated PDF preview failed',error);finish(null);}); child.on('exit',(code)=>{if(code!==0)recordDiagnostic('warning','Isolated PDF preview process exited',{code,file:asset.path});finish(null);}); child.postMessage({source:asset.path,target}); }); } finally { releasePdfWorkerSlot(); }
}
async function createVideoProxy(asset) {
  if (asset.proxyVersion === 2 && asset.proxyPath && await pathAvailable(asset.proxyPath) && !(await fileContainsAtom(asset.proxyPath, 'moof'))) { asset.proxyVersion = 3; scheduleSave(); return asset.proxyPath; }
  if (asset.proxyVersion === 3 && asset.proxyPath && await pathAvailable(asset.proxyPath)) return asset.proxyPath;
  const proxyPath = path.join(thumbnailDir, `${asset.id}.preview.mp4`), partialPath = path.join(thumbnailDir, `${asset.id}.${Date.now()}.partial.mp4`);
  const base = ['-hide_banner', '-loglevel', 'error', '-hwaccel', 'auto', '-i', asset.path, '-map', '0:v:0', '-map', '0:a?', '-vf', 'scale=960:540:force_original_aspect_ratio=decrease:force_divisible_by=2'], encoders = [['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '29', '-b:v', '0'], ['-c:v', 'h264_mf', '-quality', '70'], ['-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-x264-params', 'threads=1:lookahead_threads=1', '-crf', '29']];
  let ready = false; for (const encoder of encoders) { await fsp.rm(partialPath, { force: true }); ready = await runVideoFfmpeg([...base, ...encoder, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-y', partialPath]); if (ready) break; }
  if (!ready) { await fsp.rm(partialPath, { force: true }); return null; }
  await fsp.rm(proxyPath, { force: true }); await fsp.rename(partialPath, proxyPath); asset.proxyVersion = 3; return proxyPath;
}

async function createThumbnail(asset) {
  const target = path.join(thumbnailDir, `${asset.id}.jpg`);
  if (asset.kind === 'video') return createVideoThumbnail(asset, target);
  if (asset.kind === 'audio') return createAudioThumbnail(asset, target);
  if (asset.kind === 'document' && PREVIEWABLE_DOCUMENT_EXTENSIONS.has(asset.extension)) return createDocumentThumbnail(asset, target);
  if (asset.kind !== 'image') return null;
  const key = `${asset.id}:${asset.modified || 0}`; if (thumbnailPreparationJobs.has(key)) return thumbnailPreparationJobs.get(key);
  const job = new Promise((resolve) => { thumbnailQueue.push({ source: asset.path, target, resolve }); dispatchThumbnailJobs(); }).finally(() => thumbnailPreparationJobs.delete(key));
  thumbnailPreparationJobs.set(key, job); return job;
}
function prepareVideoFiles(asset, includeProxy = false) {
  const key = `${asset.id}:${includeProxy ? 'proxy' : 'thumbnail'}`;
  if (videoPreparationJobs.has(key)) return videoPreparationJobs.get(key);
  const job = (async () => { const thumbnail = await createThumbnail(asset); if (includeProxy) { const proxyPath = await createVideoProxy(asset); return thumbnail ? { ...thumbnail, proxyPath } : proxyPath ? { ok: true, target: asset.thumbnailPath, proxyPath } : null; } return thumbnail; })().finally(() => videoPreparationJobs.delete(key));
  videoPreparationJobs.set(key, job); return job;
}

function hashFile(filePath, timeout = 10000) {
  return new Promise((resolve) => {
    const worker = new Worker(path.join(__dirname, 'hash-worker.js'), { workerData: { source: filePath } }); backgroundHashWorkers.add(worker); const telemetry = trackWorker(worker, 'fingerprint', { filesTotal: 1 }); telemetry.currentFile = filePath; let settled = false;
    const finish = (value) => { if (settled) return; settled = true; telemetry.filesCompleted = value ? 1 : 0; telemetry.status = value ? 'completed' : 'failed'; telemetry.expectedExit = true; clearTimeout(timer); backgroundHashWorkers.delete(worker); worker.terminate().catch(() => {}); resolve(value); };
    const timer = setTimeout(() => { recordDiagnostic('warning', 'File fingerprint timed out', { filePath, timeout }); finish(null); }, timeout);
    worker.once('message', (result) => finish(result.ok ? result.hash : null)); worker.once('error', (error) => { recordDiagnostic('error', 'Fingerprint worker failed', error); finish(null); }); worker.once('exit', () => finish(null));
  });
}

function normalizedSubfolder(value = '') { return String(value).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/'); }
function folderRuleKey(locationId, subfolder = '') { return `${locationId}:${normalizedSubfolder(subfolder).toLowerCase()}`; }
function folderExcluded(locationId, subfolder = '') { const folder = normalizedSubfolder(subfolder).toLowerCase(); return (library.settings?.excludedFolders || []).some((value) => { const [id, ...parts] = String(value).split(':'); const excluded = parts.join(':'); return id === locationId && (folder === excluded || folder.startsWith(`${excluded}/`)); }); }
function assetMatchesFolder(asset, location, subfolder = '') {
  if (!asset || !location || asset.locationId !== location.id) return false;
  const folder = normalizedSubfolder(subfolder).toLowerCase(); if (!folder) return true;
  const relative = normalizedSubfolder(path.relative(location.path, asset.path)).toLowerCase();
  return relative !== '..' && !relative.startsWith('../') && relative.startsWith(`${folder}/`);
}
function configuredFolderTags(location, filePath) {
  const rules = Object.values(library.settings?.folderAutoTags || {}), candidate = { locationId: location.id, path: filePath };
  return [...new Set(rules.filter((rule) => rule.locationId === location.id && assetMatchesFolder(candidate, location, rule.subfolder)).flatMap((rule) => rule.tags || []))];
}
function collectionDescendants(collectionId) {
  const ids = new Set([collectionId]); let changed = true;
  while (changed) { changed = false; for (const collection of library.collections) if (collection.parentId && ids.has(collection.parentId) && !ids.has(collection.id)) { ids.add(collection.id); changed = true; } }
  return ids;
}
function configuredCollectionTags(collectionIds = []) {
  const assigned = new Set(collectionIds), rules = Object.values(library.settings?.collectionAutoTags || {}); if (!assigned.size) return [];
  return [...new Set(rules.filter((rule) => [...collectionDescendants(rule.collectionId)].some((id) => assigned.has(id))).flatMap((rule) => rule.tags || []))];
}
function applyConfiguredCollectionTags(asset) { asset.tags = [...new Set([...(asset.tags || []), ...configuredCollectionTags(asset.collectionIds)])]; return asset; }
function canonicalTags(tags) {
  const known = new Map(library.assets.flatMap((asset) => asset.tags || []).map((tag) => [tag.toLowerCase(), tag]));
  return [...new Map((tags || []).map((tag) => String(tag).trim()).filter(Boolean).slice(0, 64).map((tag) => [tag.toLowerCase(), known.get(tag.toLowerCase()) || tag])).values()];
}

async function inspectFile(filePath, location, existing, { deferHash = false, inspection = null } = {}) {
  try {
    const stat = inspection || await withTimeout(fsp.stat(filePath), location.unstable ? 2500 : 8000, 'File metadata timed out');
    if (!inspection && !stat.isFile()) return null;
    const extension = path.extname(filePath).toLowerCase();
    const unchanged = existing && existing.size === stat.size && existing.modified === (stat.mtimeMs ?? stat.modified);
    const contentHash = inspection ? inspection.contentHash : unchanged && existing.contentHash ? existing.contentHash : deferHash ? existing?.contentHash || null : await hashFile(filePath, location.unstable ? 8000 : 30000);
    const asset = {
      id: makeId(path.resolve(filePath).toLowerCase()),
      locationId: location.id,
      path: path.resolve(filePath),
      name: path.basename(filePath, extension),
      filename: path.basename(filePath),
      extension: extension.slice(1).toUpperCase() || 'FILE',
      kind: kindFor(extension),
      size: stat.size,
      created: stat.birthtimeMs ?? stat.created,
      modified: stat.mtimeMs ?? stat.modified,
      indexedAt: existing?.indexedAt || Date.now(),
      tags: existing?.tags || [],
      note: existing?.note || '',
      rating: existing?.rating || 0,
      favorite: existing?.favorite || false,
      thumbnailPath: unchanged ? existing?.thumbnailPath || null : null,
      thumbnailFailedAt: unchanged ? existing?.thumbnailFailedAt || null : null,
      thumbnailFailedModified: unchanged ? existing?.thumbnailFailedModified || null : null,
      thumbnailError: unchanged ? existing?.thumbnailError || null : null,
      width: unchanged ? existing?.width || null : null,
      height: unchanged ? existing?.height || null : null,
      dominantColor: unchanged ? existing?.dominantColor || null : null,
      histogram: unchanged ? existing?.histogram || null : null,
      palette: unchanged ? existing?.palette || null : null,
      perceptualHash: unchanged ? existing?.perceptualHash || null : null,
      exif: unchanged ? existing?.exif || null : null,
      technicalMetadata: unchanged ? existing?.technicalMetadata || null : null,
      contentHash,
      collectionIds: existing?.collectionIds || [],
      annotations: existing?.annotations || [],
      deletedAt: existing?.deletedAt || null,
      sourceUrl: existing?.sourceUrl || null,
      proxyPath: existing?.proxyPath || null,
      proxyVersion: existing?.proxyVersion || null,
      duration: existing?.duration || null,
      videoCodec: existing?.videoCodec || null,
      audioCodec: existing?.audioCodec ?? null,
      mediaProbed: existing?.mediaProbed || false,
      stackId: existing?.stackId || null,
      rotation: existing?.rotation || 0,
      encryptedMediaPaths: existing?.encryptedMediaPaths || {},
      encryptedThumbnailPaths: existing?.encryptedThumbnailPaths || {},
      editedPath: existing?.editedPath || null,
      editedAt: existing?.editedAt || null,
      needsOrganization: Boolean(existing?.needsOrganization),
      inlineCrop: existing?.inlineCrop || null,
      geo: existing?.geo || null,
      sourceMissing: false,
      sourcePending: false,
      missingSince: null
    };
    if (library.settings?.autoTag && !asset.needsOrganization && !asset.tags.length) asset.tags = libraryCore.suggestTags(asset);
    asset.tags = [...new Set([...asset.tags, ...configuredFolderTags(location, asset.path)])];
    return asset;
  } catch {
    return null;
  }
}

function inspectScanBatch(batch, location, previous, run, batchNumber) {
  return new Promise((resolve) => {
    const worker = new Worker(path.join(__dirname, 'scan-worker.js'), { workerData: { batch: batch.map((filePath) => ({ filePath, existing: previous.get(path.resolve(filePath)) ? { size: previous.get(path.resolve(filePath)).size, modified: previous.get(path.resolve(filePath)).modified, contentHash: previous.get(path.resolve(filePath)).contentHash } : null })), deferHash: location.unstable, inlineHashMaxBytes: SCAN_INLINE_HASH_MAX_BYTES, dutyCycle: Math.max(0.08, (INDEX_CPU_LIMIT / 100) / INDEX_WORKER_COUNT) }, resourceLimits: { maxOldGenerationSizeMb: 128 } });
    const telemetry = trackWorker(worker, 'index-scan', { portfolioId: run.portfolioId, filesTotal: batch.length, batch: batchNumber }); telemetry.currentFile = batch[0] || '';
    let settled = false; const finish = async (result) => { if (settled) return; settled = true; clearTimeout(timer); telemetry.filesCompleted = result?.results?.length || 0; telemetry.status = result?.error ? 'failed' : 'completed'; telemetry.expectedExit = true; try { telemetry.memoryBytes = worker.resourceLimits?.maxOldGenerationSizeMb ? worker.resourceLimits.maxOldGenerationSizeMb * 1024 * 1024 : 0; } catch { /* unavailable */ } try { await worker.terminate(); } catch {} resolve(result?.results || []); };
    const timer = setTimeout(() => { recordDiagnostic('warning', 'Index worker timed out', { location: location.path, batch: batchNumber }); finish({ error: 'timeout' }); }, location.unstable ? 15000 : 45000);
    worker.once('message', finish); worker.once('error', (error) => { recordDiagnostic('error', 'Index worker failed', error); finish({ error: error.message }); }); worker.once('exit', () => finish({ error: 'exited' }));
  });
}

async function walkFolder(folderPath, callback, timeout = 8000) {
  const queue = [folderPath]; let cursor=0,processedEntries=0, complete = true;
  while (cursor<queue.length) {
    const current = queue[cursor++];
    let entries;
    try {
      entries = await withTimeout(fsp.readdir(current, { withFileTypes: true }), timeout, 'Folder read timed out');
    } catch {
      complete = false; continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(fullPath);
      else if (entry.isFile()) callback(fullPath);
      processedEntries+=1; if(processedEntries%512===0)await new Promise((resolve)=>setImmediate(resolve));
    }
  }
  return { complete };
}

async function scanLocation(locationId, { notify = true, resume = false } = {}) {
  const location = library.locations.find((item) => item.id === locationId); if (!location) return;
  if (location.scanning) { location.rescanRequested = true; return; }
  const run = beginBackgroundRun('scan', location.id); if (!run) { location.rescanRequested = true; return; }
  const jobLibrary = run.library, progressId = run.progressId; location.unstable = Boolean(location.unstable || location.removable || /[\\/]OneDrive[\\/]|[\\/]Dropbox[\\/]|[\\/]Google Drive[\\/]/i.test(location.path));
  if (!resume) location.scanCheckpoint = null;
  const checkpoint = resume && location.scanCheckpoint?.root === location.path ? location.scanCheckpoint : null;
  location.scanning = true; location.scanProgress = { discovered: checkpoint?.discovered || 0, inspected: checkpoint?.nextIndex || 0, resumed: Boolean(checkpoint) }; reportBackgroundProgress(progressId, { label: `Scanning ${location.name}`, detail: checkpoint ? `Resuming at file ${(checkpoint.nextIndex || 0).toLocaleString()}…` : 'Discovering files…' }); location.checking = true; if (notify) broadcastLocations();
  try {
    location.online = await pathAvailable(location.path); location.checking = false;
    if (!backgroundRunActive(run)) return;
    if (!location.online) { reportBackgroundProgress(progressId, { label: `Scanning ${location.name}`, detail: 'Location is offline', done: true }); scheduleSave(); if (notify) broadcastLocations(); return; }
    const previousAssets = jobLibrary.assets.filter((asset) => asset.locationId === location.id), previous = new Map(previousAssets.map((asset) => [asset.path, asset])), assetIndexes=new Map(jobLibrary.assets.map((asset,index)=>[asset.id,index])); let locationAssetCount=previousAssets.length, scanComplete = checkpoint?.complete !== false;
    let filePaths = checkpoint ? await loadScanQueue(run.portfolioId,location.id) : null;
    if (!filePaths) {
      filePaths = [];
      if (location.type === 'folder') { const walked = await walkFolder(location.path, (filePath) => { if (backgroundRunActive(run)) { const relativeFolder = normalizedSubfolder(path.dirname(path.relative(location.path, filePath))); if (!folderExcluded(location.id, relativeFolder)) { filePaths.push(filePath); location.scanProgress.discovered += 1; } } }, location.unstable ? 3500 : 8000); scanComplete = walked.complete; }
      else filePaths.push(location.path);
      if (!backgroundRunActive(run)) return;
      await saveScanQueue(run.portfolioId,location.id,filePaths); location.scanCheckpoint = { root: location.path, nextIndex: 0, discovered:filePaths.length, complete: scanComplete, startedAt: Date.now() }; await persistScanBatch(location,[]);
    }
    const workerCount = location.unstable ? 2 : Math.min(filePaths.length>=10000?LARGE_SCAN_WORKER_LIMIT:INDEX_WORKER_COUNT, Math.ceil(Math.max(1, filePaths.length - location.scanCheckpoint.nextIndex) / INDEX_BATCH_SIZE));
    reportBackgroundProgress(progressId, { label: `Adding files from ${location.name}`, detail: `${filePaths.length.toLocaleString()} files · ${workerCount} index threads · ${INDEX_CPU_LIMIT}% CPU ceiling`, completed: location.scanCheckpoint.nextIndex, total: filePaths.length });
    let lastCheckpointAt = Date.now(), assetsSinceCheckpoint=[];
    while (location.scanCheckpoint.nextIndex < filePaths.length && backgroundRunActive(run)) {
      if (!(await waitForIndexCpuBudget(run))) break;
      const waveStart = location.scanCheckpoint.nextIndex, batches = [];
      for (let slot = 0; slot < workerCount; slot += 1) { const start = waveStart + slot * INDEX_BATCH_SIZE; if (start >= filePaths.length) break; batches.push(filePaths.slice(start, start + INDEX_BATCH_SIZE)); }
      const inspectedBatches = await Promise.all(batches.map((batch, index) => inspectScanBatch(batch, location, previous, run, Math.floor(waveStart / INDEX_BATCH_SIZE) + index + 1)));
      if (!backgroundRunActive(run)) break;
      const waveAssets=[]; for (const result of inspectedBatches.flat()) { if (result.error) continue; const existing = previous.get(path.resolve(result.filePath)), asset = await inspectFile(result.filePath, location, existing, { deferHash: location.unstable, inspection: result }); if (!asset) continue; const index=assetIndexes.get(asset.id); if(index!==undefined)jobLibrary.assets[index]=asset; else{assetIndexes.set(asset.id,jobLibrary.assets.length);jobLibrary.assets.push(asset);locationAssetCount+=1;} previous.set(asset.path, asset); assetsSinceCheckpoint.push(asset); waveAssets.push(asset); }
      location.scanCheckpoint.nextIndex = Math.min(filePaths.length, waveStart + batches.reduce((sum, batch) => sum + batch.length, 0)); location.scanProgress.inspected = location.scanCheckpoint.nextIndex; location.assetCount = locationAssetCount; if(notify)broadcastScanAssets(location,waveAssets);
      if (Date.now() - lastCheckpointAt >= 5000) { lastCheckpointAt = Date.now(); const checkpointAssets=assetsSinceCheckpoint.splice(0); persistScanBatch(location,checkpointAssets).catch((error)=>recordDiagnostic('error','Index batch checkpoint failed',error)); }
      reportBackgroundProgress(progressId, { label: `Adding files from ${location.name}`, detail: `${location.scanProgress.inspected.toLocaleString()} of ${filePaths.length.toLocaleString()} · ${workerCount} threads`, completed: location.scanProgress.inspected, total: filePaths.length }); if (notify) scheduleBroadcast(250); await new Promise((resolve) => setImmediate(resolve));
    }
    if (!backgroundRunActive(run)) return;
    const foundPaths = new Set(filePaths.map((filePath) => path.resolve(filePath))), currentAssets = jobLibrary.assets.filter((asset) => asset.locationId === location.id), retained = currentAssets.map((asset) => foundPaths.has(asset.path) ? asset : scanComplete ? ({ ...asset, sourceMissing: true, sourcePending: false, missingSince: asset.missingSince || Date.now() }) : ({ ...asset, sourcePending: true, sourceMissing: false }));
    jobLibrary.assets = jobLibrary.assets.filter((asset) => asset.locationId !== location.id).concat(retained); location.partialScan = !scanComplete; location.assetCount = retained.length; location.lastScanned = Date.now(); location.scanProgress.done = true; location.scanCheckpoint = null; await removeScanQueue(run.portfolioId,location.id);
    reportBackgroundProgress(progressId, { label: `${location.name} scan complete`, detail: `${foundPaths.size.toLocaleString()} files indexed`, completed: filePaths.length, total: filePaths.length, done: true });
    const finalAssets=[...new Map([...assetsSinceCheckpoint,...retained.filter((asset)=>asset.sourceMissing||asset.sourcePending)].map((asset)=>[asset.id,asset])).values()]; const rerun = location.rescanRequested; location.rescanRequested = false; await persistScanBatch(location,finalAssets); if (notify){broadcastScanAssets(location,retained.filter((asset)=>asset.sourceMissing||asset.sourcePending),true);broadcastLocations();} schedulePortfolioBackground(warmThumbnailCache, 0); schedulePortfolioBackground(warmContentHashes, 500); if (rerun) schedulePortfolioBackground(() => scanLocation(location.id), location.unstable ? 1200 : 250);
  } catch (error) { recordDiagnostic('error', `Scan failed for ${location.name}`, error); reportBackgroundProgress(progressId, { label: `Scan failed: ${location.name}`, detail: error.message, done: true, status: 'failed' }); }
  finally { location.scanning = false; location.checking = false; finishBackgroundRun(run); }
}
function resumePendingScans() { for (const location of library.locations.filter((item) => item.scanCheckpoint?.discovered || item.scanCheckpoint?.nextIndex)) schedulePortfolioBackground(() => scanLocation(location.id, { notify: true, resume: true }), 150); }

function watchLocation(location) {
  watchers.get(location.id)?.close();
  if (!location.online) return;
  const watcher = chokidar.watch(location.path, {
    ignoreInitial: true,
    persistent: true,
    depth: 20,
    ignored: /(^|[\\/])\../
  });
  const refresh = () => {
    if ((watcherIgnoreUntil.get(location.id) || 0) > Date.now()) return;
    clearTimeout(watcherRefreshTimers.get(location.id));
    watcherRefreshTimers.set(location.id, setTimeout(() => { watcherRefreshTimers.delete(location.id); scanLocation(location.id); }, location.unstable ? 2200 : 700));
  };
  watcher.on('add', refresh).on('change', refresh).on('unlink', refresh).on('addDir', refresh).on('unlinkDir', refresh);
  watchers.set(location.id, watcher);
}

async function refreshSourcesInBackground({ rescan = false } = {}) {
  const run = beginBackgroundRun('source-refresh'); if (!run) return { online: library.locations.filter((location) => location.online).length, total: library.locations.length, alreadyRunning: true };
  const jobLibrary = run.library, pending = [...jobLibrary.locations];
  for (const location of pending) location.checking = true;
  broadcastLocations();
  const recovered = [], staleAssets = [];
  const workers = Array.from({ length: Math.min(3, pending.length) }, async () => {
    while (pending.length && backgroundRunActive(run)) {
      const location = pending.shift();
      location.online = await pathAvailable(location.path);
      location.checking = false;
      if (location.online) {
        watchLocation(location);
        if (rescan) recovered.push(location.id);
        else staleAssets.push(...jobLibrary.assets.filter((asset) => asset.locationId === location.id && (asset.sourceMissing || asset.sourcePending)));
      }
      scheduleBroadcast();
    }
  });
  await Promise.allSettled(workers);
  let restored = 0;
  const staleWorkers = Array.from({ length: Math.min(4, staleAssets.length) }, async () => { while (staleAssets.length && backgroundRunActive(run)) { const asset = staleAssets.shift(); if (await pathAvailable(asset.path)) { asset.sourceMissing = false; asset.sourcePending = false; asset.missingSince = null; restored += 1; } } });
  await Promise.allSettled(staleWorkers);
  if (!backgroundRunActive(run)) { finishBackgroundRun(run); return { cancelled: true, online: 0, total: pending.length }; }
  scheduleSave(); if (restored) broadcast(); else broadcastLocations(); finishBackgroundRun(run);
  for (const locationId of recovered) { if (run.portfolioId !== activePortfolioId) break; await scanLocation(locationId, { notify: true }); }
  return { online: jobLibrary.locations.filter((location) => location.online).length, total: jobLibrary.locations.length, rescanned: recovered.length, restored };
}

function fingerprintTimeoutForSize(size){return Math.min(10*60*1000,Math.max(15000,15000+Math.round((Math.max(0,Number(size)||0)/(1024*1024*1024))*120000)));}
async function warmContentHashes() {
  const run = beginBackgroundRun('content-hashes'); if (!run) return;
  const jobLibrary = run.library, pending = jobLibrary.assets.filter((asset) => !asset.contentHash && !asset.sourcePending && !asset.sourceMissing && jobLibrary.locations.find((location) => location.id === asset.locationId)?.online === true && !jobLibrary.locations.find((location) => location.id === asset.locationId)?.unstable), total = pending.length, progressId = run.progressId;
  if (!total) { finishBackgroundRun(run); return; } reportBackgroundProgress(progressId, { label: 'Analyzing file fingerprints', detail: `${total.toLocaleString()} files`, total });
  let completed = 0, failed = 0, changedAssets=[];
  try {
    if(scanWorkActive()&&!(await waitForScanIdle(run)))return;
    const workers = Array.from({ length: Math.min(BACKGROUND_HASH_WORKERS, pending.length) }, async () => { while (pending.length && backgroundRunActive(run)) {
      if(scanWorkActive()&&!(await waitForScanIdle(run)))break;
      if(!(await waitForIndexCpuBudget(run)))break;
      const asset = pending.shift(),fingerprintTimeout=fingerprintTimeoutForSize(asset.size),result = await retryBackground(async () => { const hash = await hashFile(asset.path,fingerprintTimeout); if (!hash) throw new Error('Fingerprint unavailable'); return hash; }, run, { attempts: asset.size>SCAN_INLINE_HASH_MAX_BYTES?1:3, timeout:fingerprintTimeout+2000, baseDelay: 100, label: `Fingerprint ${asset.filename}` });
      if (!backgroundRunActive(run)) break; if (typeof result === 'string'){asset.contentHash = result;changedAssets.push(asset);} else failed += 1; completed += 1;
      if (completed % 10 === 0 || completed === total) reportBackgroundProgress(progressId, { label: 'Analyzing file fingerprints', detail: `${completed.toLocaleString()} of ${total.toLocaleString()}${failed ? ` · ${failed} failed` : ''}`, completed, total });
    } }); await Promise.allSettled(workers);
    if (backgroundRunActive(run)) { if(changedAssets.length)await persistAssetBatch(changedAssets); broadcast(); reportBackgroundProgress(progressId, { label: failed ? 'File analysis completed with issues' : 'File analysis complete', detail: failed ? `${failed} files skipped` : `${completed} files analyzed`, completed, total, done: true, status: failed ? 'warning' : 'completed' }); }
  } finally { finishBackgroundRun(run); }
}

let compatibilityWarmRunning = false;
async function warmCompatibilityVideoCache() {
  if (compatibilityWarmRunning || app.isQuitting) return; const run = beginBackgroundRun('video-compatibility'); if (!run) return; compatibilityWarmRunning = true;
  try {
    const nativeVideo = new Set(['h264', 'vp8', 'vp9', 'av1']), nativeAudio = new Set(['aac', 'mp3', 'opus', 'vorbis']), videos = library.assets.filter((asset) => asset.kind === 'video' && !asset.sourcePending && !asset.sourceMissing && library.locations.find((location) => location.id === asset.locationId)?.online === true);
    for (const asset of videos) {
      if (!backgroundRunActive(run)) break; await probeVideoDuration(asset); const compatible = nativeVideo.has(asset.videoCodec) && (!asset.audioCodec || nativeAudio.has(asset.audioCodec));
      if (compatible || (asset.proxyVersion === 3 && asset.proxyPath && await pathAvailable(asset.proxyPath))) continue;
      if (asset.proxyVersion === 2 && asset.proxyPath && await pathAvailable(asset.proxyPath) && !(await fileContainsAtom(asset.proxyPath, 'moof'))) { asset.proxyVersion = 3; scheduleSave(); continue; }
      const prepared = await prepareVideoFiles(asset, true); if (!prepared?.proxyPath) continue; asset.proxyPath = prepared.proxyPath; scheduleSave();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('thumbnail:ready', { id: asset.id, previewUrl: previewUrlFor(asset), mediaUrl: mediaUrlFor(asset) }); await new Promise((resolve) => setImmediate(resolve));
    }
  } finally { compatibilityWarmRunning = false; finishBackgroundRun(run); }
}

function thumbnailWorkRequired(asset) {
  if (asset.thumbnailFailedAt && asset.thumbnailFailedModified === asset.modified && !(asset.extension==='PDF'&&asset.pdfPreviewVersion!==2)) return false;
  if (asset.kind === 'video') return !asset.thumbnailPath || !asset.width || !asset.height || !asset.duration;
  if (asset.kind === 'audio') return !asset.thumbnailPath || !asset.duration;
  if (asset.kind === 'document') return PREVIEWABLE_DOCUMENT_EXTENSIONS.has(asset.extension) && (!asset.thumbnailPath || (asset.extension==='PDF'&&asset.pdfPreviewVersion!==2));
  return asset.kind === 'image' && (!asset.thumbnailPath || !asset.width || !asset.height || !asset.dominantColor || !asset.histogram || !asset.palette || !asset.perceptualHash || !asset.technicalMetadata);
}
async function warmThumbnailCache() {
  const run = beginBackgroundRun('media-previews'); if (!run) return;
  const jobLibrary = run.library, pending = jobLibrary.assets.filter((asset) => !asset.sourcePending && !asset.sourceMissing && thumbnailWorkRequired(asset) && jobLibrary.locations.find((location) => location.id === asset.locationId)?.online === true), total = pending.length, progressId = run.progressId;
  if (!total) { finishBackgroundRun(run); return; } reportBackgroundProgress(progressId, { label: 'Building media previews', detail: `${total.toLocaleString()} files`, total });
  let completedSinceSave = 0, completed = 0, failed = 0, changedPreviewAssets=[];
  try {
  const workers = Array.from({ length: Math.min(THUMBNAIL_WORKER_COUNT, pending.length) }, async () => {
    while (pending.length && backgroundRunActive(run)) {
      if(scanWorkActive()&&!(await waitForScanIdle(run)))break;
      if(!(await waitForIndexCpuBudget(run)))break;
      const asset = pending.shift();
      const thumbnail = await retryBackground(async () => { const value = asset.kind === 'video' ? await prepareVideoFiles(asset) : await createThumbnail(asset); if (!value?.ok) throw new Error(value?.message || 'Preview unavailable'); return value; }, run, { attempts: 3, timeout: asset.extension==='PDF'?35000:11000, baseDelay: 120, label: `Preview ${asset.filename}` });
      if (!backgroundRunActive(run)) break; completed += 1; if (completed % 5 === 0 || completed === total) reportBackgroundProgress(progressId, { label: 'Building media previews', detail: `${completed.toLocaleString()} of ${total.toLocaleString()}`, completed, total });
      if (!thumbnail?.ok) {
        failed += 1; asset.thumbnailFailedAt = Date.now(); asset.thumbnailFailedModified = asset.modified; asset.thumbnailError = thumbnail?.message || 'This format could not be previewed';
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('thumbnail:ready', { id: asset.id, failed: true, error: asset.thumbnailError });
        completedSinceSave += 1; changedPreviewAssets.push(asset); continue;
      }
      asset.thumbnailFailedAt = null; asset.thumbnailFailedModified = null; asset.thumbnailError = null; asset.thumbnailPath = thumbnail.target;if(asset.extension==='PDF')asset.pdfPreviewVersion=2;
      asset.proxyPath = thumbnail.proxyPath || asset.proxyPath || null;
      asset.width = thumbnail.width || asset.width || null;
      asset.height = thumbnail.height || asset.height || null;
      asset.duration = thumbnail.duration || asset.duration || null;
      asset.dominantColor = thumbnail.dominantColor || asset.dominantColor || null;
      asset.histogram = thumbnail.histogram || asset.histogram || null;
      asset.palette = thumbnail.palette || asset.palette || null;
      asset.perceptualHash = thumbnail.perceptualHash || asset.perceptualHash || null;
      asset.exif = thumbnail.exif || asset.exif || null;
      asset.embeddedMetadata = thumbnail.embeddedMetadata || asset.embeddedMetadata || null;
      asset.technicalMetadata = thumbnail.technicalMetadata || asset.technicalMetadata || null;
      if (library.settings?.autoTag && !asset.needsOrganization) asset.tags = [...new Set([...(asset.tags || []), ...libraryCore.suggestTags(asset)])];
      completedSinceSave += 1; changedPreviewAssets.push(asset);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('thumbnail:ready', {
          id: asset.id,
          previewUrl: previewUrlFor(asset),
          mediaUrl: mediaUrlFor(asset),
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
          dominantColor: asset.dominantColor,
          histogram: asset.histogram,
          palette: asset.palette,
          perceptualHash: asset.perceptualHash,
          exif: asset.exif,
          embeddedMetadata: asset.embeddedMetadata,
          technicalMetadata: asset.technicalMetadata
        });
      }
      if (completedSinceSave >= 100) {
        completedSinceSave = 0; await persistAssetBatch(changedPreviewAssets.splice(0));
      }
    }
  });
  await Promise.allSettled(workers);
  if (backgroundRunActive(run)) { if (changedPreviewAssets.length) await persistAssetBatch(changedPreviewAssets.splice(0)); reportBackgroundProgress(progressId, { label: failed ? 'Media previews completed with issues' : 'Media previews ready', detail: failed ? `${failed} previews unavailable` : `${completed} previews built`, completed, total, done: true, status: failed ? 'warning' : 'completed' }); if (!smokeTest) schedulePortfolioBackground(warmCompatibilityVideoCache, 0); }
  } finally { finishBackgroundRun(run); }
}

async function addLocations(paths, type) {
  for (const selectedPath of paths) {
    const resolved = path.resolve(selectedPath);
    let location = library.locations.find((item) => item.path.toLowerCase() === resolved.toLowerCase());
    if (!location) {
      location = {
        id: makeId(`location:${resolved.toLowerCase()}`),
        name: type === 'folder' ? path.basename(resolved) || resolved : path.basename(resolved),
        path: resolved,
        type,
        removable: await isRemovable(resolved),
        online: true,
        scanning: false,
        assetCount: 0,
        addedAt: Date.now(),
        lastScanned: null
      };
      library.locations.push(location);
    }
    broadcastLocations(); await scanLocation(location.id, { notify: true });
    watchLocation(location);
  }
  scheduleSave();
  broadcast();
  return publicLibrarySummary();
}

async function uniqueManagedImportPath(directory, filename) {
  const parsed = path.parse(String(filename || 'dropped-file'));
  const safeBase = (parsed.name || 'dropped-file').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 160);
  const safeExtension = parsed.ext.replace(/[^.a-z0-9_-]/gi, '').slice(0, 16);
  let sequence = 0;
  while (true) {
    const suffix = sequence ? ` (${sequence + 1})` : '';
    const candidate = path.join(directory, `${safeBase}${suffix}${safeExtension}`);
    try { await fsp.access(candidate); sequence += 1; }
    catch { return candidate; }
  }
}

async function importDroppedFiles(sourcePaths, target = {}) {
  const requestedLocation = target.locationId && library.locations.find((item) => item.id === target.locationId && item.type === 'folder' && item.online);
  const subfolder = normalizedSubfolder(target.subfolder || '');
  const inboxPath = path.join(importsDir, activePortfolioId, 'Needs Organization');
  let destination = inboxPath, location = requestedLocation, isNewLocation = false;
  if (requestedLocation) {
    destination = path.resolve(requestedLocation.path, subfolder);
    const relative = path.relative(requestedLocation.path, destination);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('The destination must be inside the indexed folder');
  } else {
    location = library.locations.find((item) => item.managedInbox || item.path.toLowerCase() === inboxPath.toLowerCase());
    isNewLocation = !location;
    if (!location) {
      location = { id: makeId(`managed-inbox:${activePortfolioId}`), name: 'Needs Organization', path: inboxPath, type: 'folder', managedInbox: true, removable: false, online: true, scanning: false, assetCount: 0, addedAt: Date.now(), lastScanned: null };
      library.locations.push(location);
    } else location.managedInbox = true;
  }
  await fsp.mkdir(destination, { recursive: true });
  const copiedPaths = [];
  for (const sourcePath of [...new Set((sourcePaths || []).map((item) => path.resolve(String(item))))]) {
    try {
      if (!(await fsp.stat(sourcePath)).isFile()) continue;
      const output = await uniqueManagedImportPath(destination, path.basename(sourcePath));
      await fsp.copyFile(sourcePath, output, fs.constants.COPYFILE_EXCL);
      copiedPaths.push(path.resolve(output));
    } catch (error) { console.error(`Could not import dropped file ${sourcePath}:`, error.message); }
  }
  if (isNewLocation) await scanLocation(location.id, { notify: false });
  else {
    for (const copiedPath of copiedPaths) {
      const asset = await inspectFile(copiedPath, location, null);
      if (asset) library.assets.push(asset);
    }
    location.assetCount = library.assets.filter((asset) => asset.locationId === location.id).length;
    location.lastScanned = Date.now();
  }
  const copiedPathKeys = new Set(copiedPaths.map((filePath) => path.resolve(filePath).toLowerCase()));
  const importedAssets = library.assets.filter((asset) => copiedPathKeys.has(path.resolve(asset.path).toLowerCase()));
  for (const asset of importedAssets) {
    asset.needsOrganization = !requestedLocation && !target.collectionId;
    if (asset.needsOrganization) { asset.tags = []; asset.collectionIds = []; }
    if (target.collectionId && library.collections.some((collection) => collection.id === target.collectionId)) { asset.collectionIds = [...new Set([...(asset.collectionIds || []), target.collectionId])]; applyConfiguredCollectionTags(asset); }
  }
  watchLocation(location); scheduleSave(); broadcast(); schedulePortfolioBackground(warmThumbnailCache, 0);
  return { imported: copiedPaths.length, ids: importedAssets.map((asset) => asset.id), locationId: location.id, path: destination };
}

async function registerProtocol() {
  protocol.handle('pigeon-asset', async (request) => {
    const id = new URL(request.url).pathname.split('/').filter(Boolean).pop();
    const asset = library.assets.find((item) => item.id === id);
    if (!asset) return new Response('', { status: 404 });
    const location = library.locations.find((item) => item.id === asset.locationId);
    const requestUrl = new URL(request.url);
    const wantsOriginal = requestUrl.searchParams.get('original') === '1';
    const wantsProxy = requestUrl.searchParams.get('proxy') === '1';

    const wantsEdited = requestUrl.searchParams.get('edited') === '1';
    const requestedCollection = requestUrl.searchParams.get('collection');
    const encryptedPaths = wantsOriginal ? asset.encryptedMediaPaths : asset.encryptedThumbnailPaths;
    const encryptedCollection = requestedCollection || Object.keys(encryptedPaths || {}).find((id) => unlockedCollections.has(id));
    if (!wantsEdited && encryptedCollection && encryptedPaths?.[encryptedCollection] && unlockedCollections.has(encryptedCollection)) {
      try {
        const body = await decryptFileCopy(encryptedPaths[encryptedCollection], unlockedCollections.get(encryptedCollection));
        const extension = wantsOriginal ? asset.extension : '.jpg';
        const mime = ({ '.png':'image/png', '.webp':'image/webp', '.gif':'image/gif', '.jpg':'image/jpeg', '.jpeg':'image/jpeg' })[extension] || 'application/octet-stream';
        return new Response(body, { status: 200, headers: { 'Content-Type': mime, 'Content-Length': String(body.length), 'Accept-Ranges': 'none', 'Cache-Control': 'no-store' } });
      } catch { return new Response('', { status: 403 }); }
    }
    if (isAssetLocked(asset)) return new Response('', { status: 403 });
    const candidates = wantsOriginal ? [wantsEdited && asset.editedPath ? asset.editedPath : wantsProxy && asset.proxyPath ? asset.proxyPath : asset.path] : wantsEdited && asset.editedPath ? [asset.editedPath] : asset.thumbnailPath ? [asset.thumbnailPath] : asset.kind !== 'image' ? [asset.path] : [];
    for (const candidate of candidates) {
      try {
        const stat = await fsp.stat(candidate);
        const extension = path.extname(candidate).toLowerCase();
        const mime = ({ '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.gif':'image/gif', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.mp4':'video/mp4', '.m4v':'video/mp4', '.mov':'video/quicktime', '.webm':'video/webm', '.ogv':'video/ogg', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.m4a':'audio/mp4', '.aac':'audio/aac', '.flac':'audio/flac', '.ogg':'audio/ogg', '.oga':'audio/ogg', '.opus':'audio/ogg' })[extension] || 'application/octet-stream';
        const range = request.headers.get('range')?.match(/bytes=(\d+)-(\d*)/);
        if (range && wantsOriginal) {
          const start = Number(range[1]);
          const end = Math.min(range[2] ? Number(range[2]) : start + 1024 * 1024 - 1, stat.size - 1);
          if (start >= stat.size || end < start) return new Response('', { status: 416, headers: { 'content-range': `bytes */${stat.size}` } });
          const handle = await fsp.open(candidate, 'r');
          const bytes = Buffer.alloc(end - start + 1);
          await handle.read(bytes, 0, bytes.length, start);
          await handle.close();
          return new Response(bytes, { status: 206, headers: { 'content-type': mime, 'content-length': String(bytes.length), 'content-range': `bytes ${start}-${end}/${stat.size}`, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' } });
        }
        const bytes = await fsp.readFile(candidate);
        return new Response(bytes, { headers: { 'content-type': mime, 'content-length': String(bytes.length), 'accept-ranges': 'bytes', 'cache-control': 'no-cache' } });
      } catch {
        // Try the cached preview before returning a missing image.
      }
    }
    return new Response('', { status: 404 });
  });
  protocol.handle('pigeon-map', async (request) => {
    try {
      const url = new URL(request.url);
      const [zText, xText, file] = url.pathname.split('/').filter(Boolean);
      const z = Number(zText), x = Number(xText), y = Number(String(file || '').replace(/\.png$/i, ''));
      if (url.hostname !== 'tile' || !Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 18 || x < 0 || y < 0) return new Response('', { status: 400 });
      const target = path.join(mapTileDir, String(z), String(x), `${y}.png`);
      let bytes;
      try { bytes = await fsp.readFile(target); }
      catch {
        const remote = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, { headers: { 'User-Agent': 'Pigeon/0.1.1 local visual portfolio' } });
        if (!remote.ok) return new Response('', { status: remote.status });
        bytes = Buffer.from(await remote.arrayBuffer()); await fsp.mkdir(path.dirname(target), { recursive: true }); await fsp.writeFile(target, bytes);
      }
      return new Response(bytes, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800' } });
    } catch { return new Response('', { status: 404 }); }
  });
}

async function importUrl(urlValue) {
  const url = new URL(urlValue);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported');
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 250 * 1024 * 1024) throw new Error('Download exceeds the 250 MB safety limit');
  await fsp.mkdir(importsDir, { recursive: true });
  const headerType = response.headers.get('content-type') || '';
  const extensionByType = headerType.includes('png') ? '.png' : headerType.includes('jpeg') ? '.jpg' : headerType.includes('webp') ? '.webp' : headerType.includes('gif') ? '.gif' : headerType.includes('mp4') ? '.mp4' : '';
  const urlName = path.basename(decodeURIComponent(url.pathname)) || `download-${Date.now()}${extensionByType}`;
  const safeName = urlName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 180);
  const target = path.join(importsDir, `${Date.now()}-${safeName}${path.extname(safeName) ? '' : extensionByType}`);
  await fsp.writeFile(target, bytes);
  await addLocations([target], 'file');
  const asset = library.assets.find((item) => item.path === path.resolve(target));
  if (asset) asset.sourceUrl = url.toString();
  scheduleSave(); broadcast();
  return asset;
}

async function captureScreenshot() {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 2560, height: 1440 }, fetchWindowIcons: false });
  if (!sources.length) throw new Error('No screen source is available');
  await fsp.mkdir(importsDir, { recursive: true });
  const preferences = library.settings?.preferences || {}, format = ['JPG', 'WebP'].includes(preferences.screenshotFormat) ? preferences.screenshotFormat : 'PNG', extension = format === 'JPG' ? 'jpg' : format.toLowerCase();
  const target = path.join(importsDir, `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`);
  const png = sources[0].thumbnail.toPNG(), bytes = format === 'JPG' ? sources[0].thumbnail.toJPEG(90) : format === 'WebP' ? await sharp(png).webp({ quality: 90 }).toBuffer() : png;
  await fsp.writeFile(target, bytes); if (preferences.screenshotClipboard) clipboard.writeImage(sources[0].thumbnail);
  await addLocations([target], 'file');
  const asset = library.assets.find((item) => item.path === path.resolve(target)); if (asset && preferences.screenshotTag) asset.tags = [...new Set([...(asset.tags || []), 'Screenshot'])]; scheduleSave(); return asset;
}

async function duplicateAsset(id) {
  const source = library.assets.find((item) => item.id === id);
  const location = source && library.locations.find((item) => item.id === source.locationId);
  if (!source || !(await pathAvailable(source.path))) throw new Error('An online asset is required');
  const parsed = path.parse(source.path);
  let number = 1, target;
  do { target = path.join(parsed.dir, `${parsed.name} copy${number === 1 ? '' : ` ${number}`}${parsed.ext}`); number += 1; } while (await pathAvailable(target));
  await fsp.copyFile(source.path, target);
  if (location?.type === 'folder') {
    const duplicate = await inspectFile(target, location, null);
    if (!duplicate) throw new Error('The duplicate could not be indexed');
    duplicate.collectionIds = [...(source.collectionIds || [])]; duplicate.tags = [...(source.tags || [])]; duplicate.rating = source.rating || 0; duplicate.rotation = source.rotation || 0; applyConfiguredCollectionTags(duplicate);
    library.assets.push(duplicate); location.assetCount = (location.assetCount || 0) + 1;
    scheduleSave(); broadcast(); schedulePortfolioBackground(warmThumbnailCache, 0); return duplicate;
  }
  await addLocations([target], 'file');
  return library.assets.find((item) => item.path === path.resolve(target));
}

async function applyInlineCrop(id, crop = {}) {
  const asset = library.assets.find((item) => item.id === id);
  if (!asset || asset.kind !== 'image') throw new Error('Select an image to crop');
  const source = asset.editedPath && await pathAvailable(asset.editedPath) ? asset.editedPath : asset.path;
  if (!(await pathAvailable(source))) throw new Error('The source image is offline');
  const metadata = await sharp(source).metadata();
  const rotation = ((Number(asset.rotation) || 0) % 360 + 360) % 360;
  let sourceWidth = metadata.width || asset.width, sourceHeight = metadata.height || asset.height;
  if (rotation % 180) [sourceWidth, sourceHeight] = [sourceHeight, sourceWidth];
  const normalized = {
    x: Math.max(0, Math.min(.95, Number(crop.x) || 0)),
    y: Math.max(0, Math.min(.95, Number(crop.y) || 0)),
    width: Math.max(.05, Math.min(1, Number(crop.width) || 1)),
    height: Math.max(.05, Math.min(1, Number(crop.height) || 1))
  };
  normalized.width = Math.min(normalized.width, 1 - normalized.x); normalized.height = Math.min(normalized.height, 1 - normalized.y);
  const left = Math.min(sourceWidth - 1, Math.round(normalized.x * sourceWidth));
  const top = Math.min(sourceHeight - 1, Math.round(normalized.y * sourceHeight));
  const width = Math.max(1, Math.min(sourceWidth - left, Math.round(normalized.width * sourceWidth)));
  const height = Math.max(1, Math.min(sourceHeight - top, Math.round(normalized.height * sourceHeight)));
  const editDir = path.join(thumbnailDir, 'edits'); await fsp.mkdir(editDir, { recursive: true });
  const target = path.join(editDir, `${asset.id}-${Date.now()}.png`);
  let pipeline = sharp(source);
  if ([90, 180, 270].includes(rotation)) pipeline = pipeline.rotate(rotation);
  await pipeline.extract({ left, top, width, height }).png().toFile(target);
  if (asset.editedPath && asset.editedPath !== target) await fsp.rm(asset.editedPath, { force: true });
  asset.editedPath = target; asset.editedAt = Date.now(); asset.inlineCrop = normalized; asset.width = width; asset.height = height; asset.rotation = 0;
  scheduleSave(); broadcast();
  return { ...asset, previewUrl: previewUrlFor(asset), mediaUrl: mediaUrlFor(asset) };
}
async function resetInlineEdits(id) {
  const asset = library.assets.find((item) => item.id === id);
  if (!asset) throw new Error('Asset not found');
  if (asset.editedPath) await fsp.rm(asset.editedPath, { force: true });
  asset.editedPath = null; asset.editedAt = null; asset.inlineCrop = null; asset.rotation = 0;
  if (asset.kind === 'image' && await pathAvailable(asset.path)) { const metadata = await sharp(asset.path).metadata(); asset.width = metadata.width || asset.width; asset.height = metadata.height || asset.height; }
  scheduleSave(); broadcast(); return { ...asset, previewUrl: previewUrlFor(asset), mediaUrl: mediaUrlFor(asset) };
}

async function exportAnnotatedAsset(id, annotations = [], edits = {}) {
  const asset = library.assets.find((item) => item.id === id);
  if (!asset || asset.kind !== 'image' || !(await pathAvailable(asset.path))) throw new Error('An online image is required');
  const result = await dialog.showSaveDialog(mainWindow, { title: 'Export edited derivative', defaultPath: `${asset.name}-edited.png`, filters: [{ name: 'PNG image', extensions: ['png'] }] });
  if (result.canceled || !result.filePath) return null;
  const metadata = await sharp(asset.path).metadata();
  const width = metadata.width || asset.width || 1000, height = metadata.height || asset.height || 1000;
  const shapes = annotations.map((item) => {
    const color = /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : '#ff3b30';
    if (item.type === 'rect') return `<rect x="${Number(item.x) || 0}" y="${Number(item.y) || 0}" width="${Number(item.width) || 0}" height="${Number(item.height) || 0}" fill="none" stroke="${color}" stroke-width="${Number(item.stroke) || 4}"/>`;
    if (item.type === 'text') return `<text x="${Number(item.x) || 0}" y="${Number(item.y) || 0}" fill="${color}" font-size="${Number(item.size) || 28}">${String(item.text || '').replace(/[<>&]/g, '')}</text>`;
    return '';
  }).join('');
  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${shapes}</svg>`);
  let pipeline = sharp(asset.path).composite([{ input: overlay }]);
  if (edits.crop) {
    const left = Math.max(0, Math.min(width - 1, Math.round(Number(edits.crop.x) || 0)));
    const top = Math.max(0, Math.min(height - 1, Math.round(Number(edits.crop.y) || 0)));
    const cropWidth = Math.max(1, Math.min(width - left, Math.round(Number(edits.crop.width) || width)));
    const cropHeight = Math.max(1, Math.min(height - top, Math.round(Number(edits.crop.height) || height)));
    pipeline = pipeline.extract({ left, top, width: cropWidth, height: cropHeight });
  }
  if ([90, 180, 270].includes(Number(edits.rotate))) pipeline = pipeline.rotate(Number(edits.rotate));
  if (edits.flip) pipeline = pipeline.flop();
  const brightness = Math.max(.5, Math.min(1.5, Number(edits.brightness) || 1));
  if (brightness !== 1) pipeline = pipeline.modulate({ brightness });
  await pipeline.png().toFile(result.filePath);
  asset.annotations = annotations;
  scheduleSave();
  return result.filePath;
}

function safeExportName(value, fallback = 'Export') { const cleaned = String(value || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim(); return cleaned || fallback; }
async function copyExportAsset(asset, target) { if (asset.sourceMissing || !(await pathAvailable(asset.path))) return false; await fsp.mkdir(path.dirname(target), { recursive: true }); await fsp.copyFile(asset.path, target); return true; }
async function exportLibraryGroup(type, id) {
  let name, assets, paths = new Map();
  if (type === 'collection') {
    const root = library.collections.find((item) => item.id === id); if (!root) throw new Error('Collection does not exist'); name = root.name; const ids = collectionDescendants(id), byId = new Map(library.collections.map((item) => [item.id, item])); assets = library.assets.filter((asset) => !asset.deletedAt && !isAssetLocked(asset) && (asset.collectionIds || []).some((collectionId) => ids.has(collectionId)));
    for (const asset of assets) { const assigned = (asset.collectionIds || []).filter((collectionId) => ids.has(collectionId)); let collection = byId.get(assigned[0]), parts = []; while (collection && collection.id !== root.id) { parts.unshift(safeExportName(collection.name)); collection = byId.get(collection.parentId); } paths.set(asset.id, parts); }
  } else if (type === 'smart-folder') {
    const root = library.smartFolders.find((item) => item.id === id); if (!root) throw new Error('Smart folder does not exist'); name = root.name; assets = library.assets.filter((asset) => !asset.deletedAt && !isAssetLocked(asset) && libraryCore.matchesFilters(asset, root.filters));
    for (const asset of assets) { const location = library.locations.find((item) => item.id === asset.locationId), relative = location?.type === 'folder' ? path.relative(location.path, path.dirname(asset.path)) : ''; paths.set(asset.id, relative && !relative.startsWith('..') ? relative.split(path.sep).map((part) => safeExportName(part)) : []); }
  } else throw new Error('Unsupported export type');
  const result = await dialog.showOpenDialog(mainWindow, { title: `Export ${name}`, properties: ['openDirectory', 'createDirectory'] }); if (result.canceled || !result.filePaths[0]) return null; const rootTarget = path.join(result.filePaths[0], safeExportName(name)); let copied = 0, skipped = 0;
  for (const asset of assets) { let target = path.join(rootTarget, ...(paths.get(asset.id) || []), safeExportName(asset.filename, `${asset.id}.${String(asset.extension || 'file').toLowerCase()}`)); if (await pathAvailable(target)) target = path.join(path.dirname(target), `${path.basename(target, path.extname(target))}-${asset.id.slice(0,6)}${path.extname(target)}`); if (await copyExportAsset(asset, target)) copied += 1; else skipped += 1; }
  return { path: rootTarget, files: copied, skipped };
}

async function runPlugin(pluginName) {
  const safeName = path.basename(pluginName);
  const file = path.join(pluginsDir, safeName);
  if (!file.endsWith('.js')) throw new Error('Plugins must be JavaScript files');
  return new Promise((resolve) => {
    const worker = new Worker(path.join(__dirname, 'plugin-worker.js'), { workerData: { file, assets: library.assets.filter((asset) => !asset.deletedAt) } }); trackWorker(worker, 'plugin');
    const timer = setTimeout(() => { worker.terminate(); resolve({ error: 'Plugin timed out' }); }, 2000);
    worker.on('message', (message) => {
      if (!message.done) return;
      clearTimeout(timer);
      for (const operation of message.operations || []) if (operation.type === 'tag' && Array.isArray(operation.ids)) libraryCore.batchUpdateAssets(library, operation.ids, { addTags: [String(operation.tag || '').slice(0, 64)] });
      if (message.operations?.length) { scheduleSave(); broadcast(); }
      resolve(message);
      worker.terminate();
    });
    worker.on('error', (error) => { clearTimeout(timer); resolve({ error: error.message }); });
  });
}

function savedWindowOptions(){let saved=null;try{saved=JSON.parse(fs.readFileSync(windowStateFile,'utf8'));}catch{}const displays=screen.getAllDisplays(),intersects=(bounds,area)=>bounds&&bounds.x<area.x+area.width&&bounds.x+bounds.width>area.x&&bounds.y<area.y+area.height&&bounds.y+bounds.height>area.y;if(saved&&displays.some((display)=>intersects(saved,display.workArea)))return{x:saved.x,y:saved.y,width:Math.max(920,saved.width||1440),height:Math.max(620,saved.height||900)};const area=screen.getPrimaryDisplay().workArea,width=Math.min(1440,area.width),height=Math.min(900,area.height);return{x:area.x+Math.round((area.width-width)/2),y:area.y+Math.round((area.height-height)/2),width,height};}
function centerWindowOnDisplay(index=0){if(!mainWindow)return false;const primary=screen.getPrimaryDisplay(),displays=[primary,...screen.getAllDisplays().filter((display)=>display.id!==primary.id)],display=displays[index]||primary,area=display.workArea,bounds=mainWindow.getBounds(),width=Math.min(bounds.width,area.width),height=Math.min(bounds.height,area.height);mainWindow.unmaximize();mainWindow.setBounds({x:area.x+Math.round((area.width-width)/2),y:area.y+Math.round((area.height-height)/2),width,height});return Boolean(displays[index]);}
function createWindow() {
  mainWindow = new BrowserWindow({
    ...savedWindowOptions(),
    minWidth: 920,
    minHeight: 620,
    title: 'Pigeon',
    icon: path.join(__dirname, '..', 'pigeon-logo.png'),
    backgroundColor: '#171922',
    frame: process.platform === 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  let windowStateTimer;const persistWindowState=()=>{clearTimeout(windowStateTimer);windowStateTimer=setTimeout(()=>{if(mainWindow&&!mainWindow.isDestroyed()&&!mainWindow.isMaximized())fsp.writeFile(windowStateFile,JSON.stringify(mainWindow.getBounds())).catch(()=>{});},180);};mainWindow.on('move',persistWindowState);mainWindow.on('resize',persistWindowState);mainWindow.on('close',()=>{if(mainWindow&&!mainWindow.isDestroyed()&&!mainWindow.isMaximized())fs.writeFileSync(windowStateFile,JSON.stringify(mainWindow.getBounds()));});
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false));
  mainWindow.webContents.on('render-process-gone', (_event, details) => { writeFatalDiagnostic('electron:render-process-gone',details.reason,details); recordDiagnostic('error', 'Renderer process stopped', details); if(!app.isQuitting&&details.reason!=='clean-exit')setTimeout(()=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.reload();else createWindow();},500); });
  mainWindow.webContents.on('preload-error',(_event,preloadPath,error)=>{writeFatalDiagnostic('electron:preload-error',error,preloadPath);recordDiagnostic('error','Preload script failed',{preloadPath,error:diagnosticValue(error)});});
  mainWindow.webContents.on('did-fail-load',(_event,code,description,url,isMainFrame)=>{if(isMainFrame){writeFatalDiagnostic('electron:did-fail-load',description,{code,url});recordDiagnostic('error','Renderer failed to load',{code,description,url});}});
  mainWindow.on('unresponsive',()=>{writeFatalDiagnostic('electron:window-unresponsive','Main window stopped responding');recordDiagnostic('error','Application window is unresponsive');});
  mainWindow.webContents.on('console-message', (_event, details) => { if (details.level === 'warning' || details.level === 'error') recordDiagnostic(details.level, details.message, `${details.sourceId}:${details.lineNumber}`); });
  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  if (smokeTest) {
    mainWindow.webContents.once('did-finish-load', async () => {
      console.log('[smoke] renderer loaded');
      const smokeDelay = Math.min(2500, Number(process.env.PIGEON_SMOKE_DELAY) || 200);
      await new Promise((resolve) => setTimeout(resolve, smokeDelay));
      console.log('[smoke] capturing window');
      if(process.env.PIGEON_SMOKE_CAPTURE_TREE==='1'){mainWindow.setSize(340,920);await mainWindow.webContents.executeJavaScript(`(()=>{document.documentElement.style.setProperty('--sidebar-width','310px');document.querySelector('.app-shell')?.classList.add('tree-capture');document.querySelectorAll('[data-collapse-key]').forEach((toggle)=>{if(toggle.getAttribute('aria-expanded')==='false')toggle.click();});document.querySelector('#sidebar-tree-scroll').scrollTop=0;})()`);await new Promise((resolve)=>setTimeout(resolve,700));const image=await mainWindow.webContents.capturePage({x:0,y:0,width:310,height:900});await fsp.writeFile(path.join(process.cwd(),'pigeon-tree-smoke.png'),image.toPNG());console.log('[smoke] tree capture complete');app.exit(0);return;}
      if (smokeSeeded) {
        const droppedSource = path.join(app.getPath('userData'), 'smoke-drop-source.svg');
        await fsp.writeFile(droppedSource, '<svg xmlns="http://www.w3.org/2000/svg" width="137" height="91"><rect width="137" height="91" fill="#7138a8"/><circle cx="37" cy="43" r="19" fill="#ffcf48"/></svg>');
        const droppedSourceHash = await hashFile(droppedSource), droppedResult = await importDroppedFiles([droppedSource]), droppedAsset = library.assets.find((asset) => asset.path.startsWith(droppedResult.path) && asset.filename.startsWith('smoke-drop-source'));
        const droppedCopyExists = droppedAsset ? await fsp.stat(droppedAsset.path).then((stat) => stat.isFile()).catch(() => false) : false;
        const smokeUnstableLocation = library.locations.find((location) => location.name === 'smoke-fixtures'); if (smokeUnstableLocation) smokeUnstableLocation.unstable = true;
        const smokeMissingAsset = library.assets.find((asset) => asset.filename === 'nested-reference.svg'); if (smokeMissingAsset) { if (!smokeMissingAsset.thumbnailPath) { const thumbnail = await createThumbnail(smokeMissingAsset); smokeMissingAsset.thumbnailPath = thumbnail?.target || smokeMissingAsset.thumbnailPath; } await fsp.rm(smokeMissingAsset.path, { force: true }); }
        if (smokeUnstableLocation) await fsp.writeFile(path.join(smokeUnstableLocation.path, 'smoke-rescan-new.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="60"><rect width="90" height="60" fill="#4f7bd9"/></svg>');
        const managedDropStorage = Boolean(droppedResult.imported === 1 && droppedAsset && droppedAsset.tags.length === 0 && droppedAsset.collectionIds.length === 0 && droppedSourceHash === await hashFile(droppedSource) && droppedCopyExists);
        const uiDroppedSource = path.join(app.getPath('userData'), 'smoke-ui-drop-source.svg');
        await fsp.writeFile(uiDroppedSource, '<svg xmlns="http://www.w3.org/2000/svg" width="83" height="67"><rect width="83" height="67" fill="#2e9d78"/></svg>');
        let externalFileDrop = false;
        try {
          mainWindow.webContents.debugger.attach('1.3');
          const dropPoint = await mainWindow.webContents.executeJavaScript(`(() => { const rect = document.querySelector('#grid-wrap').getBoundingClientRect(); return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }; })()`);
          const dragData = { items: [], files: [uiDroppedSource], dragOperationsMask: 1 };
          await mainWindow.webContents.debugger.sendCommand('Input.dispatchDragEvent', { type: 'dragEnter', ...dropPoint, data: dragData });
          await mainWindow.webContents.debugger.sendCommand('Input.dispatchDragEvent', { type: 'dragOver', ...dropPoint, data: dragData });
          await mainWindow.webContents.debugger.sendCommand('Input.dispatchDragEvent', { type: 'drop', ...dropPoint, data: dragData });
          await new Promise((resolve) => setTimeout(resolve, 350));
          externalFileDrop = library.assets.some((asset) => asset.filename.startsWith('smoke-ui-drop-source') && asset.needsOrganization);
        } catch (error) { console.error('[smoke] external drop failed', error.message); }
        finally { if (mainWindow.webContents.debugger.isAttached()) mainWindow.webContents.debugger.detach(); }
        await new Promise((resolve) => setTimeout(resolve, 80));
        const verification = await mainWindow.webContents.executeJavaScript(`(async () => {
          const startupSplashHidden = document.querySelector('#startup-splash')?.classList.contains('hidden');
          const managedDropStorage = ${managedDropStorage}, externalFileDrop = ${externalFileDrop};
          const droppedInboxAsset = state.library.assets.find((asset) => asset.needsOrganization);
          const savedView = state.view, savedKind = state.kind; state.view = 'uncategorized'; state.kind = 'visual'; state.locationId = null; state.collectionId = null; state.smartFolderId = null;
          const dropStartsUncategorized = Boolean(droppedInboxAsset && filteredAssets().some((asset) => asset.id === droppedInboxAsset.id));
          if (droppedInboxAsset) droppedInboxAsset.tags = ['Organized']; const tagCompletesOrganization = Boolean(droppedInboxAsset && !filteredAssets().some((asset) => asset.id === droppedInboxAsset.id));
          if (droppedInboxAsset) { droppedInboxAsset.tags = []; droppedInboxAsset.collectionIds = ['organized-folder']; } const folderCompletesOrganization = Boolean(droppedInboxAsset && !filteredAssets().some((asset) => asset.id === droppedInboxAsset.id));
          if (droppedInboxAsset) droppedInboxAsset.collectionIds = []; state.view = savedView; state.kind = savedKind;
          const managedDropWorkflow = Boolean(managedDropStorage && dropStartsUncategorized && tagCompletesOrganization && folderCompletesOrganization);
          for (const key of Object.keys(localStorage)) if (key.startsWith('pigeon.navigation.')) localStorage.removeItem(key);
          for (const name of ['smart-folders', 'collections', 'indexed-locations']) setSidebarSectionExpanded(name, true);
          document.querySelector('[data-section-toggle="smart-folders"]')?.click();
          const sidebarSectionsCollapse = document.querySelector('#sidebar-section-smart-folders')?.classList.contains('collapsed') && JSON.parse(localStorage.getItem('pigeon.collapsedSidebarSections') || '[]').includes('smart-folders');
          document.querySelector('[data-section-toggle="smart-folders"]')?.click();
          document.querySelector('#add-collection')?.click(); const collectionDialog = document.querySelector('#text-entry-dialog').open && document.querySelector('#text-entry-title').textContent.includes('Collection'); document.querySelector('#text-entry-input').value = 'UI modal collection'; document.querySelector('#confirm-text-entry')?.click(); await new Promise((resolve) => setTimeout(resolve, 60));
          document.querySelector('#save-smart-folder')?.click(); const smartFolderDialog = document.querySelector('#smart-folder-dialog').open && document.querySelectorAll('.smart-rule').length === 1, smartTagInput = document.querySelector('[data-smart-tag-input]'); renderTagAutocomplete(smartTagInput); const smartTagAutocomplete = smartTagInput?.dataset.tagAutocomplete === 'true' && !document.querySelector('#tag-autocomplete').classList.contains('hidden'); document.querySelector('#smart-folder-name').value = 'UI modal smart folder'; document.querySelector('[data-rule-part="value"]').value = 'nested'; document.querySelector('[data-rule-part="value"]').dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#create-smart-folder')?.click(); await new Promise((resolve) => setTimeout(resolve, 60));
          document.querySelector('.brand-menu')?.click(); const portfolioRowTrigger = !document.querySelector('#portfolio-switcher').classList.contains('hidden') && !document.querySelector('button.brand-menu'); document.querySelector('#quick-create-portfolio')?.click(); const portfolioDialog = document.querySelector('#text-entry-dialog').open && document.querySelector('#text-entry-title').textContent.includes('Portfolio'); document.querySelector('#cancel-text-entry')?.click(); closePortfolioSwitcher();
          const creationDialogs = collectionDialog && smartFolderDialog && portfolioDialog && state.library.collections.some((item) => item.name === 'UI modal collection') && state.library.smartFolders.some((item) => item.name === 'UI modal smart folder');
          const iconCollection = state.library.collections.find((item) => item.name === 'UI modal collection'), iconCollectionButton = document.querySelector('[data-collection-id="' + iconCollection?.id + '"]'); iconCollectionButton?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 180, clientY: 300 })); if (!document.querySelector('[data-folder-action="change-icon"]')) showCollectionContextMenu({ clientX: 180, clientY: 300 }, iconCollection);
          const changeIconContextAction = [...document.querySelectorAll('[data-folder-action]')].find((button) => button.textContent.includes('Change Icon')), folderContextMenuPositioned = elements.contextMenu.style.left === '180px' && elements.contextMenu.style.top === '300px', contextMenuLeftAligned = getComputedStyle(changeIconContextAction).justifyContent === 'flex-start' && getComputedStyle(changeIconContextAction).textAlign === 'left'; changeIconContextAction?.click(); if (!document.querySelector('#icon-picker-dialog').open) openIconPicker({ type: 'collection', id: iconCollection.id, current: iconCollection.icon, fallback: 'collection' }); const iconPickerOpened = document.querySelector('#icon-picker-dialog').open && document.querySelectorAll('#icon-picker-grid svg').length >= 30; await chooseItemIcon('camera'); await new Promise((resolve) => setTimeout(resolve, 100));
          const iconStateSaved = state.library.collections.find((item) => item.id === iconCollection.id)?.icon === 'camera', iconRendered = Boolean(document.querySelector('[data-collection-id="' + iconCollection.id + '"] svg'));
          const customItemIcons = Boolean(changeIconContextAction && folderContextMenuPositioned && iconPickerOpened && iconStateSaved && iconRendered);
          document.querySelector('[data-view="all"]')?.click(); document.querySelector('#clear-filters')?.click();
          let physicalFolderNodes = [...document.querySelectorAll('.location-folder-item')]; const nestedFolderNode = physicalFolderNodes.find((button) => decodeURIComponent(button.dataset.subfolder) === 'nested');
          nestedFolderNode?.click(); const subfolderToggle = document.querySelector('#subfolder-content-toggle'), directFolderContentOnly = subfolderToggle?.getAttribute('aria-pressed') === 'false' && document.querySelectorAll('.asset-card').length === 0; subfolderToggle?.click(); const descendantFolderContentVisible = subfolderToggle?.getAttribute('aria-pressed') === 'true' && document.querySelectorAll('.asset-card').length === 1 && localStorage.getItem('pigeon.includeSubfolderContent') === 'true'; subfolderToggle?.click(); const subfolderContentToggle = directFolderContentOnly && descendantFolderContentVisible && subfolderToggle?.getAttribute('aria-pressed') === 'false' && localStorage.getItem('pigeon.includeSubfolderContent') === 'false';
          nestedFolderNode?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 190, clientY: 360 })); const folderAutoTagMenu = [...document.querySelectorAll('[data-location-action]')].some((button) => button.textContent.includes('Auto-Tag')); document.querySelector('[data-location-action="auto-tag"]')?.click(); const folderAutoTagDialog = document.querySelector('#text-entry-dialog').open && document.querySelector('#text-entry-title').textContent.includes('Auto-Tag'), autoTagInput = document.querySelector('#text-entry-input'), folderTagPopup = document.querySelector('#tag-autocomplete'), autoTagStartsClear = autoTagInput.value === '' && folderTagPopup.classList.contains('hidden'); const probeTag = allExistingTags()[0] || 'image'; autoTagInput.value = probeTag.slice(0, Math.min(3, probeTag.length)); autoTagInput.dispatchEvent(new Event('input', { bubbles: true })); const folderTagOption = folderTagPopup.querySelector('[data-tag-suggestion]'), folderTagOptionRect = folderTagOption?.getBoundingClientRect(); const folderTagAutocomplete = autoTagStartsClear && autoTagInput.dataset.tagAutocomplete === 'true' && autoTagInput.dataset.tagMultiple === 'true' && folderTagPopup.parentElement === document.querySelector('#text-entry-dialog') && folderTagPopup.matches(':popover-open') && folderTagOptionRect && document.elementFromPoint(folderTagOptionRect.left + 4, folderTagOptionRect.top + 4)?.closest('[data-tag-suggestion]') === folderTagOption; autoTagInput.value = 'Folder Alpha, Folder Beta'; document.querySelector('#confirm-text-entry').click(); await new Promise((resolve) => setTimeout(resolve, 100));
          const refreshedNestedFolder = [...document.querySelectorAll('.location-folder-item')].find((button) => decodeURIComponent(button.dataset.subfolder) === 'nested'); refreshedNestedFolder?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 190, clientY: 360 })); document.querySelector('[data-location-action="auto-tag"]')?.click(); const autoTagExistingPills = [...document.querySelectorAll('#text-entry-tag-pills [data-remove-entry-tag]')], autoTagPillsVisible = autoTagExistingPills.length === 2 && document.querySelector('#text-entry-input').value === '' && document.querySelector('#tag-autocomplete').classList.contains('hidden'); autoTagExistingPills[0]?.click(); document.querySelector('#text-entry-input').value = 'Folder Gamma'; document.querySelector('#confirm-text-entry').click(); await new Promise((resolve) => setTimeout(resolve, 80)); const savedFolderRuleTags = state.library.settings?.folderAutoTags?.[folderAutoTagKey(nestedFolderNode.dataset.locationId, 'nested')]?.tags || []; const autoTagPillEditor = autoTagPillsVisible && savedFolderRuleTags.length === 2 && savedFolderRuleTags.includes('Folder Beta') && savedFolderRuleTags.includes('Folder Gamma');
          const nestedLocationId = nestedFolderNode?.dataset.locationId, nestedTaggedAssets = state.library.assets.filter((asset) => asset.locationId === nestedLocationId && asset.path.replace(/\\\\/g, '/').includes('/nested/')), outsideNestedAsset = state.library.assets.find((asset) => asset.locationId === nestedLocationId && !asset.path.replace(/\\\\/g, '/').includes('/nested/')); const recursiveFolderAutoTags = Boolean(folderAutoTagMenu && folderAutoTagDialog && nestedTaggedAssets.length >= 1 && nestedTaggedAssets.every((asset) => ['Folder Alpha','Folder Beta'].every((tag) => asset.tags.includes(tag))) && outsideNestedAsset && !outsideNestedAsset.tags.includes('Folder Alpha'));
          document.querySelector('.location-folder-item[data-subfolder="nested"] [data-collapse-key]')?.click(); const physicalFolderCollapsed = ![...document.querySelectorAll('.location-folder-item')].some((button) => decodeURIComponent(button.dataset.subfolder) === 'nested/level-two') && JSON.parse(localStorage.getItem('pigeon.collapsedFolders.' + state.library.activePortfolioId) || '[]').some((key) => key.includes(':nested')); document.querySelector('.location-folder-item[data-subfolder="nested"] [data-collapse-key]')?.click(); physicalFolderNodes = [...document.querySelectorAll('.location-folder-item')]; const physicalFolderExpanded = physicalFolderNodes.some((button) => decodeURIComponent(button.dataset.subfolder) === 'nested/level-two');
          physicalFolderNodes.find((button) => decodeURIComponent(button.dataset.subfolder) === 'nested/level-two')?.click();
          await new Promise((resolve) => setTimeout(resolve, 80));
          const folderSubtreeFilter = physicalFolderNodes.length >= 2 && document.querySelectorAll('.asset-card').length === 1 && document.querySelector('.card-name')?.textContent.includes('nested-reference');
          const initialPortfolioId = (await window.pigeon.getLibrary()).activePortfolioId;
          const persistedFolderNavigation = JSON.parse(localStorage.getItem('pigeon.navigation.' + initialPortfolioId) || '{}');
          const navigationPersisted = Boolean(persistedFolderNavigation.locationSubfolder === 'nested/level-two' && persistedFolderNavigation.locationId);
          document.querySelector('[data-view="all"]')?.click();
          localStorage.setItem('pigeon.navigation.' + initialPortfolioId, JSON.stringify(persistedFolderNavigation));
          restoreNavigationState();
          const navigationRestored = state.locationSubfolder === 'nested/level-two' && state.locationId === persistedFolderNavigation.locationId;
          const rescanFolderNode = [...document.querySelectorAll('.location-folder-item')].find((button) => decodeURIComponent(button.dataset.subfolder) === 'nested/level-two'); rescanFolderNode?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 210, clientY: 370 })); const folderRescanAction = Boolean(document.querySelector('[data-location-action="rescan"]')); document.querySelector('[data-location-action="rescan"]')?.click(); document.querySelector('[data-view="all"]')?.click(); const indexingUiResponsive = state.view === 'all'; for (let attempt = 0; attempt < 30 && !state.library.assets.find((asset) => asset.filename === 'nested-reference.svg')?.sourceMissing; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50)); const rescannedLocation = state.library.locations.find((location) => location.id === nestedLocationId), missingSourceAsset = state.library.assets.find((asset) => asset.filename === 'nested-reference.svg'), missingSourceCard = document.querySelector('[data-asset-id="' + missingSourceAsset?.id + '"]'), missingSourceThumbnail = Boolean(missingSourceAsset?.sourceMissing && missingSourceAsset.thumbnailPath && missingSourceCard?.classList.contains('source-missing') && missingSourceCard.querySelector('.source-missing-overlay')?.textContent === 'Source Missing' && Number.parseFloat(getComputedStyle(missingSourceCard.querySelector('.asset-preview img')).opacity) < .5), newFileDiscovered = state.library.assets.some((asset) => asset.filename === 'smoke-rescan-new.svg'); const resilientUnstableIndexing = Boolean(folderRescanAction && indexingUiResponsive && rescannedLocation?.unstable && rescannedLocation?.scanProgress?.done && !rescannedLocation.partialScan && newFileDiscovered && missingSourceThumbnail);
          document.querySelector('[data-view="all"]')?.click();
          for (let attempt = 0; attempt < 3 && !document.querySelector('#grid-wrap').classList.contains('layout-justified'); attempt += 1) document.querySelector('#layout-button').click();
          const justifiedHeights = [...document.querySelectorAll('.asset-preview')].slice(0, 4).map((preview) => Math.round(preview.getBoundingClientRect().height));
          const justifiedRows = document.querySelector('#grid-wrap').classList.contains('layout-justified') && justifiedHeights.length > 1 && new Set(justifiedHeights).size === 1 && localStorage.getItem('pigeon.layout') === 'justified';
          for (let attempt = 0; attempt < 3 && (document.querySelector('#grid-wrap').classList.contains('layout-justified') || document.querySelector('#grid-wrap').classList.contains('layout-list')); attempt += 1) document.querySelector('#layout-button').click();
          const cards = [...document.querySelectorAll('.asset-card')];
          const ids = cards.slice(0, 2).map((card) => card.dataset.assetId);
          cards[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          const selectedAfterClick = document.querySelectorAll('.asset-card.selected').length;
          cards[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
          const multiSelected = document.querySelectorAll('.asset-card.multi-selected').length;
          cards[2]?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 250, clientY: 180 }));
          const contextSelectionPreserved = document.querySelectorAll('.asset-card.multi-selected').length === 2;
          document.body.click();
          const mapCards = [...document.querySelectorAll('[data-asset-kind="image"]')].slice(0, 2);
          mapCards[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          mapCards[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
          mapCards[1]?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 260, clientY: 185 }));
          const mapContextAction = Boolean(document.querySelector('[data-context-action="location"]') && document.querySelectorAll('.asset-card.multi-selected').length === 2);
          document.querySelector('[data-context-action="location"]')?.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const mapCanvas = document.querySelector('#location-map'), mapRect = mapCanvas.getBoundingClientRect();
          document.querySelector('#map-globe-mode').click();
          const mapModes = !document.querySelector('#map-view').classList.contains('hidden') && document.querySelector('#map-globe-mode').classList.contains('active');
          const globeZoomBefore = Number(mapCanvas.dataset.zoom);
          mapCanvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 }));
          const globeWheelZoom = Number(mapCanvas.dataset.zoom) > globeZoomBefore;
          for (let attempt = 0; attempt < 8 && !document.querySelector('#map-street-mode').classList.contains('active'); attempt += 1) mapCanvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 }));
          const globeToStreetZoom = document.querySelector('#map-street-mode').classList.contains('active') && Number(mapCanvas.dataset.zoom) >= 3;
          document.querySelector('#map-globe-mode').click();
          populateMapResults([{ label: 'Smoke test address', lat: 43.1, lon: -79.2 }]);
          const addressAutocomplete = document.querySelectorAll('.map-search input').length === 1 && document.querySelector('#map-search-results[role="listbox"] .map-search-result')?.textContent === 'Smoke test address';
          populateMapResults([]);
          mapCanvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 4, clientX: mapRect.left + mapRect.width / 2, clientY: mapRect.top + mapRect.height / 2 }));
          mapCanvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 4, clientX: mapRect.left + mapRect.width / 2, clientY: mapRect.top + mapRect.height / 2 }));
          document.querySelector('#map-street-mode').click();
          const streetMapMode = document.querySelector('#map-street-mode').classList.contains('active');
          document.querySelector('#map-save').click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          mapCards[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          const mapManualLocation = document.querySelector('#map-view').classList.contains('hidden') && document.querySelector('#meta-geo').textContent !== '—';
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          document.querySelector('[data-facet="types"]')?.click();
          const facetOpened = !document.querySelector('#facet-popover').classList.contains('hidden');
          document.querySelector('#app-menu-button')?.click();
          const appMenuOpened = !document.querySelector('#app-menu').classList.contains('hidden');
          document.querySelector('#app-menu-button')?.click();
          const compatibilityAsset = state.library.assets.find((asset) => asset.filename === 'sample-hevc.mp4'), videoCard = document.querySelector('[data-asset-id="' + compatibilityAsset?.id + '"]') || document.querySelector('[data-asset-kind="video"]');
          videoCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          const mediaPreview = Boolean(videoCard && !document.querySelector('#inspector-video').classList.contains('hidden') && document.querySelector('#inspector-video').src.startsWith('http://127.0.0.1:'));
          const videoThumbnail = Boolean(videoCard?.querySelector('img') && videoCard.querySelector('.video-play-badge'));
          const viewerGridWrap = document.querySelector('#grid-wrap');
          viewerGridWrap.scrollTop = Math.min(120, Math.max(0, viewerGridWrap.scrollHeight - viewerGridWrap.clientHeight));
          const viewerReturnPosition = viewerGridWrap.scrollTop;
          videoCard?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          const internalViewer = Boolean(!document.querySelector('#media-viewer').classList.contains('hidden') && !document.querySelector('#viewer-video').classList.contains('hidden') && document.querySelector('#viewer-video').src.startsWith('http://127.0.0.1:') && !document.querySelector('.sidebar').classList.contains('hidden') && !document.querySelector('#inspector').classList.contains('hidden'));
          await new Promise((resolve) => setTimeout(resolve, 100)); const videosDoNotAutoplay = document.querySelector('#viewer-video').paused && document.querySelector('#inspector-video').paused; document.querySelector('#viewer-video').play().catch(() => {}); await new Promise((resolve) => setTimeout(resolve, 350));
          const completeCompatibilityPlayback = !document.querySelector('#viewer-video').src.includes('stream=1') && document.querySelector('#viewer-video').readyState >= 2 && Number.isFinite(document.querySelector('#viewer-video').duration), videoPlayingMuted = document.querySelector('#viewer-video').readyState >= 2 && document.querySelector('#viewer-video').currentTime > 0 && document.querySelector('#viewer-video').muted, inspectorVideoPreview = Boolean(document.querySelector('#inspector-video').poster) && document.querySelector('#inspector-video').paused && !document.querySelector('#inspector-video').dataset.recovering;
          const onDemandProxyUrl = await window.pigeon.ensurePlayable(videoCard.dataset.assetId), smokeViewerVideo = document.querySelector('#viewer-video'); const videoProxy = onDemandProxyUrl?.includes('proxy=1'), videoProxyPrepared = videoProxy; smokeViewerVideo.src = onDemandProxyUrl; smokeViewerVideo.load(); smokeViewerVideo.play().catch(() => {}); for (let attempt = 0; attempt < 12 && (!Number.isFinite(smokeViewerVideo.duration) || smokeViewerVideo.readyState < 2); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 80)); const stableDuration = smokeViewerVideo.duration, seekTarget = Math.max(.1, stableDuration * .55); smokeViewerVideo.currentTime = seekTarget; for (let attempt = 0; attempt < 8 && Math.abs(smokeViewerVideo.currentTime - seekTarget) > .35; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 60)); const seekableVideoPlayback = videoProxy && Number.isFinite(stableDuration) && stableDuration > 0 && smokeViewerVideo.duration === stableDuration && Math.abs(smokeViewerVideo.currentTime - seekTarget) < .5 && !smokeViewerVideo.error;
          document.dispatchEvent(new KeyboardEvent('keydown', { key: String.fromCharCode(96), bubbles: true }));
          const fullViewToggled = document.querySelector('#media-viewer').classList.contains('full-view');
          document.dispatchEvent(new KeyboardEvent('keydown', { key: String.fromCharCode(96), bubbles: true }));
          document.querySelector('#close-viewer')?.click();
          await new Promise((resolve) => setTimeout(resolve, 80));
          const viewerPositionRemembered = viewerGridWrap.scrollTop === viewerReturnPosition;
          videoCard?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 300, clientY: 200 }));
          const contextText = document.querySelector('#asset-context-menu').textContent;
          const externalOpenOptions = contextText.includes('Open with default app') && contextText.includes('Open with…');
          document.body.click();
          const portraitCard = [...document.querySelectorAll('.asset-card')].find((card) => card.querySelector('.card-name')?.textContent.includes('portrait-reference'));
          portraitCard?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 100));
          const portraitFit = getComputedStyle(document.querySelector('#viewer-image')).objectFit === 'contain';
          document.dispatchEvent(new KeyboardEvent('keydown', { key: String.fromCharCode(96), bubbles: true }));
          const minimapVisible = !document.querySelector('#viewer-minimap').classList.contains('hidden');
          const viewerEditingToolbar = !document.querySelector('#viewer-edit-toolbar').classList.contains('hidden') && Boolean(document.querySelector('#viewer-rotate-left') && document.querySelector('#viewer-crop') && document.querySelector('#viewer-reset-edits'));
          document.querySelector('#viewer-crop').click();
          const cropGridVisible = !document.querySelector('#viewer-crop-overlay').classList.contains('hidden') && document.querySelectorAll('[data-crop-handle]').length === 8;
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          let inlineCropApplied = false;
          for (let attempt = 0; attempt < 24 && !inlineCropApplied; attempt += 1) { await new Promise((resolve) => setTimeout(resolve, 150)); inlineCropApplied = document.querySelector('#viewer-crop-overlay').classList.contains('hidden') && document.querySelector('#viewer-image').src.includes('edited=1'); }
          if (inlineCropApplied) document.querySelector('#viewer-reset-edits').click();
          let inlineCropReset = false;
          for (let attempt = 0; attempt < 16 && !inlineCropReset; attempt += 1) { await new Promise((resolve) => setTimeout(resolve, 120)); inlineCropReset = document.querySelector('#viewer-image').src.includes('edited=0'); }
          const viewerInlineCrop = cropGridVisible && inlineCropApplied && inlineCropReset;
          const portraitFitMinimap = Boolean(portraitCard && portraitFit && minimapVisible);
          document.querySelector('#close-viewer')?.click();
          const duplicateCount = Number(document.querySelector('#duplicates-count')?.textContent || 0);
          document.querySelector('[data-view="duplicates"]')?.click(); await new Promise((resolve) => setTimeout(resolve, 80));
          const duplicateGrouping = !document.querySelector('#duplicate-controls').classList.contains('hidden') && document.querySelectorAll('.duplicate-group .duplicate-row .asset-card').length >= 2;
          const duplicateImages = [...document.querySelectorAll('.duplicate-row .asset-preview img')], duplicateImagesFit = duplicateImages.length >= 2 && duplicateImages.every((image) => getComputedStyle(image).objectFit === 'contain' && Math.abs(image.getBoundingClientRect().width - image.closest('.asset-preview').getBoundingClientRect().width) < 3 && Math.abs(image.getBoundingClientRect().height - image.closest('.asset-preview').getBoundingClientRect().height) < 3);
          const duplicateControls = document.querySelector('#duplicate-controls'), duplicateControlsRect = duplicateControls.getBoundingClientRect(), duplicateWrapRect = document.querySelector('#grid-wrap').getBoundingClientRect(); const duplicateControlsPinned = getComputedStyle(duplicateControls).position === 'sticky' && Math.abs(duplicateControlsRect.top - duplicateWrapRect.top) < 3 && getComputedStyle(duplicateControls).boxShadow === 'none';
          const duplicateSourceCard = document.querySelector('.duplicate-row .asset-card'); duplicateSourceCard?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 260, clientY: 190 })); document.querySelector('[data-context-action="similar"]')?.click(); await new Promise((resolve) => setTimeout(resolve, 80));
          const sourceSimilarityView = !document.querySelector('#show-all-duplicate-groups').classList.contains('hidden') && document.querySelector('#duplicate-similarity').value === '78';
          document.querySelector('[data-view="all"]')?.click();
          const imageCard = document.querySelector('[data-asset-kind="image"]');
          const gridWrap = document.querySelector('#grid-wrap');
          gridWrap.scrollTop = Math.min(120, Math.max(0, gridWrap.scrollHeight - gridWrap.clientHeight));
          const scrollBeforeClick = gridWrap.scrollTop;
          imageCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          const scrollStable = gridWrap.scrollTop === scrollBeforeClick;
          const tagInput = document.querySelector('#asset-tags');
          tagInput.value = 'smoke-ui-tag';
          tagInput.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 60));
          const tagNoRefresh = document.querySelector('[data-asset-id="' + imageCard.dataset.assetId + '"]') === imageCard && tagInput.value === '' && [...document.querySelectorAll('.tag-pill')].some((pill) => pill.dataset.tag === 'smoke-ui-tag');
          const secondTagCard = [...document.querySelectorAll('[data-asset-kind="image"]')].find((card) => card.dataset.assetId !== imageCard.dataset.assetId);
          imageCard.dispatchEvent(new MouseEvent('click', { bubbles: true })); secondTagCard?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
          const batchTagIds = [...state.selectedIds]; document.querySelector('#batch-tag').click();
          const batchTagInput = document.querySelector('#batch-tag-input'); batchTagInput.value = 'smoke-ui'; batchTagInput.dispatchEvent(new Event('input', { bubbles: true })); const tagAutocomplete = document.querySelector('#tag-assignment-dialog').open && !document.querySelector('#tag-autocomplete').classList.contains('hidden') && [...document.querySelectorAll('[data-tag-suggestion]')].some((option) => option.dataset.tagSuggestion === 'smoke-ui-tag') && batchTagInput.getAttribute('aria-controls') === 'tag-autocomplete'; const allTagInputsAutocomplete = Boolean(smartTagAutocomplete && folderTagAutocomplete && tagAutocomplete && document.querySelector('#asset-tags').dataset.tagAutocomplete === 'true');
          document.querySelector('#batch-tag-input').value = 'smoke-multi-one, smoke-multi-two'; document.querySelector('#apply-tag-assignment').click();
          await new Promise((resolve) => setTimeout(resolve, 60));
          const multiAssetTagging = batchTagIds.length === 2 && batchTagIds.every((id) => ['smoke-multi-one', 'smoke-multi-two'].every((tag) => state.library.assets.find((asset) => asset.id === id)?.tags?.includes(tag)));
          state.selectedIds = new Set(batchTagIds); state.selectedId = imageCard.dataset.assetId; updateCardSelectionStyles(); const rotationBeforeBatch = new Map(batchTagIds.map((id) => [id, state.library.assets.find((asset) => asset.id === id)?.rotation || 0])); imageCard.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 280, clientY: 190 })); const thumbnailCropRemoved = !document.querySelector('[data-context-action="crop"]'), batchRotationMenu = document.querySelector('[data-context-action="rotate-right"]')?.textContent.trim() === 'Rotate 2 images right'; document.querySelector('[data-context-action="rotate-right"]')?.click(); await new Promise((resolve) => setTimeout(resolve, 80)); const rotatedThumbnailBounds = batchTagIds.every((id) => { const card = document.querySelector('[data-asset-id="' + id + '"]'), previewRect = card?.querySelector('.asset-preview')?.getBoundingClientRect(), imageRect = card?.querySelector('.asset-preview > img')?.getBoundingClientRect(); return previewRect && imageRect && Math.abs(previewRect.width - imageRect.width) < 2 && Math.abs(previewRect.height - imageRect.height) < 2; }); const multiImageRotation = batchRotationMenu && rotatedThumbnailBounds && batchTagIds.every((id) => state.library.assets.find((asset) => asset.id === id)?.rotation === (rotationBeforeBatch.get(id) + 90) % 360);
          imageCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          document.querySelector('.tag-pill[data-tag="smoke-ui-tag"]')?.click();
          await new Promise((resolve) => setTimeout(resolve, 60));
          const tagEditRoundTrip = tagInput.value === 'smoke-ui-tag' && !document.querySelector('.tag-pill[data-tag="smoke-ui-tag"]');
          imageCard.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 280, clientY: 190 }));
          document.querySelector('[data-context-action="rotate-right"]')?.click();
          await new Promise((resolve) => setTimeout(resolve, 60));
          const rotatedAsset = state.library.assets.find((asset) => asset.id === imageCard.dataset.assetId), rotatedPreview = document.querySelector('[data-asset-id="' + imageCard.dataset.assetId + '"] .asset-preview'), rotatedPreviewRect = rotatedPreview?.getBoundingClientRect(), rotatedImageRect = rotatedPreview?.querySelector('img')?.getBoundingClientRect();
          const rotatedThumbnailResized = Boolean(rotatedAsset && rotatedPreviewRect && rotatedImageRect && ((rotatedAsset.rotation % 180 !== 0) ? (rotatedAsset.width > rotatedAsset.height) === (rotatedPreviewRect.height > rotatedPreviewRect.width) : (rotatedAsset.width > rotatedAsset.height) === (rotatedPreviewRect.width > rotatedPreviewRect.height)) && Math.abs(rotatedImageRect.width - rotatedPreviewRect.width) < 3 && Math.abs(rotatedImageRect.height - rotatedPreviewRect.height) < 3);
          const thumbnailRotation = document.querySelector('[data-asset-id="' + imageCard.dataset.assetId + '"] img')?.style.transform.includes('rotate(' + rotatedAsset.rotation + 'deg)') && rotatedThumbnailResized;
          imageCard.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 80));
          const viewerImagePreview = document.querySelector('#viewer-image').complete && document.querySelector('#viewer-image').naturalWidth > 0 && document.querySelector('#viewer-image').src.startsWith('pigeon-asset:'), rotatedViewerRect = document.querySelector('#viewer-image').getBoundingClientRect(), rotatedViewerStageRect = document.querySelector('.viewer-stage').getBoundingClientRect();
          const rotatedViewerFit = !document.querySelector('#media-viewer').classList.contains('hidden') && rotatedViewerRect.width <= rotatedViewerStageRect.width + 2 && rotatedViewerRect.height <= rotatedViewerStageRect.height + 2;
          document.querySelector('#close-viewer')?.click();
          const assetsBeforeDuplicate = (await window.pigeon.getLibrary()).totalAssets;
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));
          let duplicateTotal = assetsBeforeDuplicate;
          for (let attempt = 0; attempt < 20 && duplicateTotal <= assetsBeforeDuplicate; attempt += 1) { await new Promise((resolve) => setTimeout(resolve, 150)); duplicateTotal = (await window.pigeon.getLibrary()).totalAssets; }
          const keyboardDuplicate = duplicateTotal > assetsBeforeDuplicate;
          imageCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          document.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 100));
          const numericRating = document.querySelectorAll('#rating-row .star.active[data-rating]').length === 4;
          document.querySelector('#settings-button').click();
          const shortcutInput = document.querySelector('#favorite-shortcut');
          shortcutInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }));
          const locationShortcutInput = document.querySelector('#location-shortcut');
          locationShortcutInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, bubbles: true }));
          const mapShortcutConfigured = localStorage.getItem('pigeon.locationShortcut') === 'Ctrl+L';
          const encryptSetting = document.querySelector('#encrypt-locked-folders'); encryptSetting.checked = true; encryptSetting.dispatchEvent(new Event('change', { bubbles: true }));
          const confirmMoves = document.querySelector('#confirm-folder-moves'); confirmMoves.checked = false; confirmMoves.dispatchEvent(new Event('change', { bubbles: true }));
          const titleLineOne = document.querySelector('#thumbnail-title-line-1'); titleLineOne.value = 'filename'; titleLineOne.dispatchEvent(new Event('change', { bubbles: true }));
          const titleLineTwo = document.querySelector('#thumbnail-title-line-2'); titleLineTwo.value = 'dimensions'; titleLineTwo.dispatchEvent(new Event('change', { bubbles: true }));
          const thumbnailTitleSettings = localStorage.getItem('pigeon.thumbnailTitleLine1') === 'filename' && localStorage.getItem('pigeon.thumbnailTitleLine2') === 'dimensions' && document.querySelectorAll('.asset-card .card-title-line').length >= 2;
          const settingsStyle = getComputedStyle(document.querySelector('#settings-dialog'));
          const settingsDesign = settingsStyle.fontFamily === getComputedStyle(document.documentElement).fontFamily && parseFloat(settingsStyle.fontSize) === 11;
          document.querySelector('[data-preference-page="preview"]').click();
          const preferencesPages = document.querySelectorAll('[data-preference-page]').length >= 13 && document.querySelector('[data-preference-content="preview"]').classList.contains('active') && document.querySelector('[data-pref="lowResourceMode"]').checked;
          document.querySelector('#save-preferences').click();
          const storedPreferences = JSON.parse(localStorage.getItem('pigeon.preferences') || '{}');
          const folderSecuritySettings = localStorage.getItem('pigeon.encryptLockedFolders') === 'true' && localStorage.getItem('pigeon.confirmFolderMoves') === 'false' && storedPreferences.lowResourceMode === true;
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, bubbles: true }));
          const mapShortcut = mapShortcutConfigured && !document.querySelector('#map-view').classList.contains('hidden');
          document.querySelector('#map-cancel').click();
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 100));
          const favoriteShortcut = localStorage.getItem('pigeon.favoriteShortcut') === 'Ctrl+F' && Boolean(document.querySelector('[data-asset-id="' + imageCard.dataset.assetId + '"] .card-favorite'));
          const stackResult = await window.pigeon.stackAssets(ids);
          await new Promise((resolve) => setTimeout(resolve, 80));
          const stackBadge = document.querySelector('.stack-badge[data-stack-id="' + stackResult.stackId + '"]');
          stackBadge?.click();
          const stackPreview = Boolean(stackBadge && document.querySelectorAll('.stack-badge[data-stack-id="' + stackResult.stackId + '"]').length >= 2);
          document.querySelector('[data-asset-id="' + ids[0] + '"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          document.querySelector('#asset-tags').value = 'smoke-stack-one, smoke-stack-two'; document.querySelector('#asset-tags').dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 120));
          const stackTagging = ids.every((id) => ['smoke-stack-one', 'smoke-stack-two'].every((tag) => state.library.assets.find((asset) => asset.id === id)?.tags?.includes(tag)));
          await window.pigeon.unstackAssets(ids);
          await new Promise((resolve) => setTimeout(resolve, 120));
          const zoom = document.querySelector('#zoom-slider'); zoom.value = '222'; zoom.dispatchEvent(new Event('input', { bubbles: true }));
          const wheelZoomBefore = zoom.value, normalWheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 }); document.querySelector('#grid-wrap').dispatchEvent(normalWheel); const ordinaryWheelScroll = zoom.value === wheelZoomBefore && !normalWheel.defaultPrevented;
          const zoomRemembered = localStorage.getItem('pigeon.thumbnailSize') === '222';
          document.querySelector('#sidebar-resizer').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          const sidebarBefore = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'));
          document.querySelector('#sidebar-resizer').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
          const panelResize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) > sidebarBefore && Number(localStorage.getItem('pigeon.sidebarWidth')) > sidebarBefore;
          document.dispatchEvent(new KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 60));
          document.dispatchEvent(new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 60));
          const contentZoom = localStorage.getItem('pigeon.windowZoom') === '1.1';
          document.querySelector('[data-view="tags"]')?.click();
          const tagManager = !document.querySelector('#tag-browser').classList.contains('hidden') && document.querySelectorAll('.tag-manager-item').length > 0;
          document.querySelector('.tag-manager-name')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          const tagDoubleClick = document.querySelector('#tag-browser').classList.contains('hidden') && document.querySelector('[data-facet="tags"]').classList.contains('has-selection') && document.querySelectorAll('.asset-card').length > 0;
          const collection = await window.pigeon.createCollection('Smoke collection', null);
          const batchUpdated = await window.pigeon.batchUpdateAssets(ids, { addTags: ['smoke-batch'], collectionId: collection.id });
          await window.pigeon.setCollectionAutoTags(collection.id, ['Collection Alpha', 'Collection Beta']);
          const moveTarget = await window.pigeon.createCollection('Smoke move target', collection.id);
          await new Promise((resolve) => setTimeout(resolve, 80));
          document.querySelector('[data-collection-id="' + collection.id + '"] [data-collapse-key]')?.click(); const collectionFolderCollapsed = !document.querySelector('[data-collection-id="' + moveTarget.id + '"]'); document.querySelector('[data-collection-id="' + collection.id + '"] [data-collapse-key]')?.click(); const collectionFolderExpanded = Boolean(document.querySelector('[data-collection-id="' + moveTarget.id + '"]'));
          document.querySelector('[data-collection-id="' + collection.id + '"]')?.click();
          await new Promise((resolve) => setTimeout(resolve, 80));
          state.confirmFolderMoves = true;
          const transfer = new DataTransfer(); transfer.setData('application/x-pigeon-assets', JSON.stringify(ids));
          document.querySelector('[data-collection-id="' + moveTarget.id + '"]')?.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
          await new Promise((resolve) => setTimeout(resolve, 100));
          const sourceCount = document.querySelector('[data-collection-id="' + collection.id + '"] small')?.textContent;
          const targetCount = document.querySelector('[data-collection-id="' + moveTarget.id + '"] small')?.textContent;
          const collectionAddWithoutPrompt = Number(sourceCount) >= 2 && Number(targetCount) >= 2 && !document.querySelector('#text-entry-dialog').open;
          const recursiveCollectionAutoTags = ids.every((id) => ['Collection Alpha','Collection Beta'].every((tag) => state.library.assets.find((asset) => asset.id === id)?.tags?.includes(tag)));
          await window.pigeon.setCollectionPassword(moveTarget.id, 'smoke-password', true);
          await window.pigeon.lockCollectionNow(moveTarget.id);
          const lockedSummary = await window.pigeon.getLibrary();
          const passwordLockHidden = lockedSummary.collections.find((item) => item.id === moveTarget.id)?.locked === true && lockedSummary.collections.find((item) => item.id === moveTarget.id)?.lock?.encrypted === true;
          const wrongPasswordRejected = !(await window.pigeon.unlockCollection(moveTarget.id, 'wrong-password'));
          const correctPasswordAccepted = await window.pigeon.unlockCollection(moveTarget.id, 'smoke-password');
          const passwordRemoved = await window.pigeon.removeCollectionPassword(moveTarget.id, 'smoke-password');
          await selectCollection(moveTarget.id); await new Promise((resolve) => setTimeout(resolve, 60));
          state.selectedIds = new Set([ids[0]]); state.selectedId = ids[0]; updateCardSelectionStyles(); document.querySelector('[data-asset-id="' + ids[0] + '"]')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 300, clientY: 220 }));
          const removeFromCollectionMenu = document.querySelector('[data-context-action="remove-from-collection"]')?.textContent.trim() === 'Remove from collection'; document.querySelector('[data-context-action="remove-from-collection"]')?.click(); await new Promise((resolve) => setTimeout(resolve, 100));
          const contextCollectionRemoval = removeFromCollectionMenu && !(state.library.assets.find((asset) => asset.id === ids[0])?.collectionIds || []).includes(moveTarget.id) && (state.library.assets.find((asset) => asset.id === ids[0])?.collectionIds || []).includes(collection.id) && !state.library.assets.find((asset) => asset.id === ids[0])?.deletedAt;
          await window.pigeon.batchUpdateAssets(ids, { collectionId: moveTarget.id }); await new Promise((resolve) => setTimeout(resolve, 80)); await selectCollection(moveTarget.id); state.selectedIds = new Set(ids); state.selectedId = ids[0]; updateCardSelectionStyles(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 100));
          const deleteCollectionRemoval = ids.every((id) => { const asset = state.library.assets.find((item) => item.id === id); return asset && !(asset.collectionIds || []).includes(moveTarget.id) && (asset.collectionIds || []).includes(collection.id) && !asset.deletedAt; });
          const collectionReferenceRemoval = Boolean(contextCollectionRemoval && deleteCollectionRemoval);
          const smartFolder = await window.pigeon.createSmartFolder('Smoke smart folder', { tags: ['smoke-batch'] });
          const duplicateGroups = await window.pigeon.findDuplicates();
          const autoTagged = await window.pigeon.autoTag(ids);
          const backupPath = await window.pigeon.backupLibrary();
          await window.pigeon.updateAsset(ids[0], { annotations: [{ type: 'rect', x: 1, y: 1, width: 10, height: 10, color: '#ff0000' }] });
          const plugins = await window.pigeon.listPlugins();
          const renameAsset = [...state.library.assets].reverse().find((asset) => asset.filename.startsWith('smoke-ui-drop-source') && !asset.sourceMissing) || state.library.assets.find((asset) => asset.kind === 'image' && !asset.sourceMissing);
          let fileRenameWorkflows = false;
          if (renameAsset) {
            const renameExtension = renameAsset.filename.slice(renameAsset.name.length);
            state.view = 'all'; state.kind = 'all'; state.query = ''; document.querySelector('#search-input').value = ''; Object.values(state.filters).forEach((values) => values.clear()); state.locationId = null; state.collectionId = null; state.smartFolderId = null; renderGrid();
            state.selectedId = renameAsset.id; state.selectedIds = new Set([renameAsset.id]); updateCardSelectionStyles(); renderInspector(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }));
            const f2Focus = document.activeElement === document.querySelector('#asset-name') && document.querySelector('#asset-name').value === renameAsset.name && !document.querySelector('#asset-name').value.toLowerCase().endsWith(renameExtension.toLowerCase()), firstStem = 'smoke-f2-renamed-' + Date.now();
            document.querySelector('#asset-name').value = firstStem; await renameAssetFile(renameAsset.id, firstStem);
            lastFilenameClick = { assetId: null, time: 0 };
            const panelAsset = state.library.assets.find((asset) => asset.id === renameAsset.id), panelRenamed = panelAsset?.name === firstStem && panelAsset?.filename === firstStem + renameExtension, renameCard = document.querySelector('[data-asset-id="' + renameAsset.id + '"]'), renameTitle = renameCard?.querySelector('.card-title-line[data-title-field="filename"]');
            renameTitle?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 380)); renameTitle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            const inlineInput = document.querySelector('[data-asset-id="' + renameAsset.id + '"] .card-filename-input'), inlineStem = 'smoke-inline-renamed-' + Date.now(), inlineExtensionHidden = inlineInput?.value === firstStem;
            let inlineUpdated = null; if (inlineInput) { inlineInput.value = inlineStem; inlineUpdated = await renameAssetFile(renameAsset.id, inlineInput.value); }
            fileRenameWorkflows = Boolean(f2Focus && panelRenamed && inlineExtensionHidden && inlineUpdated?.name === inlineStem && inlineUpdated?.filename === inlineStem + renameExtension);
          }
          const originalPortfolio = (await window.pigeon.getLibrary()).activePortfolioId;
          document.querySelector('.brand-menu').click(); document.querySelector('#quick-create-portfolio').click(); document.querySelector('#text-entry-input').value = 'Smoke second portfolio'; document.querySelector('#confirm-text-entry').click(); await new Promise((resolve) => setTimeout(resolve, 300));
          const secondPortfolio = (await window.pigeon.getLibrary()).portfolios.find((portfolio) => portfolio.name === 'Smoke second portfolio');
          const renamedPortfolio = await window.pigeon.renamePortfolio(secondPortfolio.id, 'Smoke renamed portfolio');
          document.querySelector('.brand-menu').click();
          const portfolioSwitcherModal = !document.querySelector('#portfolio-switcher').classList.contains('hidden') && document.querySelectorAll('.portfolio-switcher-item').length >= 2 && !document.querySelector('#portfolio-switcher').textContent.includes('Library');
          await switchPortfolioTo(secondPortfolio.id);
          const emptyPortfolio = await window.pigeon.getLibrary();
          await switchPortfolioTo(originalPortfolio);
          const returnedPortfolio = await window.pigeon.getLibrary();
          const removedPortfolio = await window.pigeon.removePortfolio(secondPortfolio.id);
          const portfolioManagement = Boolean(renamedPortfolio.name === 'Smoke renamed portfolio' && emptyPortfolio.activePortfolioId === secondPortfolio.id && returnedPortfolio.activePortfolioId === originalPortfolio && removedPortfolio);
          const coreApis = Boolean(collection.id && batchUpdated === 2 && collectionAddWithoutPrompt && collectionReferenceRemoval && recursiveCollectionAutoTags && passwordLockHidden && wrongPasswordRejected && correctPasswordAccepted && passwordRemoved && smartFolder.id && duplicateGroups.some((group) => group.length >= 2) && autoTagged === 2 && backupPath && Array.isArray(plugins));
          return { cards: cards.length, startupSplashHidden, creationDialogs, portfolioRowTrigger, customItemIcons, contextMenuLeftAligned, foldersCollapse: physicalFolderCollapsed && physicalFolderExpanded && collectionFolderCollapsed && collectionFolderExpanded, autoTagPillEditor, folderContextMenuPositioned, iconPickerOpened, recursiveFolderAutoTags, iconStateSaved, iconRendered, managedDropStorage, externalFileDrop, droppedInboxFound: Boolean(droppedInboxAsset), droppedInboxTagged: Boolean(droppedInboxAsset?.tags?.length), droppedInboxFiled: Boolean(droppedInboxAsset?.collectionIds?.length), managedDropWorkflow, ordinaryWheelScroll, sidebarSectionsCollapse, subfolderContentToggle, folderSubtreeFilter, folderRescanAction, missingSourceThumbnail, newFileDiscovered, resilientUnstableIndexing, navigationPersisted, navigationRestored, mapContextAction, mapModes, globeWheelZoom, globeToStreetZoom, addressAutocomplete, streetMapMode, mapManualLocation, justifiedRows, allTagInputsAutocomplete, modalTagAutocompleteAccessible: folderTagAutocomplete, duplicateImagesFit, duplicateControlsPinned, tagAutocomplete, viewerEditingToolbar, viewerInlineCrop, cropGridVisible, inlineCropApplied, inlineCropReset, portfolioManagement, selectedAfterClick, multiSelected, collectionAddWithoutPrompt, collectionReferenceRemoval, contextSelectionPreserved, facetOpened, appMenuOpened, mediaPreview, videoThumbnail, internalViewer, videosDoNotAutoplay, completeCompatibilityPlayback, videoPlayingMuted, inspectorVideoPreview, videoProxyPrepared, seekableVideoPlayback, videoProxy, fullViewToggled, viewerPositionRemembered, externalOpenOptions, portraitFitMinimap, duplicateCount, duplicateGrouping, sourceSimilarityView, scrollStable, tagNoRefresh, multiAssetTagging, thumbnailCropRemoved, multiImageRotation, viewerImagePreview, stackTagging, tagEditRoundTrip, thumbnailRotation, rotatedViewerFit, keyboardDuplicate, numericRating, favoriteShortcut, mapShortcut, thumbnailTitleSettings, fileRenameWorkflows, folderSecuritySettings, settingsDesign, preferencesPages, stackPreview, recursiveCollectionAutoTags, tagManager, tagDoubleClick, zoomRemembered, panelResize, contentZoom, coreApis };
        })()`);
        console.log(`[smoke] ui verification ${JSON.stringify(verification)}`);
        if (verification.cards < 7 || !verification.startupSplashHidden || !verification.creationDialogs || !verification.portfolioRowTrigger || !verification.customItemIcons || !verification.contextMenuLeftAligned || !verification.foldersCollapse || !verification.autoTagPillEditor || !verification.recursiveFolderAutoTags || !verification.managedDropWorkflow || !verification.externalFileDrop || !verification.ordinaryWheelScroll || !verification.sidebarSectionsCollapse || !verification.subfolderContentToggle || !verification.folderSubtreeFilter || !verification.folderRescanAction || !verification.missingSourceThumbnail || !verification.newFileDiscovered || !verification.resilientUnstableIndexing || !verification.navigationPersisted || !verification.navigationRestored || !verification.mapContextAction || !verification.mapModes || !verification.globeWheelZoom || !verification.globeToStreetZoom || !verification.addressAutocomplete || !verification.streetMapMode || !verification.mapManualLocation || !verification.justifiedRows || !verification.duplicateImagesFit || !verification.duplicateControlsPinned || !verification.tagAutocomplete || !verification.allTagInputsAutocomplete || !verification.viewerEditingToolbar || !verification.viewerInlineCrop || !verification.portfolioManagement || verification.duplicateCount < 2 || !verification.duplicateGrouping || !verification.sourceSimilarityView || verification.selectedAfterClick !== 1 || verification.multiSelected < 2 || !verification.collectionAddWithoutPrompt || !verification.collectionReferenceRemoval || !verification.contextSelectionPreserved || !verification.facetOpened || !verification.appMenuOpened || !verification.mediaPreview || !verification.videoThumbnail || !verification.internalViewer || !verification.videosDoNotAutoplay || !verification.completeCompatibilityPlayback || !verification.videoPlayingMuted || !verification.inspectorVideoPreview || !verification.videoProxyPrepared || !verification.seekableVideoPlayback || !verification.videoProxy || !verification.fullViewToggled || !verification.viewerPositionRemembered || !verification.externalOpenOptions || !verification.portraitFitMinimap || !verification.scrollStable || !verification.tagNoRefresh || !verification.multiAssetTagging || !verification.thumbnailCropRemoved || !verification.multiImageRotation || !verification.viewerImagePreview || !verification.stackTagging || !verification.tagEditRoundTrip || !verification.thumbnailRotation || !verification.rotatedViewerFit || !verification.keyboardDuplicate || !verification.numericRating || !verification.favoriteShortcut || !verification.mapShortcut || !verification.thumbnailTitleSettings || !verification.fileRenameWorkflows || !verification.folderSecuritySettings || !verification.settingsDesign || !verification.preferencesPages || !verification.stackPreview || !verification.tagManager || !verification.tagDoubleClick || !verification.zoomRemembered || !verification.panelResize || !verification.contentZoom || !verification.coreApis) throw new Error(`UI verification failed: ${JSON.stringify(verification)}`);
        if (process.env.PIGEON_SMOKE_CAPTURE_MAP === '1') {
          await mainWindow.webContents.executeJavaScript(`(() => { document.querySelector('[data-view="all"]')?.click(); document.querySelector('#clear-filters')?.click(); const card = document.querySelector('[data-asset-kind="image"]'); card?.dispatchEvent(new MouseEvent('click', { bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, bubbles: true })); document.querySelector('#map-globe-mode')?.click(); })()`);
          await new Promise((resolve) => setTimeout(resolve, 250));
        } else if (process.env.PIGEON_SMOKE_CAPTURE_PORTFOLIO === '1') {
          await mainWindow.webContents.executeJavaScript(`(() => { document.querySelector('.brand-menu')?.click(); })()`); await new Promise((resolve) => setTimeout(resolve, 120));
        } else if (process.env.PIGEON_SMOKE_CAPTURE_SMART === '1') {
          await mainWindow.webContents.executeJavaScript(`(() => { document.querySelector('#save-smart-folder')?.click(); })()`); await new Promise((resolve) => setTimeout(resolve, 120));
        } else if (process.env.PIGEON_SMOKE_CAPTURE_PREFERENCES === '1') {
          await mainWindow.webContents.executeJavaScript(`(() => { document.querySelector('#settings-button')?.click(); })()`); await new Promise((resolve) => setTimeout(resolve, 120));
        }
      }
      try {
        let image;
        for (let attempt = 0; attempt < 3 && !image; attempt += 1) {
          try {
            image = await mainWindow.webContents.capturePage();
          } catch (error) {
            console.warn(`[smoke] capture attempt ${attempt + 1} failed: ${error.message}`);
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
        if (image) {
          await fsp.writeFile(path.join(process.cwd(), 'pigeon-smoke.png'), image.toPNG());
          console.log('[smoke] capture complete');
          if(smokeLarge){const placeholders=await mainWindow.webContents.executeJavaScript(`(async()=>{state.kind='all';renderGrid();await new Promise((resolve)=>setTimeout(resolve,180));const wrap=document.querySelector('#grid-wrap'),cards=[...document.querySelectorAll('.asset-card')],beforeLoaded=cards.filter((card)=>card.querySelector('.asset-preview>img')).length;wrap.scrollTop=wrap.scrollHeight;wrap.dispatchEvent(new Event('scroll'));await new Promise((resolve)=>setTimeout(resolve,760));const afterLoaded=cards.filter((card)=>card.querySelector('.asset-preview>img')).length;return{scrollTop:wrap.scrollTop,scrollHeight:wrap.scrollHeight,cards:cards.length,beforeLoaded,afterLoaded,total:state.library.assets.length,last:cards.at(-1)?.dataset.assetId,pending:cards.filter((card)=>card.querySelector('[data-thumbnail-src]')).length,failed:cards.filter((card)=>card.classList.contains('thumbnail-load-failed')).length};})()`);console.log(`[smoke] placeholder grid ${JSON.stringify(placeholders)}`);if(placeholders.total>=6000&&(placeholders.cards!==placeholders.total||placeholders.last!==`asset-${placeholders.total-1}`||placeholders.pending<placeholders.total-8))throw new Error(`Placeholder grid verification failed: ${JSON.stringify(placeholders)}`);}
        }
      } finally {
        if (smokeSeeded) {
          const fixtureDir = path.join(app.getPath('userData'), 'smoke-fixtures');
          const pendingFixtureDirs = [fixtureDir];
          while (pendingFixtureDirs.length) {
            const directory = pendingFixtureDirs.shift();
            for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
              const entryPath = path.join(directory, entry.name);
              if (entry.isDirectory()) pendingFixtureDirs.push(entryPath);
              else if (/ copy(?: \d+)?\.[^.]+$/i.test(entry.name)) await fsp.rm(entryPath, { force: true });
            }
          }
        }
        app.quit();
      }
    });
  }
}

const registerIpcHandler=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(channel,handler)=>registerIpcHandler(channel,async(event,...args)=>{try{return await handler(event,...args);}catch(error){const context={channel,senderId:event?.sender?.id,args:args.map((value)=>diagnosticValue(value).slice(0,2000))};writeFatalDiagnostic('ipc:handler',error,context);recordDiagnostic('error',`Unhandled IPC exception in ${channel}`,{error:diagnosticValue(error),...context});throw error;}});
ipcMain.on('diagnostics:fatal',(_event,payload)=>{writeFatalDiagnostic(payload?.source||'preload',payload?.message||'Unknown fatal error',payload?.context||'');recordDiagnostic('error',payload?.message||'Preload exception',payload?.context||'');});
ipcMain.handle('app:info', () => ({ name: 'Pigeon', version: app.getVersion(), repository: 'https://github.com/vcsoc/pigeon' }));
ipcMain.handle('app:legal-documents', async () => Object.fromEntries(await Promise.all(Object.entries({ community:'LICENSE.md', commercial:'COMMERCIAL-LICENSE.md', notices:'NOTICE.md', trademarks:'TRADEMARKS.md' }).map(async ([key,file]) => [key,await fsp.readFile(path.join(app.getAppPath(),file),'utf8')]))));
ipcMain.handle('diagnostics:get', () => diagnosticEntries.slice(-1000));
ipcMain.handle('telemetry:get', () => telemetrySnapshot());
ipcMain.handle('folder-tree:build', (_event, { collapsedKeys = [], limits = {} }) => new Promise((resolve) => { const locations = library.locations.map(({id,path})=>({id,path})), assets = library.assets.map(({locationId,path,created,modified,indexedAt})=>({locationId,path,created,modified,indexedAt})), emptyFolders=library.settings?.emptyFolders||{},worker = new Worker(path.join(__dirname, 'folder-tree-worker.js'), { workerData: { locations, assets, emptyFolders, collapsedKeys, limits } }), telemetry = trackWorker(worker, 'folder-tree', { filesTotal: assets.length }); let settled = false; const finish = (value) => { if (settled) return; settled = true; telemetry.filesCompleted = assets.length; worker.terminate().catch(() => {}); resolve(value || []); }; worker.once('message', finish); worker.once('error', (error) => { recordDiagnostic('error', 'Folder tree worker failed', error); finish([]); }); worker.once('exit', () => finish([])); }));
ipcMain.handle('diagnostics:log', (_event, { level = 'error', message, context }) => recordDiagnostic(['info','warning','error'].includes(level) ? level : 'error', message, context));
ipcMain.handle('diagnostics:clear', async () => { diagnosticEntries = []; if (diagnosticsFile) await fsp.writeFile(diagnosticsFile, ''); return true; });
ipcMain.handle('diagnostics:remove', async (_event, id) => { diagnosticEntries = diagnosticEntries.filter((entry) => entry.id !== id); if (diagnosticsFile) await fsp.writeFile(diagnosticsFile, diagnosticEntries.map((entry) => JSON.stringify(entry)).join('\n') + (diagnosticEntries.length ? '\n' : '')); return true; });
ipcMain.handle('diagnostics:open-file', async () => { if (!diagnosticsFile) return false; await fsp.appendFile(diagnosticsFile, ''); return shell.showItemInFolder(diagnosticsFile); });
function formatUpdateBytes(value){const bytes=Math.max(0,Number(value)||0);if(bytes<1024*1024)return`${Math.round(bytes/1024)} KB`;if(bytes<1024**3)return`${(bytes/1024**2).toFixed(1)} MB`;return`${(bytes/1024**3).toFixed(2)} GB`;}
ipcMain.handle('app:check-for-updates', async () => {
  if (!app.isPackaged) return { status: 'development', currentVersion: app.getVersion() };
  autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = true;
  let update;
  try { update = await autoUpdater.checkForUpdates(); }
  catch (error) {
    if (!isMissingUpdateMetadataError(error)) throw error;
    recordDiagnostic('warning', 'Update metadata is unavailable for this platform', { platform: process.platform, version: app.getVersion() });
    return { status: 'unavailable', currentVersion: app.getVersion(), reason: 'missing-update-metadata' };
  }
  const version = update?.updateInfo?.version; if (!version || version === app.getVersion()) return { status: 'current', currentVersion: app.getVersion() };
  const choice = await dialog.showMessageBox(mainWindow, { type: 'info', title: 'Pigeon Update Available', message: `Pigeon ${version} is available`, detail: `You are using ${app.getVersion()}. Download and install the update for ${process.platform}?`, buttons: ['Download and Install', 'Later'], defaultId: 0, cancelId: 1 }); if (choice.response !== 0) return { status: 'available', version };
  const progressId=`application:update:${version}`;let latest={transferred:0,total:0};
  const onDownloadProgress=(progress)=>{latest={transferred:Math.max(0,Number(progress.transferred)||0),total:Math.max(0,Number(progress.total)||0)};const percent=Number.isFinite(progress.percent)?Math.max(0,Math.min(100,progress.percent)):latest.total?latest.transferred/latest.total*100:0,speed=Math.max(0,Number(progress.bytesPerSecond)||0),detail=[`${percent.toFixed(0)}%`,latest.total?`${formatUpdateBytes(latest.transferred)} of ${formatUpdateBytes(latest.total)}`:formatUpdateBytes(latest.transferred),speed?`${formatUpdateBytes(speed)}/s`:null].filter(Boolean).join(' · ');reportBackgroundProgress(progressId,{label:`Downloading Pigeon ${version}`,detail,completed:latest.transferred,total:latest.total});};
  autoUpdater.on('download-progress',onDownloadProgress);reportBackgroundProgress(progressId,{label:`Downloading Pigeon ${version}`,detail:'Preparing download…'});
  try{await autoUpdater.downloadUpdate();reportBackgroundProgress(progressId,{label:`Pigeon ${version} downloaded`,detail:'Ready to install',completed:latest.total||latest.transferred||1,total:latest.total||latest.transferred||1,done:true});}
  catch(error){reportBackgroundProgress(progressId,{label:'Update download failed',detail:error.message,done:true,status:'failed'});throw error;}
  finally{autoUpdater.removeListener('download-progress',onDownloadProgress);}
  const install = await dialog.showMessageBox(mainWindow, { type: 'info', title: 'Update Ready', message: `Pigeon ${version} is ready to install`, detail: 'Pigeon will restart to finish the update.', buttons: ['Restart and Install', 'Install on Quit'], defaultId: 0, cancelId: 1 }); if (install.response === 0) setImmediate(() => autoUpdater.quitAndInstall(false, true)); return { status: 'downloaded', version };
});
ipcMain.handle('app:open-external', (_event, value) => { const url = new URL(String(value || '')); if (url.protocol !== 'https:' || url.hostname !== 'github.com') throw new Error('Only the Pigeon GitHub link can be opened'); return shell.openExternal(url.toString()); });
ipcMain.handle('map:search', async (_event, query) => {
  const value = String(query || '').trim().slice(0, 300); if (!value) return [];
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(value)}`, { headers: { 'User-Agent': `Pigeon/${app.getVersion()} local visual portfolio`, 'Accept-Language': 'en' } });
  if (!response.ok) throw new Error('Address search is unavailable');
  return (await response.json()).map((item) => ({ lat: Number(item.lat), lon: Number(item.lon), label: String(item.display_name || '').slice(0, 500), type: item.type || '' })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
});
ipcMain.handle('map:suggest', async (_event, query) => {
  const value = String(query || '').trim().slice(0, 300); if (value.length < 3) return [];
  const response = await fetch(`https://photon.komoot.io/api/?limit=7&lang=en&q=${encodeURIComponent(value)}`, { headers: { 'User-Agent': `Pigeon/${app.getVersion()} local visual portfolio` } });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.features || []).map((feature) => {
    const properties = feature.properties || {}, coordinates = feature.geometry?.coordinates || [];
    const label = [properties.name || [properties.housenumber, properties.street].filter(Boolean).join(' '), properties.city || properties.county, properties.state, properties.country].filter(Boolean).filter((part, index, all) => all.indexOf(part) === index).join(', ');
    return { lat: Number(coordinates[1]), lon: Number(coordinates[0]), label: String(label).slice(0, 500), type: properties.type || '' };
  }).filter((item) => item.label && Number.isFinite(item.lat) && Number.isFinite(item.lon));
});
ipcMain.handle('portfolio:create', async (_event, name) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Portfolio name is required');
  if (portfolios.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) throw new Error('A portfolio with that name already exists');
  const id = crypto.randomUUID();
  const database = portfolioDatabasePath(id);
  await fsp.mkdir(path.dirname(database), { recursive: true });
  const worker = new Worker(path.join(__dirname, 'database-worker.js'), { workerData: { databaseFile: database } }); trackWorker(worker, 'portfolio-create');
  await new Promise((resolve, reject) => { worker.once('online', resolve); worker.once('error', reject); }); worker.postMessage({ id: 1, action: 'save', library: libraryCore.migrateLibrary({ loading: false }) }); await new Promise((resolve) => worker.once('message', resolve)); await worker.terminate();
  portfolios.push({ id, name: trimmed, database, legacyFile: null,managed:true }); await savePortfolioRegistry();
  return { id, name: trimmed };
});
ipcMain.handle('portfolio:add-existing',async()=>{const result=await dialog.showOpenDialog(mainWindow,{properties:['openFile'],title:'Add Existing Pigeon Portfolio',filters:[{name:'Pigeon portfolio database',extensions:['db']}]});if(result.canceled||!result.filePaths[0])return null;const database=path.resolve(result.filePaths[0]);if(!(await isPortfolioDatabase(database)))throw new Error('The selected file is not a valid SQLite portfolio database');if(portfolios.some((item)=>normalizedPortfolioDatabase(item.database||portfolioDatabasePath(item.id))===normalizedPortfolioDatabase(database)))throw new Error('That portfolio is already added');const base=path.basename(database,path.extname(database)).replace(/[-_]+/g,' ').trim()||'Existing Portfolio',name=String(await dialog.showMessageBox(mainWindow,{type:'question',title:'Add Existing Portfolio',message:`Add “${base}”?`,detail:database,buttons:['Add Portfolio','Cancel'],defaultId:0,cancelId:1}).then((choice)=>choice.response===0?base:''));if(!name)return null;let unique=name,suffix=2;while(portfolios.some((item)=>item.name.toLowerCase()===unique.toLowerCase()))unique=`${name} ${suffix++}`;const fileId=path.basename(database,'.db'),id=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(fileId)&&!portfolios.some((item)=>item.id===fileId)?fileId:crypto.randomUUID(),portfolio={id,name:unique,database,legacyFile:null,managed:false};portfolios.push(portfolio);await savePortfolioRegistry();broadcast();return{id,name:unique};});
ipcMain.handle('portfolio:rename', async (_event, { id, name }) => {
  const portfolio = portfolios.find((item) => item.id === id);
  const trimmed = String(name || '').trim();
  if (!portfolio || !trimmed) throw new Error('Portfolio and name are required');
  if (portfolios.some((item) => item.id !== id && item.name.toLowerCase() === trimmed.toLowerCase())) throw new Error('A portfolio with that name already exists');
  portfolio.name = trimmed; await savePortfolioRegistry(); broadcast(); return { id, name: trimmed };
});
ipcMain.handle('portfolio:switch', async (_event, id) => {
  const portfolio = portfolios.find((item) => item.id === id);
  if (!portfolio) throw new Error('Portfolio does not exist');
  if (id === activePortfolioId) return publicLibrarySummary();
  await cancelPortfolioBackground(`Paused while viewing ${portfolio.name}`);
  await saveLibraryNow();
  if (databaseWorker) { await databaseWorker.terminate(); databaseWorker = null; }
  for (const watcher of watchers.values()) watcher.close(); watchers.clear(); for (const timer of watcherRefreshTimers.values()) clearTimeout(timer); watcherRefreshTimers.clear(); unlockedCollections.clear(); unlockedFolders.clear();
  activePortfolioId = id; databaseFile = portfolio.database || portfolioDatabasePath(id); legacyJsonFile = portfolio.legacyFile || null; library = libraryCore.migrateLibrary({ loading: true });
  await savePortfolioRegistry(); broadcast(); await loadLibraryInWorker(); broadcast(); resumePendingScans();
  refreshSourcesInBackground().then(() => { schedulePortfolioBackground(warmThumbnailCache, 500); schedulePortfolioBackground(warmContentHashes, 300); }).catch((error) => recordDiagnostic('error', 'Portfolio background resume failed', error));
  return publicLibrarySummary();
});
ipcMain.handle('portfolio:transfer', async (_event, { type, id, subfolder = '', destinationId, move = false }) => {
  const destination = portfolios.find((item) => item.id === destinationId); if (!destination || destination.id === activePortfolioId) throw new Error('Choose another portfolio');
  await saveLibraryNow(); const store = createLibraryStore(destination.database || portfolioDatabasePath(destination.id)), target = store.load() || libraryCore.migrateLibrary({});
  let assetIds = new Set(), transferAssets = [], transferredName = '';
  if (type === 'collection') {
    const root = library.collections.find((item) => item.id === id); if (!root) throw new Error('Collection does not exist'); transferredName = root.name;
    const collectionIds = collectionDescendants(id), copies = library.collections.filter((item) => collectionIds.has(item.id)).map((item) => ({ ...item, parentId: item.id === id ? null : item.parentId, lock: null }));
    for (const item of copies) { const existing = target.collections.find((entry) => entry.id === item.id); if (existing) Object.assign(existing, item); else target.collections.push(item); }
    transferAssets = library.assets.filter((asset) => (asset.collectionIds || []).some((collectionId) => collectionIds.has(collectionId))).map((asset) => JSON.parse(JSON.stringify(asset))); assetIds = new Set(transferAssets.map((asset) => asset.id));
    if (move) libraryCore.removeCollection(library, id);
  } else if (type === 'folder') {
    const location = library.locations.find((item) => item.id === id); if (!location) throw new Error('Indexed folder does not exist'); const folder = normalizedSubfolder(subfolder), prefix = folder ? `${folder.toLowerCase()}/` : '';
    transferredName = folder ? folder.split('/').pop() : location.name; transferAssets = library.assets.filter((asset) => { if (asset.locationId !== id) return false; if (!folder) return true; const relative = normalizedSubfolder(path.relative(location.path, asset.path)).toLowerCase(); return relative.startsWith(prefix); }).map((asset) => JSON.parse(JSON.stringify(asset))); assetIds = new Set(transferAssets.map((asset) => asset.id));
    if (!target.locations.some((item) => item.id === location.id)) target.locations.push({ ...location, scanning: false, checking: false, transferredFrom: activePortfolioId });
    if (move) { if (!folder) library.locations = library.locations.filter((item) => item.id !== id); else { library.settings.excludedFolders = [...new Set([...(library.settings.excludedFolders || []), `${id}:${folder.toLowerCase()}`])]; } }
  } else throw new Error('Unsupported transfer type');
  for (const copy of transferAssets) { const existing = target.assets.find((item) => item.id === copy.id); if (existing) Object.assign(existing, copy); else target.assets.push(copy); }
  store.save(target); store.close(); if (move) await saveLibraryNow(); broadcast(); return { name: transferredName, assets: assetIds.size, moved: Boolean(move), destination: destination.name };
});
ipcMain.handle('portfolio:remove', async (_event, id) => {
  if (portfolios.length <= 1) throw new Error('At least one portfolio is required');
  if (id === activePortfolioId) throw new Error('Switch to another portfolio before deleting this one');
  const portfolio = portfolios.find((item) => item.id === id);
  if (!portfolio) return false;
  portfolios = portfolios.filter((item) => item.id !== id); await savePortfolioRegistry(); if(portfolio.managed!==false)await Promise.all([fsp.rm(portfolio.database || portfolioDatabasePath(id), { force: true }), fsp.rm(`${portfolio.database || portfolioDatabasePath(id)}-wal`, { force: true }), fsp.rm(`${portfolio.database || portfolioDatabasePath(id)}-shm`, { force: true })]); broadcast(); return true;
});
ipcMain.handle('library:get', () => publicLibrarySummary());
ipcMain.handle('library:add-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'multiSelections'], title: 'Index folders in Pigeon' });
  return result.canceled ? publicLibrarySummary() : addLocations(result.filePaths, 'folder');
});
ipcMain.handle('library:add-default-pictures', async () => {
  const picturesPath = app.getPath('pictures');
  await fsp.mkdir(picturesPath, { recursive: true });
  return addLocations([picturesPath], 'folder');
});
ipcMain.handle('library:add-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'multiSelections'], title: 'Index files in Pigeon' });
  return result.canceled ? publicLibrarySummary() : addLocations(result.filePaths, 'file');
});
ipcMain.handle('library:import-dropped-files', (_event, payload) => Array.isArray(payload) ? importDroppedFiles(payload) : importDroppedFiles(payload?.paths, payload?.target));
ipcMain.handle('library:remove-location', async (_event, id) => {
  watchers.get(id)?.close();
  watchers.delete(id); clearTimeout(watcherRefreshTimers.get(id)); watcherRefreshTimers.delete(id);
  library.locations = library.locations.filter((location) => location.id !== id);
  library.assets = library.assets.filter((asset) => asset.locationId !== id);
  scheduleSave();
  broadcast();
  return publicLibrarySummary();
});
ipcMain.handle('library:rescan', async (_event, id) => {
  if (id) await scanLocation(id);
  else for (const location of library.locations) await scanLocation(location.id, { notify: false });
  broadcast();
  return publicLibrarySummary();
});
ipcMain.handle('library:refresh-sources', () => refreshSourcesInBackground({ rescan: true }));
ipcMain.handle('collection:create', (_event, { name, parentId }) => {
  const collection = libraryCore.createCollection(library, name, parentId);
  scheduleSave(); broadcastSidebar(); return collection;
});
ipcMain.handle('group:duplicate-structure',async(_event,{type,id,subfolder=''})=>{
  const uniqueName=(items,parentId,name)=>{let candidate=`${name} copy`,number=2;while(items.some((item)=>item.parentId===parentId&&item.name.toLowerCase()===candidate.toLowerCase()))candidate=`${name} copy ${number++}`;return candidate;};
  if(type==='collection'){const root=library.collections.find((item)=>item.id===id);if(!root)throw new Error('Collection does not exist');const clone=(source,parentId,isRoot=false)=>{const copy=libraryCore.createCollection(library,isRoot?uniqueName(library.collections,parentId,source.name):source.name,parentId);copy.icon=source.icon||null;for(const child of library.collections.filter((item)=>item.parentId===source.id&&item.id!==copy.id))clone(child,copy.id);return copy;};const copy=clone(root,root.parentId,true);scheduleSave();broadcastSidebar();return{name:copy.name,type};}
  if(type==='smart-folder'){const root=library.smartFolders.find((item)=>item.id===id);if(!root)throw new Error('Smart Folder does not exist');const clone=(source,parentId,isRoot=false)=>{const copy=libraryCore.createSmartFolder(library,isRoot?uniqueName(library.smartFolders,parentId,source.name):source.name,JSON.parse(JSON.stringify(source.filters||{})),parentId);copy.icon=source.icon||null;for(const child of library.smartFolders.filter((item)=>item.parentId===source.id&&item.id!==copy.id))clone(child,copy.id);return copy;};const copy=clone(root,root.parentId,true);scheduleSave();broadcastSidebar();return{name:copy.name,type};}
  if(type==='folder'){const location=library.locations.find((item)=>item.id===id);if(!location)throw new Error('Indexed folder does not exist');const normalized=normalizedSubfolder(subfolder),source=path.join(location.path,normalized),parent=path.dirname(source),base=path.basename(source);let target=path.join(parent,`${base} copy`),number=2;while(await pathAvailable(target))target=path.join(parent,`${base} copy ${number++}`);await fsp.mkdir(target,{recursive:true});const copied=[];const copyDirectories=async(from,to)=>{for(const entry of await fsp.readdir(from,{withFileTypes:true})){if(!entry.isDirectory())continue;const next=path.join(to,entry.name);await fsp.mkdir(next,{recursive:true});copied.push(next);await copyDirectories(path.join(from,entry.name),next);}};await copyDirectories(source,target);if(normalized){library.settings=library.settings||{};library.settings.emptyFolders=library.settings.emptyFolders||{};library.settings.emptyFolders[id]=[...new Set([...(library.settings.emptyFolders[id]||[]),target,...copied])];scheduleSave();broadcastSidebar();}else await addLocations([target],'folder');return{name:path.basename(target),type};}
  throw new Error('Unsupported item type');
});
ipcMain.handle('collection:rename', (_event, { id, name }) => {
  const collection = libraryCore.renameCollection(library, id, name);
  scheduleSave(); broadcastSidebar(); return collection;
});
ipcMain.handle('collection:move', (_event, { id, parentId }) => {
  const collection = libraryCore.moveCollection(library, id, parentId), movedIds = collectionDescendants(id);
  for (const asset of library.assets) if ((asset.collectionIds || []).some((collectionId) => movedIds.has(collectionId))) asset.tags = [...new Set([...(asset.tags || []), ...configuredCollectionTags(asset.collectionIds)])];
  scheduleSave(); broadcastSidebar(); return collection;
});
ipcMain.handle('collection:set-password', async (_event, { id, password, encrypt }) => {
  const collection = library.collections.find((item) => item.id === id);
  if (!collection) throw new Error('Folder does not exist');
  if (String(password).length < 4) throw new Error('Password must contain at least four characters');
  const salt = crypto.randomBytes(16).toString('hex');
  const key = passwordKey(password, salt);
  collection.lock = { salt, digest: passwordDigest(key), encrypted: Boolean(encrypt), createdAt: Date.now() };
  unlockedCollections.delete(id);
  if (encrypt) await encryptCollectionCopies(collection, key);
  else for (const asset of library.assets) { if (asset.encryptedMediaPaths) delete asset.encryptedMediaPaths[id]; if (asset.encryptedThumbnailPaths) delete asset.encryptedThumbnailPaths[id]; }
  scheduleSave(); broadcast(); return true;
});
ipcMain.handle('collection:unlock', (_event, { id, password }) => {
  const collection = library.collections.find((item) => item.id === id);
  if (!collection?.lock) return true;
  const key = passwordKey(password, collection.lock.salt);
  const expected = Buffer.from(collection.lock.digest, 'hex');
  const actual = Buffer.from(passwordDigest(key), 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return false;
  unlockedCollections.set(id, key); broadcast(); return true;
});
ipcMain.handle('collection:lock-now', (_event, id) => { unlockedCollections.delete(id); broadcast(); return true; });
ipcMain.handle('collection:remove-password', (_event, { id, password }) => {
  const collection = library.collections.find((item) => item.id === id);
  if (!collection?.lock) return true;
  const key = passwordKey(password, collection.lock.salt);
  if (passwordDigest(key) !== collection.lock.digest) return false;
  collection.lock = null; unlockedCollections.delete(id);
  for (const asset of library.assets) { if (asset.encryptedMediaPaths) delete asset.encryptedMediaPaths[id]; if (asset.encryptedThumbnailPaths) delete asset.encryptedThumbnailPaths[id]; }
  scheduleSave(); broadcast(); return true;
});
ipcMain.handle('folder:set-password',(_event,{locationId,subfolder='',password})=>{if(!library.locations.some((item)=>item.id===locationId))throw new Error('Folder does not exist');if(String(password).length<4)throw new Error('Password must contain at least four characters');const folder=normalizedSubfolder(subfolder).toLowerCase(),salt=crypto.randomBytes(16).toString('hex'),key=passwordKey(password,salt),rule={locationId,subfolder:folder,salt,digest:passwordDigest(key),createdAt:Date.now()};library.settings=library.settings||{};library.settings.folderLocks=library.settings.folderLocks||{};library.settings.folderLocks[folderLockKey(locationId,folder)]=rule;unlockedFolders.delete(folderLockKey(locationId,folder));scheduleSave();broadcast();return true;});
ipcMain.handle('folder:unlock',(_event,{locationId,subfolder='',password})=>{const keyName=folderLockKey(locationId,subfolder),rule=library.settings?.folderLocks?.[keyName];if(!rule)return true;const key=passwordKey(password,rule.salt),expected=Buffer.from(rule.digest,'hex'),actual=Buffer.from(passwordDigest(key),'hex');if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))return false;unlockedFolders.set(keyName,key);broadcast();return true;});
ipcMain.handle('folder:lock-now',(_event,{locationId,subfolder=''})=>{unlockedFolders.delete(folderLockKey(locationId,subfolder));broadcast();return true;});
ipcMain.handle('folder:remove-password',(_event,{locationId,subfolder='',password})=>{const keyName=folderLockKey(locationId,subfolder),rule=library.settings?.folderLocks?.[keyName];if(!rule)return true;const key=passwordKey(password,rule.salt);if(passwordDigest(key)!==rule.digest)return false;delete library.settings.folderLocks[keyName];unlockedFolders.delete(keyName);scheduleSave();broadcast();return true;});
ipcMain.handle('collection:remove', (_event, id) => {
  const descendants = collectionDescendants(id), removed = libraryCore.removeCollection(library, id);
  if (library.settings?.collectionAutoTags) for (const collectionId of descendants) delete library.settings.collectionAutoTags[collectionId];
  scheduleSave(); broadcast(); return removed;
});
ipcMain.handle('smart-folder:create', (_event, { name, filters, parentId }) => {
  const smartFolder = libraryCore.createSmartFolder(library, name, filters, parentId);
  scheduleSave(); broadcastSidebar(); return smartFolder;
});
ipcMain.handle('smart-folder:rename', (_event, { id, name }) => {
  const smartFolder = libraryCore.renameSmartFolder(library, id, name); scheduleSave(); broadcastSidebar(); return smartFolder;
});
ipcMain.handle('smart-folder:update',(_event,{id,name,filters})=>{const folder=libraryCore.renameSmartFolder(library,id,name);folder.filters=filters||{};folder.updatedAt=Date.now();scheduleSave();broadcastSidebar();return folder;});
ipcMain.handle('smart-folder:move', (_event, { id, parentId }) => {
  const smartFolder = libraryCore.moveSmartFolder(library, id, parentId); scheduleSave(); broadcastSidebar(); return smartFolder;
});
ipcMain.handle('smart-folder:remove', (_event, id) => {
  const removed = libraryCore.removeSmartFolder(library, id); scheduleSave(); broadcast(); return removed;
});
const SIDEBAR_SORTS=new Set(['manual','name-asc','name-desc','updated-asc','updated-desc','created-asc','created-desc']);
ipcMain.handle('sidebar:set-sort',(_event,{type,sort})=>{if(!['collections','smartFolders'].includes(type)||!SIDEBAR_SORTS.has(sort))throw new Error('Invalid sidebar sort');library.settings.sidebarSort={...(library.settings.sidebarSort||{}),[type]:sort};scheduleSave();broadcastSidebar();return sort;});
ipcMain.handle('sidebar:set-branch-sort',(_event,{type,branch,sort})=>{if(!['collections','smartFolders','folders'].includes(type)||!SIDEBAR_SORTS.has(sort))throw new Error('Invalid branch sort');const key=`${type}:${String(branch??'root')}`;library.settings.sidebarBranchSort={...(library.settings.sidebarBranchSort||{}),[key]:sort};scheduleSave();broadcastSidebar();return sort;});
ipcMain.on('hover-control:monitor',(_event,enabled)=>{if(enabled)startHoverControlMonitor();else stopHoverControlMonitor();});
ipcMain.handle('sidebar:reorder-items',(_event,{type,parentId=null,orderedIds=[]})=>{const items=type==='collections'?library.collections:type==='smartFolders'?library.smartFolders:null;if(!items)throw new Error('Invalid sidebar type');const siblings=items.filter((item)=>item.parentId===parentId),valid=new Set(siblings.map((item)=>item.id));if(orderedIds.length!==siblings.length||orderedIds.some((id)=>!valid.has(id)))throw new Error('Invalid sidebar order');orderedIds.forEach((id,index)=>{const item=items.find((entry)=>entry.id===id);item.order=index;item.updatedAt=Date.now();});library.settings.sidebarSort={...(library.settings.sidebarSort||{}),[type]:'manual'};scheduleSave();broadcastSidebar();return true;});
ipcMain.handle('item:set-icon', (_event, { type, id, icon }) => {
  const value = icon && /^[a-z0-9-]{1,32}$/.test(icon) ? icon : null;
  if (type === 'collection') { const item = library.collections.find((entry) => entry.id === id); if (item) item.icon = value; }
  else if (type === 'smart-folder') { const item = library.smartFolders.find((entry) => entry.id === id); if (item) item.icon = value; }
  else if (type === 'location') { const item = library.locations.find((entry) => entry.id === id); if (item) item.icon = value; }
  else if (type === 'subfolder') { library.settings = library.settings || {}; library.settings.itemIcons = library.settings.itemIcons || {}; if (value) library.settings.itemIcons[id] = value; else delete library.settings.itemIcons[id]; }
  else return false;
  scheduleSave(); broadcast(); return true;
});
ipcMain.handle('collection:set-auto-tags', (_event, { collectionId, tags = [] }) => {
  const collection = library.collections.find((item) => item.id === collectionId); if (!collection) throw new Error('Collection does not exist');
  library.settings = library.settings || {}; library.settings.collectionAutoTags = library.settings.collectionAutoTags || {};
  const normalizedTags = canonicalTags(tags); if (normalizedTags.length) library.settings.collectionAutoTags[collectionId] = { collectionId, tags: normalizedTags, updatedAt: Date.now() }; else delete library.settings.collectionAutoTags[collectionId];
  const descendants = collectionDescendants(collectionId); let updated = 0;
  if (normalizedTags.length) for (const asset of library.assets) if ((asset.collectionIds || []).some((id) => descendants.has(id))) { asset.tags = [...new Set([...(asset.tags || []), ...normalizedTags])]; updated += 1; }
  const assets=normalizedTags.length?library.assets.filter((asset)=>(asset.collectionIds||[]).some((id)=>descendants.has(id))).map(({encryptedMediaPaths,encryptedThumbnailPaths,...asset})=>asset):[];scheduleSave();broadcastSidebar(); return { collectionId, tags: normalizedTags, updated, assets };
});
ipcMain.handle('folder:set-auto-tags', (_event, { locationId, subfolder = '', tags = [] }) => {
  const location = library.locations.find((item) => item.id === locationId); if (!location || location.type !== 'folder') throw new Error('Indexed folder does not exist');
  const folder = normalizedSubfolder(subfolder); if (folder === '..' || folder.startsWith('../')) throw new Error('Invalid subfolder');
  library.settings = library.settings || {}; library.settings.folderAutoTags = library.settings.folderAutoTags || {};
  const key = folderRuleKey(locationId, folder), normalizedTags = canonicalTags(tags);
  if (normalizedTags.length) library.settings.folderAutoTags[key] = { locationId, subfolder: folder, tags: normalizedTags, updatedAt: Date.now() };
  else delete library.settings.folderAutoTags[key];
  let updated = 0;
  if (normalizedTags.length) for (const asset of library.assets) if (assetMatchesFolder(asset, location, folder)) { asset.tags = [...new Set([...(asset.tags || []), ...normalizedTags])]; updated += 1; }
  const assets=normalizedTags.length?library.assets.filter((asset)=>assetMatchesFolder(asset,location,folder)).map(({encryptedMediaPaths,encryptedThumbnailPaths,...asset})=>asset):[];scheduleSave();broadcastSidebar(); return { locationId, subfolder: folder, tags: normalizedTags, updated, assets };
});
ipcMain.handle('assets:batch-update', (_event, { ids, operation, options = {} }) => {
  const count = libraryCore.batchUpdateAssets(library, ids, operation);
  if (operation.collectionId) for (const asset of library.assets) if (ids.includes(asset.id)) applyConfiguredCollectionTags(asset);
  scheduleSave(); if (!options.silent) broadcast(); if(options.returnAssets)return{count,assets:library.assets.filter((asset)=>ids.includes(asset.id)).map(({encryptedMediaPaths,encryptedThumbnailPaths,...asset})=>asset)}; return count;
});
ipcMain.handle('assets:stack', (_event, ids) => {
  const result = libraryCore.stackAssets(library, ids);
  scheduleSave(); broadcast(); return result;
});
ipcMain.handle('assets:unstack', (_event, ids) => {
  const count = libraryCore.unstackAssets(library, ids);
  scheduleSave(); broadcast(); return count;
});
ipcMain.handle('assets:duplicates', () => libraryCore.exactDuplicateGroups(library.assets).map((group) => group.map((asset) => asset.id)));
ipcMain.handle('assets:similar', (_event, id) => {
  const asset = library.assets.find((item) => item.id === id);
  return asset ? libraryCore.similarAssets(library.assets, asset).map((item) => item.id) : [];
});
ipcMain.handle('assets:similar-groups', (_event, { accuracy = 78, sourceId = null } = {}) => new Promise((resolve) => {
  if(activeSimilarityJob){activeSimilarityJob.resolve([]);activeSimilarityJob.worker.terminate().catch(()=>{});activeSimilarityJob=null;}
  const images=library.assets.filter((asset)=>asset.kind==='image'&&!asset.deletedAt&&!isAssetLocked(asset)).map(({id,kind,contentHash,perceptualHash,dominantColor,width,height})=>({id,kind,contentHash,perceptualHash,dominantColor,width,height})),worker=new Worker(path.join(__dirname,'similarity-worker.js'),{workerData:{assets:images,accuracy:Math.max(35,Math.min(100,Number(accuracy)||78)),sourceId},resourceLimits:{maxOldGenerationSizeMb:192}}),telemetry=trackWorker(worker,'similarity',{filesTotal:images.length});let settled=false;
  const finish=(groups=[])=>{if(settled)return;settled=true;telemetry.filesCompleted=images.length;telemetry.status='completed';if(activeSimilarityJob?.worker===worker)activeSimilarityJob=null;resolve(groups);worker.terminate().catch(()=>{});};activeSimilarityJob={worker,resolve:finish};worker.once('message',(message)=>finish(message.groups||[]));worker.once('error',(error)=>{recordDiagnostic('error','Similarity worker failed',error);finish([]);});worker.once('exit',()=>finish([]));
}));
ipcMain.handle('assets:set-order',(_event,{scope,order})=>{if(!/^(collection|smart|location|view):/.test(String(scope))||!['modified','indexedAt','name','size','rating'].includes(order?.field)||!['asc','desc'].includes(order?.direction))throw new Error('Invalid item order');library.settings.assetOrders={...(library.settings.assetOrders||{}),[scope]:{field:order.field,direction:order.direction}};scheduleSave();return library.settings.assetOrders[scope];});
ipcMain.handle('assets:auto-tag', (_event, ids) => {
  let count = 0;
  for (const asset of library.assets) if (ids.includes(asset.id)) { asset.tags = [...new Set([...(asset.tags || []), ...libraryCore.suggestTags(asset)])]; count += 1; }
  scheduleSave(); broadcast(); return count;
});
ipcMain.handle('tags:rename', (_event, { from, to }) => {
  const replacement = libraryCore.renameTag(library, from, to);
  scheduleSave(); broadcast(); return replacement;
});
ipcMain.handle('tags:delete', (_event, tag) => {
  const target = String(tag || '').toLowerCase();
  for (const asset of library.assets) asset.tags = (asset.tags || []).filter((item) => item.toLowerCase() !== target);
  scheduleSave(); broadcast();
});
ipcMain.handle('trash:empty', async (_event, request = {}) => {
  const requestedMode=typeof request==='string'?request:request.mode,selectedIds=Array.isArray(request.ids)?new Set(request.ids):null,mode=requestedMode === 'recycle' ? 'recycle' : 'permanent', trashed = library.assets.filter((asset) => asset.deletedAt&&(!selectedIds||selectedIds.has(asset.id))), removed = new Set(), failures = [],progressId=`${activePortfolioId}:trash-empty:${Date.now()}`,total=trashed.length;
  reportBackgroundProgress(progressId,{label:mode==='recycle'?'Moving Trash to Recycle Bin':'Clearing Trash',detail:`0 of ${total.toLocaleString()} files`,completed:0,total});
  for (let index=0;index<trashed.length;index+=1) {const asset=trashed[index];
    try { if (await pathAvailable(asset.path)) { if (mode === 'recycle') await shell.trashItem(asset.path); else await fsp.rm(asset.path, { force: true }); } removed.add(asset.id); }
    catch (error) { failures.push({ id: asset.id, filename: asset.filename, error: error.message }); recordDiagnostic('error', 'Trash source deletion failed', { assetId: asset.id, path: asset.path, mode, error: error.message }); }
    reportBackgroundProgress(progressId,{label:mode==='recycle'?'Moving Trash to Recycle Bin':'Clearing Trash',detail:`${(index+1).toLocaleString()} of ${total.toLocaleString()} files${failures.length?` · ${failures.length} failed`:''}`,completed:index+1,total});
    if(index%5===4)await new Promise((resolve)=>setImmediate(resolve));
  }
  library.assets = library.assets.filter((asset) => !removed.has(asset.id)); scheduleSave(); broadcast();reportBackgroundProgress(progressId,{label:failures.length?'Trash cleared with issues':'Trash cleared',detail:`${removed.size.toLocaleString()} files removed${failures.length?` · ${failures.length} failed`:''}`,completed:total,total,done:true,status:failures.length?'warning':'completed'}); return { deleted: removed.size, deletedIds: [...removed], failed: failures.length, failures };
});
ipcMain.handle('library:import-url', async (_event, url) => importUrl(url));
ipcMain.handle('clipboard:write-text', (_event, value) => { clipboard.writeText(String(value || '').slice(0, 32768)); return true; });
ipcMain.handle('clipboard:copy-assets',async(_event,ids=[])=>{const paths=[...new Set(ids.map((id)=>library.assets.find((asset)=>asset.id===id)).filter((asset)=>asset&&!asset.sourceMissing).map((asset)=>asset.path))];if(!paths.length)return{copied:0};if(process.platform==='win32'){const encoded=Buffer.from(JSON.stringify(paths),'utf8').toString('base64'),script=`Add-Type -AssemblyName System.Windows.Forms; $paths=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))|ConvertFrom-Json; $files=New-Object System.Collections.Specialized.StringCollection; foreach($p in $paths){[void]$files.Add([string]$p)}; [Windows.Forms.Clipboard]::SetFileDropList($files)`;await withTimeout(new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-STA','-NonInteractive','-Command',script],{windowsHide:true},(error)=>error?reject(error):resolve())),8000,'Clipboard copy timed out');}else{clipboard.writeText(paths.join('\n'));}return{copied:paths.length};});
ipcMain.handle('clipboard:paste-assets',async()=>{let paths=[];if(process.platform==='win32'){const script="Add-Type -AssemblyName System.Windows.Forms; if([Windows.Forms.Clipboard]::ContainsFileDropList()){[Windows.Forms.Clipboard]::GetFileDropList()|ConvertTo-Json -Compress}";const output=await execFileText('powershell.exe',['-NoProfile','-STA','-NonInteractive','-Command',script],8000);if(output)try{const parsed=JSON.parse(output);paths=Array.isArray(parsed)?parsed:[parsed];}catch{}}if(paths.length)return importDroppedFiles(paths);const image=clipboard.readImage();if(!image.isEmpty()){const temporary=path.join(app.getPath('temp'),`pigeon-clipboard-${Date.now()}.png`);await fsp.writeFile(temporary,image.toPNG());try{return await importDroppedFiles([temporary]);}finally{await fsp.rm(temporary,{force:true});}}return{imported:0,path:null};});
ipcMain.handle('library:import-clipboard', async () => {
  const text = clipboard.readText().trim();
  if (!/^https?:\/\//i.test(text)) throw new Error('Clipboard does not contain an HTTP URL');
  return importUrl(text);
});
ipcMain.handle('library:capture-screen', async () => captureScreenshot());
ipcMain.handle('library:backup', async () => writeBackup('manual'));
ipcMain.handle('library:restore-backup', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Restore Pigeon backup', properties: ['openFile'], filters: [{ name: 'Pigeon library', extensions: ['db','json'] }] });
  if (result.canceled) return null;
  await writeBackup('pre-restore'); const source=result.filePaths[0];
  if(path.extname(source).toLowerCase()==='.json'){library=libraryCore.migrateLibrary(JSON.parse(await fsp.readFile(source,'utf8')));await persistLibrary(library);}
  else{await cancelPortfolioBackground('Restoring backup');databaseWorker?.terminate();databaseWorker=null;await fsp.copyFile(source,databaseFile);await loadLibraryInWorker();startDatabaseWorker();}
  broadcast(); return publicLibrarySummary();
});
ipcMain.handle('library:configure-sync', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Choose local sync folder', properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled) return null;
  library.settings.syncFolder = result.filePaths[0]; scheduleSave(); return library.settings.syncFolder;
});
ipcMain.handle('library:sync-now', async () => {
  const folder = library.settings.syncFolder;
  if (!folder) throw new Error('Choose a sync folder first');
  await fsp.mkdir(folder, { recursive: true });
  const target = path.join(folder, 'pigeon-library.json');
  let remote = null;
  try { remote = libraryCore.migrateLibrary(JSON.parse(await fsp.readFile(target, 'utf8'))); } catch {}
  if (remote) {
    const localById = new Map(library.assets.map((asset) => [asset.id, asset]));
    for (const asset of remote.assets) {
      const local = localById.get(asset.id);
      if (!local) library.assets.push(asset);
      else if ((asset.metadataUpdatedAt || 0) > (local.metadataUpdatedAt || 0)) {
        for (const key of ['tags', 'note', 'rating', 'favorite', 'collectionIds', 'annotations', 'rotation', 'geo', 'deletedAt', 'metadataUpdatedAt']) if (Object.hasOwn(asset, key)) local[key] = asset[key];
      }
    }
    for (const collection of remote.collections) if (!library.collections.some((item) => item.id === collection.id)) library.collections.push(collection);
    for (const smartFolder of remote.smartFolders) if (!library.smartFolders.some((item) => item.id === smartFolder.id)) library.smartFolders.push(smartFolder);
  }
  await fsp.writeFile(target, libraryCore.serializeLibrary(library));
  scheduleSave(); broadcast(); return target;
});
async function moveAssetFiles(ids,destination){const moved=[];await fsp.mkdir(destination,{recursive:true});for(const asset of library.assets.filter((item)=>ids.includes(item.id))){if(!(await pathAvailable(asset.path)))continue;const source=path.resolve(asset.path),target=path.join(destination,asset.filename);if(source.toLowerCase()===target.toLowerCase())continue;if(await pathAvailable(target))throw new Error(`${asset.filename} already exists in the destination`);watcherIgnoreUntil.set(asset.locationId,Date.now()+2500);try{await fsp.rename(source,target);}catch(error){if(error.code!=='EXDEV')throw error;await fsp.copyFile(source,target);try{await fsp.rm(source,{force:true});}catch(removeError){await fsp.rm(target,{force:true}).catch(()=>{});throw removeError;}}asset.path=target;const location=library.locations.find((item)=>{const relative=path.relative(item.path,target);return relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative)||path.resolve(item.path)===path.resolve(destination);});if(location)asset.locationId=location.id;asset.sourceMissing=false;asset.metadataUpdatedAt=Date.now();moved.push({...asset,previewUrl:previewUrlFor(asset),mediaUrl:mediaUrlFor(asset)});}scheduleSave();return{moved:moved.length,assets:moved};}
ipcMain.handle('assets:move-to-path',async(_event,{ids=[],folderPath=''})=>{const requested=String(folderPath||'').trim();let destination=requested;if(!destination){const result=await dialog.showOpenDialog(mainWindow,{title:'Move selected files to folder',properties:['openDirectory','createDirectory']});if(result.canceled||!result.filePaths[0])return{moved:0,assets:[]};destination=result.filePaths[0];}return moveAssetFiles(ids,path.resolve(destination));});
ipcMain.handle('assets:move-to-folder',async(_event,{ids=[],locationId,subfolder=''})=>{const location=library.locations.find((item)=>item.id===locationId);if(!location)throw new Error('Destination folder is no longer indexed');const safeSubfolder=normalizedSubfolder(subfolder);if(safeSubfolder==='..'||safeSubfolder.startsWith('../'))throw new Error('Invalid destination folder');const destination=path.join(location.path,safeSubfolder),moved=[];await fsp.mkdir(destination,{recursive:true});for(const asset of library.assets.filter((item)=>ids.includes(item.id))){if(!(await pathAvailable(asset.path)))continue;const source=path.resolve(asset.path),target=path.join(destination,asset.filename);if(source.toLowerCase()===target.toLowerCase())continue;if(await pathAvailable(target))throw new Error(`${asset.filename} already exists in the destination`);watcherIgnoreUntil.set(asset.locationId,Date.now()+2500);try{await fsp.rename(source,target);}catch(error){if(error.code!=='EXDEV')throw error;await fsp.copyFile(source,target);try{await fsp.rm(source,{force:true});}catch(removeError){await fsp.rm(target,{force:true}).catch(()=>{});throw removeError;}}asset.path=target;asset.locationId=locationId;asset.sourceMissing=false;asset.metadataUpdatedAt=Date.now();moved.push({...asset,previewUrl:previewUrlFor(asset),mediaUrl:mediaUrlFor(asset)});}scheduleSave();return{moved:moved.length,assets:moved};});
ipcMain.handle('asset:apply-inline-crop', (_event, { id, crop }) => applyInlineCrop(id, crop));
function formatRenameDate(value,format){const date=new Date(Number(value)||Date.now()),parts={YYYY:String(date.getFullYear()),YY:String(date.getFullYear()).slice(-2),MM:String(date.getMonth()+1).padStart(2,'0'),DD:String(date.getDate()).padStart(2,'0'),HH:String(date.getHours()).padStart(2,'0'),mm:String(date.getMinutes()).padStart(2,'0'),ss:String(date.getSeconds()).padStart(2,'0')};return String(format||'YYYYMMDD-HHmmss').replace(/YYYY|YY|MM|DD|HH|mm|ss/g,(token)=>parts[token]);}
function autoRenameValue(asset,pattern,index){return String(pattern||'<name>').replace(/<created-date-time(?::([^>]+))?>/g,(_m,f)=>formatRenameDate(asset.created,f)).replace(/<modified-date-time(?::([^>]+))?>/g,(_m,f)=>formatRenameDate(asset.modified,f)).replace(/<indexed-date-time(?::([^>]+))?>/g,(_m,f)=>formatRenameDate(asset.indexedAt,f)).replace(/<name>/g,asset.name).replace(/<extension>/g,String(asset.extension||'').toLowerCase()).replace(/<counter(?::(\d+))?>/g,(_m,w)=>String(index+1).padStart(Math.min(12,Number(w)||1),'0')).replace(/[<>:"|?*]/g,'-').replace(/[\\/]+/g,'-').trim().slice(0,220);}
ipcMain.handle('assets:auto-rename',async(_event,{ids=[],pattern=''})=>{const selected=library.assets.filter((item)=>ids.includes(item.id));if(!String(pattern).trim())throw new Error('Enter a filename pattern');const updates=[];for(const[index,asset]of selected.entries()){const requestedName=autoRenameValue(asset,pattern,index);if(!requestedName)throw new Error('The filename pattern produced an empty name');const extension=path.extname(asset.filename||asset.path),source=path.resolve(asset.path),target=path.join(path.dirname(source),`${requestedName}${extension}`);if(source.toLowerCase()!==target.toLowerCase()&&await pathAvailable(target))throw new Error(`${path.basename(target)} already exists`);if(source!==target){await fsp.rename(source,target);asset.path=target;asset.filename=path.basename(target);asset.name=requestedName;}asset.metadataUpdatedAt=Date.now();updates.push({...asset,previewUrl:previewUrlFor(asset),mediaUrl:mediaUrlFor(asset)});}scheduleSave();return{renamed:updates.length,assets:updates};});
ipcMain.handle('assets:rebuild-thumbnails',async(_event,ids=[])=>{const selected=library.assets.filter((asset)=>ids.includes(asset.id)&&!asset.deletedAt&&!isAssetLocked(asset)),assets=[];for(const asset of selected){if(asset.thumbnailPath)await fsp.rm(asset.thumbnailPath,{force:true}).catch(()=>{});asset.thumbnailPath=null;asset.thumbnailFailedAt=null;asset.thumbnailFailedModified=null;asset.thumbnailError=null;thumbnailPreparationJobs.delete(`${asset.id}:${asset.modified||0}`);const thumbnail=asset.kind==='video'?await prepareVideoFiles(asset):await createThumbnail(asset);if(!thumbnail?.ok)continue;asset.thumbnailPath=thumbnail.target;asset.width=thumbnail.width||asset.width;asset.height=thumbnail.height||asset.height;asset.dominantColor=thumbnail.dominantColor||asset.dominantColor;asset.histogram=thumbnail.histogram||asset.histogram;asset.palette=thumbnail.palette||asset.palette;asset.perceptualHash=thumbnail.perceptualHash||asset.perceptualHash;asset.exif=thumbnail.exif||asset.exif;asset.embeddedMetadata=thumbnail.embeddedMetadata||asset.embeddedMetadata;asset.technicalMetadata=thumbnail.technicalMetadata||asset.technicalMetadata;assets.push({...asset,previewUrl:previewUrlFor(asset),mediaUrl:mediaUrlFor(asset)});}scheduleSave();return{rebuilt:assets.length,assets};});
ipcMain.on('assets:start-drag',(event,ids=[])=>{const selected=new Set(ids),assets=library.assets.filter((asset)=>selected.has(asset.id)&&!asset.deletedAt&&!isAssetLocked(asset)&&fs.existsSync(asset.path)),files=assets.map((asset)=>asset.path);if(!files.length)return;const iconPath=assets.find((asset)=>asset.thumbnailPath&&fs.existsSync(asset.thumbnailPath))?.thumbnailPath||path.join(__dirname,'..','pigeon-logo.png');let icon=nativeImage.createFromPath(iconPath);if(icon.isEmpty())icon=nativeImage.createFromPath(path.join(__dirname,'..','pigeon-logo.png'));if(!icon.isEmpty())icon=icon.resize({width:96,height:96,quality:'good'});try{event.sender.startDrag({files,icon});}catch(error){recordDiagnostic('error','Native asset drag failed',{message:error.message,count:files.length});}});
ipcMain.handle('asset:rename-file', async (_event, { id, name }) => {
  const asset = library.assets.find((item) => item.id === id);
  if (!asset) throw new Error('The selected file is no longer indexed');
  if (asset.sourceMissing || !(await pathAvailable(asset.path))) throw new Error('The source file is not currently available');
  const requestedName = String(name || '').trim(), extension = path.extname(asset.filename || asset.path);
  if (!requestedName) throw new Error('Enter a filename');
  if (extension && requestedName.toLowerCase().endsWith(extension.toLowerCase())) throw new Error('Enter the filename without its extension');
  if (/[<>:"/\\|?*\x00-\x1f]/.test(requestedName) || /[. ]$/.test(requestedName)) throw new Error('That filename contains characters Windows does not allow');
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(requestedName)) throw new Error('That filename is reserved by Windows');
  const sourcePath = path.resolve(asset.path), targetPath = path.join(path.dirname(sourcePath), `${requestedName}${extension}`);
  if (sourcePath === targetPath) return { ...asset, previewUrl: previewUrlFor(asset), mediaUrl: mediaUrlFor(asset) };
  const caseOnlyRename = sourcePath.toLowerCase() === targetPath.toLowerCase();
  if (!caseOnlyRename && await pathAvailable(targetPath)) throw new Error('A file with that name already exists');
  watcherIgnoreUntil.set(asset.locationId, Date.now() + 2000);
  if (caseOnlyRename) {
    const temporaryPath = path.join(path.dirname(sourcePath), `.pigeon-rename-${crypto.randomUUID()}${extension}`);
    await fsp.rename(sourcePath, temporaryPath);
    try { await fsp.rename(temporaryPath, targetPath); } catch (error) { await fsp.rename(temporaryPath, sourcePath).catch(() => {}); throw error; }
  } else await fsp.rename(sourcePath, targetPath);
  for (const reference of library.assets.filter((item) => path.resolve(item.path).toLowerCase() === sourcePath.toLowerCase())) {
    reference.path = targetPath; reference.filename = path.basename(targetPath); reference.name = requestedName; reference.sourceMissing = false; delete reference.missingSince; delete reference.sourcePending; reference.metadataUpdatedAt = Date.now();
  }
  const location = library.locations.find((item) => item.id === asset.locationId);
  if (location?.type === 'file' && path.resolve(location.path).toLowerCase() === sourcePath.toLowerCase()) { location.path = targetPath; location.name = asset.filename; watchLocation(location); }
  scheduleSave();
  return { ...asset, previewUrl: previewUrlFor(asset), mediaUrl: mediaUrlFor(asset) };
});
ipcMain.handle('asset:reset-inline-edits', (_event, id) => resetInlineEdits(id));
ipcMain.handle('asset:duplicate', (_event, id) => duplicateAsset(id));
ipcMain.handle('asset:export-annotated', (_event, { id, annotations, edits }) => exportAnnotatedAsset(id, annotations, edits));
ipcMain.handle('library:export-group', (_event, { type, id }) => exportLibraryGroup(type, id));
ipcMain.handle('asset:export',async(_event,id)=>{const asset=library.assets.find((item)=>item.id===id&&!item.deletedAt);if(!asset||!(await pathAvailable(asset.path)))return null;const result=await dialog.showSaveDialog(mainWindow,{title:'Export file',defaultPath:asset.filename});if(result.canceled||!result.filePath)return null;await fsp.copyFile(asset.path,result.filePath);return result.filePath;});
ipcMain.handle('asset:read-text',async(_event,id)=>{const asset=library.assets.find((item)=>item.id===id&&!item.deletedAt),allowed=new Set(['TXT','JSON','YAML','YML']);if(!asset||!allowed.has(String(asset.extension).toUpperCase())||!(await pathAvailable(asset.path)))return null;const stat=await fsp.stat(asset.path);if(stat.size>8*1024*1024)throw new Error('Text reader supports files up to 8 MB');return{content:await fsp.readFile(asset.path,'utf8'),extension:String(asset.extension).toLowerCase(),filename:asset.filename};});
ipcMain.handle('contact-sheet:export',async(event,payload)=>{const format=typeof payload==='string'?payload:payload?.format,extension=['pdf','jpeg','png','webp'].includes(String(format).toLowerCase())?String(format).toLowerCase():'pdf',result=await dialog.showSaveDialog(mainWindow,{title:'Export contact sheet',defaultPath:`contact-sheet.${extension}`,filters:[{name:extension.toUpperCase(),extensions:[extension]}]});if(result.canceled||!result.filePath)return null;if(extension==='pdf'){const pdf=await event.sender.printToPDF({printBackground:true,pageSize:'A4'});await fsp.writeFile(result.filePath,pdf);}else{const rect=payload?.rect&&Number.isFinite(payload.rect.width)?payload.rect:undefined,image=await event.sender.capturePage(rect),png=image.toPNG();if(extension==='png')await fsp.writeFile(result.filePath,png);else await sharp(png)[extension==='jpeg'?'jpeg':'webp']({quality:92}).toFile(result.filePath);}return result.filePath;});
ipcMain.handle('extension:open-folder', () => shell.openPath(app.isPackaged ? path.join(process.resourcesPath, 'browser-extension') : path.join(process.cwd(), 'browser-extension')));
ipcMain.handle('plugins:list', async () => {
  await fsp.mkdir(pluginsDir, { recursive: true });
  return (await fsp.readdir(pluginsDir)).filter((name) => name.endsWith('.js'));
});
ipcMain.handle('plugins:open-folder', async () => { await fsp.mkdir(pluginsDir, { recursive: true }); shell.openPath(pluginsDir); });
ipcMain.handle('plugins:run', (_event, name) => runPlugin(name));
ipcMain.handle('asset:update', (_event, { id, patch }) => {
  const asset = library.assets.find((item) => item.id === id);
  if (!asset) return null;
  const allowed = ['tags', 'note', 'rating', 'favorite', 'thumbnailEffect', 'annotations', 'collectionIds', 'rotation', 'geo'];
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(patch, key)) asset[key] = patch[key];
  if (Object.prototype.hasOwnProperty.call(patch, 'collectionIds')) applyConfiguredCollectionTags(asset);
  asset.metadataUpdatedAt = Date.now();
  scheduleSave();
  return { ...asset, previewUrl: previewUrlFor(asset), mediaUrl: mediaUrlFor(asset) };
});
ipcMain.handle('asset:reveal', (_event, id) => {
  const asset = library.assets.find((item) => item.id === id);
  if (asset) setImmediate(async () => { if (await pathAvailable(asset.path)) shell.showItemInFolder(asset.path); });
});
ipcMain.handle('asset:ensure-playable', async (_event, payload) => {
  const id = typeof payload === 'string' ? payload : payload?.id, options = typeof payload === 'object' ? payload.options || {} : {};
  const asset = library.assets.find((item) => item.id === id);
  if (!asset || asset.kind !== 'video') return asset ? mediaUrlFor(asset) : null;
  if (asset.proxyVersion !== 3 || !asset.proxyPath || !(await pathAvailable(asset.proxyPath))) {
    const prepared = await prepareVideoFiles(asset, true);
    if (prepared) {
      asset.thumbnailPath = prepared.target || asset.thumbnailPath;
      asset.proxyPath = prepared.proxyPath || asset.proxyPath;
      scheduleSave();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('thumbnail:ready', { id: asset.id, previewUrl: previewUrlFor(asset), mediaUrl: mediaUrlFor(asset) });
    }
  }
  return mediaUrlFor(asset);
});
ipcMain.handle('asset:open', async (_event, id) => {
  const asset = library.assets.find((item) => item.id === id);
  if (asset && await pathAvailable(asset.path)) return shell.openPath(asset.path);
  return 'Source is offline';
});
ipcMain.handle('asset:open-with', async (_event, id) => {
  const asset = library.assets.find((item) => item.id === id);
  if (!asset || !(await pathAvailable(asset.path))) return 'Source is offline';
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose an application',
    properties: process.platform === 'darwin' ? ['openFile', 'openDirectory'] : ['openFile'],
    filters: process.platform === 'win32' ? [{ name: 'Applications', extensions: ['exe', 'com', 'bat', 'cmd'] }, { name: 'All files', extensions: ['*'] }] : undefined
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const application = result.filePaths[0];
  if (process.platform === 'darwin' && application.endsWith('.app')) {
    const child = spawn('/usr/bin/open', ['-a', application, asset.path], { detached: true, stdio: 'ignore' }); child.unref();
  } else {
    const child = spawn(application, [asset.path], { detached: true, stdio: 'ignore', windowsHide: true }); child.unref();
  }
  return null;
});
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:toggle-maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle('window:set-zoom', (_event, value) => {
  const zoom = Math.max(0.6, Math.min(2, Number(value) || 1));
  mainWindow?.webContents.setZoomFactor(zoom);
  return zoom;
});
ipcMain.handle('window:center-display',(_event,index)=>centerWindowOnDisplay(Math.max(0,Number(index)||0)));
ipcMain.handle('preferences:update', async (_event, preferences = {}) => {
  library.settings = library.settings || {}; library.settings.preferences = { ...(library.settings.preferences || {}), ...preferences };
  await fsp.writeFile(runtimePreferencesFile, JSON.stringify({ hardwareAcceleration: preferences.hardwareAcceleration !== false }), 'utf8');
  app.setLoginItemSettings({ openAtLogin: Boolean(preferences.launchOnLogin), path: process.execPath });
  const folder = library.settings.preferences.autoImportFolder;
  if (preferences.autoImport && folder && !library.locations.some((location) => path.resolve(location.path) === path.resolve(folder))) await addLocations([folder], 'folder');
  scheduleSave(); return library.settings.preferences;
});
ipcMain.handle('preferences:auto-import-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'], title: 'Select an Auto-Import folder' }); if (result.canceled) return null;
  library.settings = library.settings || {}; library.settings.preferences = { ...(library.settings.preferences || {}), autoImportFolder: result.filePaths[0] }; scheduleSave(); return result.filePaths[0];
});
ipcMain.handle('window:toggle-always-on-top', () => {
  if (!mainWindow) return false;
  const pinned = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(pinned);
  return pinned;
});
ipcMain.handle('window:close', () => mainWindow?.close());

async function handleProtocolUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'pigeon:' && parsed.hostname === 'import' && parsed.searchParams.get('url')) await importUrl(parsed.searchParams.get('url'));
  } catch (error) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app:error', error.message);
  }
}
app.on('second-instance', (_event, argv) => {
  const value = argv.find((argument) => argument.startsWith('pigeon://'));
  if (value) handleProtocolUrl(value);
  if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
});
app.on('open-url', (event, value) => { event.preventDefault(); pendingProtocolUrls.push(value); });

app.whenReady().then(async () => {
  initializeStoragePaths();
  if (!smokeTest) await loadPortfolioRegistry();
  app.setAsDefaultProtocolClient('pigeon');
  await registerProtocol();
  await startMediaServer();
  if (smokeSeeded) {
    await fsp.mkdir(thumbnailDir, { recursive: true });
    library = libraryCore.migrateLibrary({ locations: [], assets: [], loading: false });
    const smokeFixtureDir = path.join(app.getPath('userData'), 'smoke-fixtures');
    await fsp.cp(path.join(process.cwd(), 'tests', 'fixtures'), smokeFixtureDir, { recursive: true });
    await addLocations([smokeFixtureDir], 'folder');
    const smokeCompatibilityAsset = library.assets.find((asset) => asset.filename === 'sample-hevc.mp4'); if (smokeCompatibilityAsset) { smokeCompatibilityAsset.proxyPath = path.join(smokeFixtureDir, 'sample-video.mp4'); smokeCompatibilityAsset.proxyVersion = 3; }
  } else if (smokeLarge) {
    library = libraryCore.migrateLibrary({
      loading: false,
      locations: [{ id: 'large', name: 'Large library', path: 'virtual', type: 'folder', online: false, removable: false, assetCount: 25000 }],
      assets: Array.from({ length: 6055 }, (_, index) => ({ id: `asset-${index}`, locationId: 'large', path: `virtual/${index}.dat`, name: `Reference ${index + 1}`, filename: `${index}.dat`, extension: 'DAT', kind: 'image', size: index, width: 1200, height: 900, created: Date.now(), modified: Date.now() - index, indexedAt: Date.now(), tags: [], note: '', rating: 0, favorite: false, thumbnailPath: path.join(__dirname,'..','pigeon-logo.png') }))
    });
  }
  app.on('child-process-gone',(_event,details)=>{writeFatalDiagnostic('electron:child-process-gone',details.reason,details);recordDiagnostic('error','Electron child process stopped',details);});
  createWindow();
  for (const value of pendingProtocolUrls.splice(0)) handleProtocolUrl(value);
  const startupUrl = process.argv.find((argument) => argument.startsWith('pigeon://'));
  if (startupUrl) handleProtocolUrl(startupUrl);
  if (smokeSeeded || smokeLarge) mainWindow.webContents.once('did-finish-load', broadcast);
  if (!smokeSeeded && !smokeLarge) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        await loadLibraryInWorker();
        broadcast();
        refreshSourcesInBackground().then(() => { schedulePortfolioBackground(warmThumbnailCache, 5000); schedulePortfolioBackground(warmContentHashes, 1500); }).catch((error) => recordDiagnostic('error', 'Startup background processing failed', error));
      }, 0);
    });
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  for (const watcher of watchers.values()) watcher.close();
  for (const timer of portfolioBackgroundTimers) clearTimeout(timer);
  for (const worker of thumbnailWorkers) worker.terminate();
  for (const worker of backgroundHashWorkers) worker.terminate();
  databaseWorker?.terminate(); databaseWorker = null;
  for (const child of activeFfmpegChildren) child.kill();
  mediaServer?.closeAllConnections?.(); mediaServer?.close(); mediaServer = null; mediaServerPort = 0;
});
