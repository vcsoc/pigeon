const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const { canonicalYouTubeUrl, firstYouTubeUrl } = require('../browser-extension/drop-url');

const root = path.resolve(__dirname, '..');
const extension = path.join(root, 'browser-extension');

function manifest(name = 'manifest.json') {
  return JSON.parse(fs.readFileSync(path.join(extension, name), 'utf8'));
}

test('drag capture is injected on HTTP sites and targets the Downloads collection', () => {
  const chromium = manifest();
  assert.equal(chromium.manifest_version, 3);
  assert.equal(chromium.version, '2.0.5');
  assert.equal(chromium.name, 'Pigeon for Chrome');
  assert.deepEqual(chromium.content_scripts[0].matches, ['http://*/*', 'https://*/*']);
  assert.equal(chromium.content_scripts[0].all_frames, true);
  assert.equal(chromium.content_scripts[0].run_at, 'document_start');
  const content = fs.readFileSync(path.join(extension, 'content-script.js'), 'utf8');
  assert.match(content, /Drop image or video here/);
  assert.match(content, /collection: 'downloads'/);
  assert.match(content, /HTMLVideoElement/);
  assert.match(content, /backgroundImage/);
  assert.match(content, /scheduleOverlay\(elementUrl \|\| transferUrl\)/);
  assert.match(content, /requestAnimationFrame/);
  assert.match(content,/left: '50%', top: '50%', transform: 'translate\(-50%, -50%\)'/);
  assert.match(content,/background: 'transparent'/);
  assert.doesNotMatch(content,/inset: '0'/);
  assert.match(content,/<section class="panel"[^>]*><button class="close"/);
  assert.match(content, /if \(!dropCommitted\) hideTimer = setTimeout\(hideOverlay, 350\)/);
  const worker = fs.readFileSync(path.join(extension, 'service-worker.js'), 'utf8');
  assert.match(worker, /http:\/\/127\.0\.0\.1:47635\/extension\/import/);
  assert.match(worker, /body: JSON\.stringify\(\{ url, collection, requestId, title \}\)/);
  assert.match(worker, /controller\.abort\(\), 10 \* 60 \* 1000/);
  assert.match(worker, /const pendingImports = new Map\(\)/);
  assert.doesNotMatch(worker, /attempt < 6/);
  assert.match(content, /if \(dropCommitted\) return/);
  assert.match(content, /closeOverlayAfterDrop\(\)/);
  assert.ok(content.indexOf('closeOverlayAfterDrop();') < content.indexOf("api.runtime.sendMessage({ type: 'save-url'"));
  assert.match(content,/canonicalYouTubeUrl\(globalThis\.location\?\.href\)/);
  assert.match(content,/globalThis\.crypto\?\.randomUUID\?\.\(\)/);
  assert.match(content,/if \(!url \|\| !api\?\.runtime\?\.sendMessage\) return/);
  assert.doesNotMatch(content, /Downloading in Pigeon…/);
  assert.doesNotMatch(content, /response\?\.ok===false/);
  assert.deepEqual(chromium.content_scripts[0].js, ['drop-url.js', 'content-script.js']);
  assert.doesNotMatch(worker, /tabs\.create/);
});

test('Edge duplicate save messages share one in-flight Pigeon download', async () => {
  const source = fs.readFileSync(path.join(extension, 'service-worker.js'), 'utf8');
  let messageListener, fetchCalls = 0;
  const chrome = {
    runtime: { onInstalled: { addListener() {} }, onMessage: { addListener(listener) { messageListener = listener; } }, lastError: null },
    contextMenus: { removeAll(callback) { callback(); }, create() {}, onClicked: { addListener() {} } }
  };
  const context = { chrome, fetch: async () => { fetchCalls += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return { ok: true, json: async () => ({ ok: true, id: 'asset-1' }) }; }, AbortController, setTimeout, clearTimeout };
  vm.runInNewContext(source, context);
  const responses = [];
  for (let index = 0; index < 3; index += 1) assert.equal(messageListener({ type: 'save-url', url: 'https://example.com/image.jpg', collection: 'downloads', requestId: `request-${index}` }, {}, (result) => responses.push(result)), true);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(fetchCalls, 1);
  assert.equal(responses.length, 3);
  assert.ok(responses.every((result) => result.ok));
});

test('YouTube title and thumbnail drags preserve the canonical video rather than the image CDN URL', () => {
  assert.equal(canonicalYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=queue'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(firstYouTubeUrl(['https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', 'https://youtu.be/dQw4w9WgXcQ?t=3']), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const content = fs.readFileSync(path.join(extension, 'content-script.js'), 'utf8');
  assert.match(content, /youtubeUrlForElement/);
  assert.match(content, /PigeonDropUrl\?\.firstYouTubeUrl/);
});

test('Downloads stays first among top-level collections without changing nested or Smart Folder order',()=>{
  const renderer=fs.readFileSync(path.join(root,'src','renderer.js'),'utf8');
  assert.match(renderer,/type==='collections'/);
  assert.match(renderer,/a\.parentId==null&&String\(a\.name\)\.toLowerCase\(\)==='downloads'/);
  assert.match(renderer,/compareSidebarItems\(a,b,sort,type\)/);
  assert.match(renderer,/compareSidebarItems\(a,b,sidebarSortValue\(type,parentId\),type\)/);
});

test('extension remains permission-minimal and provides a Firefox manifest', () => {
  const chromium = manifest();
  const firefox = manifest('manifest.firefox.json');
  assert.equal(firefox.name, 'Pigeon for Firefox');
  for (const blocked of ['nativeMessaging', 'downloads', 'history', 'cookies', 'webRequest']) {
    assert.equal(JSON.stringify([chromium, firefox]).includes(blocked), false, blocked);
  }
  assert.equal(chromium.background.service_worker, 'service-worker.js');
  assert.equal(firefox.version, '2.0.5');
  assert.deepEqual(firefox.background.scripts, ['service-worker.js']);
  assert.equal(firefox.browser_specific_settings.gecko.id, 'drag-drop@pigeon.cool');
});

test('browser build emits installable packages named for each browser family', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build-browser-extensions.js')], { cwd: root, timeout: 10000 });
  const browserNames={chrome:'Chrome',edge:'Edge',brave:'Brave',opera:'Opera',vivaldi:'Vivaldi',firefox:'Firefox',safari:'Safari'};
  for (const browser of Object.keys(browserNames)) {
    const directory = path.join(root, 'release', 'browser-extensions', browser);
    const builtManifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    assert.equal(builtManifest.manifest_version, 3, browser);
    assert.equal(builtManifest.name,`Pigeon for ${browserNames[browser]}`,browser);
    for (const file of ['drop-url.js', 'content-script.js', 'service-worker.js', 'popup.html', 'popup.js', 'icons/icon-128.png']) {
      assert.equal(fs.existsSync(path.join(directory, file)), true, `${browser}: ${file}`);
    }
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'release', 'browser-extensions', 'firefox', 'manifest.json'))).background.scripts, ['service-worker.js']);
  assert.match(fs.readFileSync(path.join(extension,'popup.js'),'utf8'),/runtime\.getManifest\(\)\.name/);
});

test('desktop localhost capture routes imports into the virtual Downloads collection', () => {
  const main = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');
  assert.match(main, /function ensureDownloadsCollection\(\)/);
  assert.match(main, /createCollection\(library, 'Downloads', null\)/);
  assert.match(main, /collection === 'downloads'/);
  assert.match(main, /searchParams\.get\('collection'\)/);
  assert.match(main, /EXTENSION_CAPTURE_PORT = 47635/);
  assert.match(main, /url\.pathname==='\/extension\/import'/);
  assert.match(main, /reportPauses:false/);
  assert.match(main, /asset\.collectionIds = \[\.\.\.new Set/);
  assert.match(main, /if \(!protocolImportsReady\)/);
  assert.match(main, /await loadLibraryInWorker\(\);[^\n]*\n?\s*protocolImportsReady = true;\s*flushPendingProtocolUrls\(\)/);
  assert.match(main, /const extensionImportJobs=new Map\(\)/);
  assert.match(main, /function importUrlFromExtension/);
  assert.match(main, /Browser extension download failed/);
  assert.match(main, /Browser download failed/);
});
