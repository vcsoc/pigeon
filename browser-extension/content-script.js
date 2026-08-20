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
      .panel{width:100%;min-height:238px;position:relative;border:1px solid #646970;border-radius:12px;background:#282b2f;box-shadow:0 18px 52px #0009;display:grid;grid-template-columns:minmax(220px,46%) 1fr;overflow:hidden}
      .drop{margin:15px;border:1px dashed #848990;border-radius:7px;display:grid;place-items:center;text-align:center;padding:24px;color:#d6d8dc;background:#24272a;transition:.14s ease}
      .drop.hot{border-color:#d8dde3;background:#30343a;transform:scale(1.012)}
      .mark{width:76px;height:62px;margin:auto auto 17px;position:relative;border:2px solid #858b92;border-radius:8px;background:linear-gradient(155deg,#444950,#282c31)}
      .mark:before{content:'';position:absolute;left:10px;top:-13px;width:33px;height:14px;border:2px solid #858b92;border-bottom:0;border-radius:6px 6px 0 0;background:#34383d}
      .bird{font-size:25px;line-height:58px;opacity:.88}.title{font-size:14px;font-weight:650}.hint{font-size:11px;color:#9ba0a7;margin-top:7px}
      .destination{border-left:1px solid #464a50;display:flex;flex-direction:column;justify-content:flex-end;padding:22px 24px;background:#2d3034}
      .eyebrow{color:#969ca4;font-size:10px;text-transform:uppercase;letter-spacing:.14em}.folder{display:flex;align-items:center;gap:11px;margin-top:9px;font-size:14px;font-weight:650}.folder-icon{font-size:20px;color:#ccd1d7}.copy{font-size:11px;color:#9ea4ab;line-height:1.5;margin:10px 0 0}
      .status{height:19px;margin-top:15px;color:#aeb4bc;font-size:11px}.close{position:absolute;z-index:2;right:8px;top:8px;width:30px;height:30px;padding:0;border:1px solid #51565d;border-radius:7px;background:#24272b;color:#c5cad1;font:22px/27px system-ui;cursor:pointer}.close:hover{border-color:#7c838c;background:#34383d;color:#fff}
      @media(max-width:560px){.panel{grid-template-columns:1fr}.destination{border-left:0;border-top:1px solid #464a50}.drop{min-height:175px}}
    </style><div class="stage"><section class="panel" role="dialog" aria-label="Save media to Pigeon"><button class="close" title="Cancel" aria-label="Cancel">×</button><div class="drop"><div><div class="mark"><div class="bird">◒</div></div><div class="title">Drop image or video here</div><div class="hint">Release to save it to Pigeon</div></div></div><div class="destination"><div class="eyebrow">Temporary collection</div><div class="folder"><span class="folder-icon">▱</span><span>Downloads</span></div><p class="copy">Captured media stays in Pigeon’s managed imports folder while you review, organize, or remove its library reference.</p><div class="status" aria-live="polite"></div></div></section></div>`;
    document.documentElement.appendChild(overlay);
    const drop = shadow.querySelector('.drop');
    const status = shadow.querySelector('.status');
    const prevent = (event) => { event.preventDefault(); event.stopPropagation(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; drop.classList.add('hot'); };
    overlay.addEventListener('dragenter', prevent, true);
    overlay.addEventListener('dragover', prevent, true);
    overlay.addEventListener('dragleave', (event) => { if (!overlay.contains(event.relatedTarget)) drop.classList.remove('hot'); }, true);
    overlay.addEventListener('drop', (event) => {
      prevent(event);
      if (dropCommitted) return;
      dropCommitted = true;
      const url = activeUrl || mediaUrlFromTransfer(event.dataTransfer), requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      closeOverlayAfterDrop();
      if (!url || !api?.runtime?.sendMessage) return;
      try { api.runtime.sendMessage({ type: 'save-url', url, collection: 'downloads', requestId, title: document.title || '' }, () => { try { if (api.runtime.lastError) void api.runtime.lastError; } catch {} }); }
      catch { /* The page must be reloaded after an extension update invalidates its old runtime. */ }
    }, true);
    shadow.querySelector('.close').addEventListener('click', hideOverlay);
  }

  function showOverlay(url) {
    if (!url) return;
    clearTimeout(hideTimer);
    buildOverlay();
    activeUrl = url;
    dropCommitted = false;
    shadow.querySelector('.status').textContent = '';
    shadow.querySelector('.drop').classList.remove('hot');
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
