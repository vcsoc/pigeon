const api = globalThis.chrome || globalThis.browser;
const status = document.querySelector('#status');
const optionsPanel=document.querySelector('#options');
let pendingCustomUrl='';
let pendingCustomTitle='';
document.querySelector('#extension-name').textContent = api.runtime.getManifest().name;

async function activeTab() {
  return (await api.tabs.query({ active: true, currentWindow: true }))[0];
}

function transferUrl(transfer){
  if(!transfer)return'';
  const uri=transfer.getData('text/uri-list').split(/\r?\n/).find((line)=>line&&!line.startsWith('#'))||transfer.getData('text/plain');
  try{const url=new URL(String(uri||'').trim());return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return'';}
}

function send(url,title='',youtubeOptions=null) {
  const requestId=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  if(!url){status.textContent='Drop a valid web media URL.';return;}
  try{api.runtime.sendMessage({type:'save-url',url,collection:'downloads',requestId,title,youtubeOptions},()=>{try{if(api.runtime.lastError)void api.runtime.lastError;}catch{}});window.close();}catch{status.textContent='Reload the page after updating the extension.';}
}

function showOptions(url,title=''){
  const canonical=globalThis.PigeonDropUrl?.canonicalYouTubeUrl(url);
  if(!canonical){status.textContent='Custom options are available for YouTube videos. Use Quick download for other media.';return;}
  pendingCustomUrl=canonical;pendingCustomTitle=title;status.textContent='Choose the format, quality, and chapter handling.';optionsPanel.classList.add('visible');
}

for(const [id,custom] of [['quick-drop',false],['custom-drop',true]]){
  const zone=document.querySelector(`#${id}`),prevent=(event)=>{event.preventDefault();event.stopPropagation();zone.classList.add('hot');if(event.dataTransfer)event.dataTransfer.dropEffect='copy';};
  zone.addEventListener('dragenter',prevent);zone.addEventListener('dragover',prevent);zone.addEventListener('dragleave',()=>zone.classList.remove('hot'));zone.addEventListener('drop',(event)=>{prevent(event);zone.classList.remove('hot');const url=transferUrl(event.dataTransfer);if(custom)showOptions(url);else send(url);});
}

document.querySelector('#format').addEventListener('change',(event)=>{const thumbnail=event.target.value==='thumbnail';document.querySelector('#quality').disabled=event.target.value!=='mp4';document.querySelector('#chapters').disabled=thumbnail;status.textContent=thumbnail?'Pigeon will save only the largest thumbnail image and retain the original YouTube link.':'Choose the format, quality, and chapter handling.';});
document.querySelector('#options-close').addEventListener('click',()=>{pendingCustomUrl='';optionsPanel.classList.remove('visible');status.textContent='';});
document.querySelector('#custom-download').addEventListener('click',()=>send(pendingCustomUrl,pendingCustomTitle,{format:document.querySelector('#format').value,quality:document.querySelector('#quality').value,chapterMode:document.querySelector('#chapters').value}));
document.querySelector('#page').addEventListener('click', async () => {const tab=await activeTab();send(tab?.url,tab?.title||'');});
document.querySelector('#page-options').addEventListener('click',async()=>{const tab=await activeTab();showOptions(tab?.url,tab?.title||'');});
document.querySelector('#image').addEventListener('click', async () => {
  const tab = await activeTab();
  if (!tab?.id) return send('');
  const [{ result } = {}] = await api.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => [...document.images]
      .filter((image) => /^https?:/i.test(image.currentSrc || image.src))
      .sort((first, second) => second.naturalWidth * second.naturalHeight - first.naturalWidth * first.naturalHeight)[0]?.currentSrc
  });
  send(result,tab.title||'');
});
