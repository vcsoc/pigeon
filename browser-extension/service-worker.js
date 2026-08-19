const api = globalThis.chrome || globalThis.browser;
const CAPTURE_ENDPOINT = 'http://127.0.0.1:47635/extension/import';

async function sendToPigeon(url, collection = 'downloads') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);
  try {
    const response = await fetch(CAPTURE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pigeon-Extension': '2' },
      body: JSON.stringify({ url, collection }),
      signal: controller.signal
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.ok) return result;
    throw new Error(result.message || `Pigeon returned ${response.status}`);
  } catch (error) {
    const message = error.name === 'AbortError' ? 'The YouTube import took longer than 10 minutes' : error.message;
    throw new Error(`${message}. Make sure Pigeon is open and try again.`);
  } finally { clearTimeout(timeout); }
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
  sendToPigeon(message.url, message.collection || 'downloads')
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, message: error.message }));
  return true;
});
