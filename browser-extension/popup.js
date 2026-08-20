const api = globalThis.chrome || globalThis.browser;
const status = document.querySelector('#status');
document.querySelector('#extension-name').textContent = api.runtime.getManifest().name;

async function activeTab() {
  return (await api.tabs.query({ active: true, currentWindow: true }))[0];
}

function save(url,title='') {
  const requestId=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  if(url)try{api.runtime.sendMessage({type:'save-url',url,collection:'downloads',requestId,title},()=>{try{if(api.runtime.lastError)void api.runtime.lastError;}catch{}});}catch{}
  window.close();
}

document.querySelector('#page').addEventListener('click', async () => {const tab=await activeTab();save(tab?.url,tab?.title||'');});
document.querySelector('#image').addEventListener('click', async () => {
  const tab = await activeTab();
  if (!tab?.id) return save('');
  const [{ result } = {}] = await api.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => [...document.images]
      .filter((image) => /^https?:/i.test(image.currentSrc || image.src))
      .sort((first, second) => second.naturalWidth * second.naturalHeight - first.naturalWidth * first.naturalHeight)[0]?.currentSrc
  });
  save(result,tab.title||'');
});
