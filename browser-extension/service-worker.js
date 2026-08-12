const sendToPigeon = (url) => chrome.tabs.create({ url: `pigeon://import?url=${encodeURIComponent(url)}` });
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'pigeon-media', title: 'Save media to Pigeon', contexts: ['image', 'video', 'audio'] });
  chrome.contextMenus.create({ id: 'pigeon-link', title: 'Save link to Pigeon', contexts: ['link'] });
});
chrome.contextMenus.onClicked.addListener((info) => sendToPigeon(info.srcUrl || info.linkUrl));
chrome.runtime.onMessage.addListener((message) => { if (message.type === 'save-url' && message.url) sendToPigeon(message.url); });
