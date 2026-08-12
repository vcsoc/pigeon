async function activeTab() { return (await chrome.tabs.query({ active: true, currentWindow: true }))[0]; }
document.querySelector('#page').addEventListener('click', async () => chrome.runtime.sendMessage({ type: 'save-url', url: (await activeTab()).url }));
document.querySelector('#image').addEventListener('click', async () => {
  const tab = await activeTab();
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => [...document.images].sort((a,b) => b.naturalWidth*b.naturalHeight-a.naturalWidth*a.naturalHeight)[0]?.src });
  if (result) chrome.runtime.sendMessage({ type: 'save-url', url: result });
});
