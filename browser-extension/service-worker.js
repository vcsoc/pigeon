const api = globalThis.chrome || globalThis.browser;
const CAPTURE_ENDPOINT = 'http://127.0.0.1:47635/extension/import';
const pendingImports = new Map();

async function sendToPigeon(url, collection = 'downloads', requestId = '', title = '', youtubeOptions = null) {
  const optionKey=youtubeOptions?`${youtubeOptions.format}:${youtubeOptions.quality}:${youtubeOptions.chapterMode}`:'preferences';
  const key = `${collection}:${String(url).trim()}:${optionKey}`, existing = pendingImports.get(key);
  if (existing) return existing;
  const operation = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 70 * 60 * 1000);
    try {
      const response = await fetch(CAPTURE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pigeon-Extension': '2' },
        body: JSON.stringify({ url, collection, requestId, title, youtubeOptions }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok) return result;
      throw new Error(result.message || `Pigeon returned ${response.status}`);
    } catch (error) {
      const message = error.name === 'AbortError' ? 'Pigeon did not answer the extension within 70 minutes' : error.message;
      throw new Error(`${message}. Make sure Pigeon is open and try again.`);
    } finally { clearTimeout(timeout); }
  })();
  pendingImports.set(key, operation);
  operation.then(() => { const release=setTimeout(() => { if (pendingImports.get(key) === operation) pendingImports.delete(key); }, 5000);release.unref?.(); }, () => pendingImports.delete(key));
  return operation;
}

function createContextMenus() {
  api.contextMenus.removeAll(() => {
    api.contextMenus.create({ id: 'pigeon-media', title: 'Save media to Pigeon Downloads', contexts: ['image', 'video', 'audio'] });
    api.contextMenus.create({ id: 'pigeon-link', title: 'Save link to Pigeon Downloads', contexts: ['link'] });
    if (api.runtime.lastError) void api.runtime.lastError;
  });
}

api.runtime.onInstalled.addListener(createContextMenus);
api.contextMenus.onClicked.addListener((info) => {
  const url = info.srcUrl || info.linkUrl;
  if (url) sendToPigeon(url).catch(() => {});
});
api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'save-url' || !message.url) return false;
  sendToPigeon(message.url, message.collection || 'downloads', message.requestId || '', message.title || '', message.youtubeOptions || null)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, message: error.message }));
  return true;
});
