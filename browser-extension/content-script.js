(() => {
  if (globalThis.__pigeonDragCaptureInstalled) return;
  globalThis.__pigeonDragCaptureInstalled = true;

  const api = globalThis.chrome || globalThis.browser;
  const MEDIA_EXTENSION = /\.(?:avif|bmp|gif|heic|heif|jpe?g|jxl|png|svg|tiff?|webp|3g2|3gp|avi|m4v|mkv|mov|mp4|mpe?g|ogv|ts|webm)(?:[?#]|$)/i;
  let overlay;
  let shadow;
  let activeUrl = '';
  let temporaryDraggable = null;
  let hideTimer = null;
  let showFrame = null;
  let dropCommitted = false;
  let pendingCustomUrl = '';

  function httpUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(String(value).trim(), document.baseURI);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function cssBackgroundUrl(element) {
    const value = getComputedStyle(element).backgroundImage;
    const match = value && value.match(/url\((['"]?)(.*?)\1\)/i);
    return httpUrl(match?.[2]);
  }

  function youtubeUrlForElement(element) {
    if (!(element instanceof Element)) return '';
    for (let node = element, depth = 0; node && depth < 6; node = node.parentElement, depth += 1) {
      const candidates = [];
      if (node.matches?.('a[href]')) candidates.push(node.href);
      for (const anchor of node.querySelectorAll?.('a[href*="youtube.com/watch"],a[href*="youtu.be/"],a[href*="/shorts/"]') || []) candidates.push(anchor.href);
      const canonical = globalThis.PigeonDropUrl?.firstYouTubeUrl(candidates, document.baseURI);
      if (canonical) return canonical;
    }
    return globalThis.PigeonDropUrl?.canonicalYouTubeUrl(globalThis.location?.href) || '';
  }

  function mediaUrlForElement(element) {
    if (!(element instanceof Element)) return '';
    const youtube = youtubeUrlForElement(element);
    if (youtube) return youtube;
    const media = element.closest('img,video,source,picture,a[href]') || element;
    if (media instanceof HTMLImageElement) return httpUrl(media.currentSrc || media.src);
    if (media instanceof HTMLVideoElement) return httpUrl(media.currentSrc || media.src || media.querySelector('source')?.src);
    if (media instanceof HTMLSourceElement) {
      const parent = media.parentElement;
      if (parent instanceof HTMLVideoElement) return httpUrl(parent.currentSrc || media.src);
      if (parent instanceof HTMLPictureElement) return httpUrl(parent.querySelector('img')?.currentSrc || media.src);
    }
    if (media instanceof HTMLPictureElement) return httpUrl(media.querySelector('img')?.currentSrc);
    if (media instanceof HTMLAnchorElement && MEDIA_EXTENSION.test(media.href)) return httpUrl(media.href);
    return cssBackgroundUrl(element);
  }

  function mediaUrlFromTransfer(transfer) {
    if (!transfer) return '';
    const uri = transfer.getData('text/uri-list').split(/\r?\n/).find((line) => line && !line.startsWith('#'));
    const youtubeUri = globalThis.PigeonDropUrl?.canonicalYouTubeUrl(uri, document.baseURI);
    if (youtubeUri) return youtubeUri;
    const direct = httpUrl(uri);
    if (direct) return direct;
    const html = transfer.getData('text/html');
    if (html) {
      const documentFragment = new DOMParser().parseFromString(html, 'text/html');
      const youtube = globalThis.PigeonDropUrl?.firstYouTubeUrl([...documentFragment.querySelectorAll('a[href]')].map((anchor) => anchor.href), document.baseURI);
      if (youtube) return youtube;
      const media = documentFragment.querySelector('img,video,source,a[href]');
      const candidate = media?.getAttribute('src') || media?.getAttribute('href');
      const resolved = httpUrl(candidate);
      if (resolved && (media?.matches('img,video,source') || MEDIA_EXTENSION.test(resolved))) return resolved;
    }
    const plain = transfer.getData('text/plain'),youtubeText=globalThis.PigeonDropUrl?.canonicalYouTubeUrl(plain,document.baseURI);
    if(youtubeText)return youtubeText;
    const text = httpUrl(plain);
    return text && MEDIA_EXTENSION.test(text) ? text : '';
  }

  function buildOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'pigeon-drag-capture-root';
    Object.assign(overlay.style, {
      all: 'initial', position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
      width: 'min(660px, calc(100vw - 40px))', zIndex: '2147483647', display: 'none',
      background: 'transparent', fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
      colorScheme: 'dark', pointerEvents: 'auto'
    });
    shadow = overlay.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>
      *{box-sizing:border-box} .stage{width:100%;display:block}
      .panel{width:100%;min-height:238px;position:relative;border:1px solid #646970;border-radius:12px;background:#282b2f;box-shadow:0 18px 52px #0009;overflow:hidden;padding:18px}
      .choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:12px}.heading{padding:0 38px 2px 2px}.heading strong{font-size:15px}.heading p{font-size:11px;color:#9ea4ab;margin:5px 0 0}.drop{min-height:180px;border:1px dashed #848990;border-radius:8px;display:grid;place-items:center;text-align:center;padding:22px;color:#d6d8dc;background:#24272a;transition:.14s ease}
      .drop.hot{border-color:#d8dde3;background:#30343a;transform:scale(1.012)}
      .mark{width:76px;height:62px;margin:auto auto 17px;position:relative;border:2px solid #858b92;border-radius:8px;background:linear-gradient(155deg,#444950,#282c31)}
      .mark:before{content:'';position:absolute;left:10px;top:-13px;width:33px;height:14px;border:2px solid #858b92;border-bottom:0;border-radius:6px 6px 0 0;background:#34383d}
      .bird{font-size:25px;line-height:58px;opacity:.88}.title{font-size:14px;font-weight:650}.hint{font-size:11px;color:#9ba0a7;margin-top:7px}
      .options{display:none;border:1px solid #4b5057;border-radius:8px;background:#24272a;padding:16px;margin-top:12px}.options.visible{display:block}.options-title{font-size:14px;font-weight:650;margin-bottom:12px}.fields{display:grid;grid-template-columns:1fr 1fr 1.5fr;gap:10px}.field{display:grid;gap:5px}.field label{font-size:10px;color:#aeb4bc}.field select{height:34px;border:1px solid #555b63;border-radius:6px;background:#1e2124;color:#fff;padding:0 8px}.option-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:13px}.option-actions button{height:34px;padding:0 14px;border:1px solid #626a73;border-radius:6px;background:#34383e;color:#fff;font-weight:650;cursor:pointer}.option-actions .primary{background:#4b5865;border-color:#758494}
      .status{height:19px;margin-top:11px;color:#aeb4bc;font-size:11px}.close{position:absolute;z-index:2;right:8px;top:8px;width:30px;height:30px;padding:0;border:1px solid #51565d;border-radius:7px;background:#24272b;color:#c5cad1;font:22px/27px system-ui;cursor:pointer}.close:hover{border-color:#7c838c;background:#34383d;color:#fff}
      @media(max-width:560px){.choice-grid,.fields{grid-template-columns:1fr}.drop{min-height:135px}}
    </style><div class="stage"><section class="panel" role="dialog" aria-label="Download media to Pigeon"><button class="close" title="Cancel" aria-label="Cancel">×</button><div class="heading"><strong>Download to Pigeon</strong><p>Drop into Quick download or choose custom YouTube options.</p></div><div class="choice-grid"><div class="drop quick-drop"><div><div class="mark"><div class="bird">⇩</div></div><div class="title">Quick download</div><div class="hint">Immediately uses your Pigeon preferences</div></div></div><div class="drop custom-drop"><div><div class="mark"><div class="bird">⚙</div></div><div class="title">Choose YouTube options</div><div class="hint">Quality, MP4 or MP3, and chapter handling</div></div></div></div><div class="options"><div class="options-title">Custom YouTube download</div><div class="fields"><div class="field"><label>Format</label><select class="format"><option value="mp4">MP4 video</option><option value="mp3">MP3 audio</option><option value="thumbnail">Highest-quality thumbnail image</option></select></div><div class="field"><label>Video quality</label><select class="quality"><option value="360">360p</option><option value="720" selected>720p</option><option value="1080">1080p</option></select></div><div class="field"><label>Chapters</label><select class="chapters"><option value="embed">Single file with chapters embedded</option><option value="split">Separate file for each chapter</option></select></div></div><div class="option-actions"><button class="back">Back</button><button class="primary start">Start download in Pigeon</button></div></div><div class="status" aria-live="polite"></div></section></div>`;
    document.documentElement.appendChild(overlay);
    const status = shadow.querySelector('.status'),choiceGrid=shadow.querySelector('.choice-grid'),options=shadow.querySelector('.options'),format=shadow.querySelector('.format'),quality=shadow.querySelector('.quality');
    const sendDownload=(url,youtubeOptions=null)=>{const requestId=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;closeOverlayAfterDrop();if(!url||!api?.runtime?.sendMessage)return;try{api.runtime.sendMessage({type:'save-url',url,collection:'downloads',requestId,title:document.title||'',youtubeOptions},()=>{try{if(api.runtime.lastError)void api.runtime.lastError;}catch{}});}catch{/* The page must be reloaded after an extension update invalidates its old runtime. */}};
    const prepareDrop=(drop)=>(event)=>{event.preventDefault();event.stopPropagation();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';drop.classList.add('hot');};
    for(const drop of shadow.querySelectorAll('.drop')){const prevent=prepareDrop(drop);drop.addEventListener('dragenter',prevent);drop.addEventListener('dragover',prevent);drop.addEventListener('dragleave',()=>drop.classList.remove('hot'));drop.addEventListener('drop',(event)=>{prevent(event);drop.classList.remove('hot');if(dropCommitted)return;const url=activeUrl||mediaUrlFromTransfer(event.dataTransfer);if(drop.classList.contains('quick-drop')){dropCommitted=true;sendDownload(url);return;}const canonical=globalThis.PigeonDropUrl?.canonicalYouTubeUrl(url,document.baseURI);if(!canonical){status.textContent='Custom options are available for YouTube videos. Use Quick download for other media.';return;}dropCommitted=true;pendingCustomUrl=canonical;choiceGrid.style.display='none';options.classList.add('visible');status.textContent='Choose the format, quality, and chapter handling.';});}
    format.addEventListener('change',()=>{const thumbnail=format.value==='thumbnail';quality.disabled=format.value!=='mp4';shadow.querySelector('.chapters').disabled=thumbnail;status.textContent=thumbnail?'Pigeon will save only the largest thumbnail image and retain the original YouTube link.':'Choose the format, quality, and chapter handling.';});
    shadow.querySelector('.back').addEventListener('click',()=>{pendingCustomUrl='';dropCommitted=false;options.classList.remove('visible');choiceGrid.style.display='grid';status.textContent='';});
    shadow.querySelector('.start').addEventListener('click',()=>sendDownload(pendingCustomUrl,{format:format.value,quality:quality.value,chapterMode:shadow.querySelector('.chapters').value}));
    shadow.querySelector('.close').addEventListener('click',hideOverlay);
  }

  function showOverlay(url) {
    if (!url) return;
    clearTimeout(hideTimer);
    buildOverlay();
    activeUrl = url;
    pendingCustomUrl = '';
    dropCommitted = false;
    shadow.querySelector('.status').textContent = '';
    for(const drop of shadow.querySelectorAll('.drop'))drop.classList.remove('hot');
    shadow.querySelector('.choice-grid').style.display='grid';
    shadow.querySelector('.options').classList.remove('visible');
    overlay.style.display = 'block';
  }

  function scheduleOverlay(url) {
    if (!url) return;
    if (showFrame !== null) cancelAnimationFrame(showFrame);
    showFrame = requestAnimationFrame(() => {
      showFrame = requestAnimationFrame(() => {
        showFrame = null;
        showOverlay(url);
      });
    });
  }

  function closeOverlayAfterDrop() {
    clearTimeout(hideTimer);
    if (showFrame !== null) cancelAnimationFrame(showFrame);
    showFrame = null;
    activeUrl = '';
    pendingCustomUrl = '';
    if (overlay) overlay.style.display = 'none';
    if (temporaryDraggable) { temporaryDraggable.removeAttribute('draggable'); temporaryDraggable = null; }
  }

  function hideOverlay() {
    closeOverlayAfterDrop();
    dropCommitted = false;
  }

  if (document.documentElement) buildOverlay();
  else document.addEventListener('DOMContentLoaded', buildOverlay, { once: true });

  document.addEventListener('pointerdown', (event) => {
    const element = event.target instanceof Element ? event.target : null;
    if (!element || !mediaUrlForElement(element)) return;
    const target = element.closest('video') || (cssBackgroundUrl(element) ? element : null);
    if (target && !target.hasAttribute('draggable')) {
      target.setAttribute('draggable', 'true');
      temporaryDraggable = target;
    }
  }, true);

  document.addEventListener('dragstart', (event) => {
    const elementUrl = mediaUrlForElement(event.target);
    const transferUrl = mediaUrlFromTransfer(event.dataTransfer);
    scheduleOverlay(elementUrl || transferUrl);
  }, true);
  document.addEventListener('dragend', () => {
    if (!dropCommitted) hideTimer = setTimeout(hideOverlay, 350);
  }, true);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideOverlay(); }, true);
})();
