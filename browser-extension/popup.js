const api = globalThis.chrome || globalThis.browser;
const status = document.querySelector('#status');

async function activeTab() {
  return (await api.tabs.query({ active: true, currentWindow: true }))[0];
}

function save(url) {
  if (!url) { status.textContent = 'No downloadable media was found.'; return; }
  status.textContent = 'Sending to Pigeon Downloads…';
  api.runtime.sendMessage({ type: 'save-url', url, collection: 'downloads' }, (response) => {
    if (api.runtime.lastError || response?.ok === false) status.textContent = response?.message || 'Could not open Pigeon.';
    else status.textContent = 'Saved to Pigeon Downloads.';
  });
}

document.querySelector('#page').addEventListener('click', async () => save((await activeTab())?.url));
document.querySelector('#image').addEventListener('click', async () => {
  const tab = await activeTab();
  if (!tab?.id) return save('');
  const [{ result } = {}] = await api.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => [...document.images]
      .filter((image) => /^https?:/i.test(image.currentSrc || image.src))
      .sort((first, second) => second.naturalWidth * second.naturalHeight - first.naturalWidth * first.naturalHeight)[0]?.currentSrc
  });
  save(result);
});
