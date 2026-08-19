(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PigeonDropUrl = api;
})(globalThis, () => {
  const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);

  function canonicalYouTubeUrl(value, base) {
    try {
      const url = new URL(String(value || '').trim(), base);
      const host = url.hostname.toLowerCase();
      if (!YOUTUBE_HOSTS.has(host)) return '';
      const id = host === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/') ? url.pathname.split('/').filter(Boolean)[1] : url.searchParams.get('v');
      return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? `https://www.youtube.com/watch?v=${id}` : '';
    } catch { return ''; }
  }

  function firstYouTubeUrl(values, base) {
    for (const value of values || []) { const canonical = canonicalYouTubeUrl(value, base); if (canonical) return canonical; }
    return '';
  }

  return { canonicalYouTubeUrl, firstYouTubeUrl };
});
