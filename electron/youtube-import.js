const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawn } = require('node:child_process');

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);
const YOUTUBE_QUALITIES = new Set(['360', '720', '1080']);

function youtubeVideoId(value) {
  try {
    const url = new URL(String(value || '').trim());
    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) return '';
    const id = host === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/') ? url.pathname.split('/').filter(Boolean)[1] : url.searchParams.get('v');
    return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : '';
  } catch {
    return '';
  }
}

function safeVideoName(value) {
  return String(value || 'YouTube video').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 150) || 'YouTube video';
}

function canonicalYouTubeUrl(value) {
  const videoId = youtubeVideoId(value);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';
}

async function getYouTubeMetadata(urlValue, { createClient } = {}) {
  const videoId = youtubeVideoId(urlValue);
  if (!videoId) throw new Error('This is not a supported YouTube video address');
  const client = createClient ? await createClient() : await import('youtubei.js').then(({ Innertube }) => Innertube.create());
  const info = await client.getBasicInfo(videoId);
  const thumbnails = Array.isArray(info?.basic_info?.thumbnail) ? info.basic_info.thumbnail : [];
  const thumbnail = thumbnails.reduce((best, item) => Number(item?.width || 0) > Number(best?.width || 0) ? item : best, null);
  return {
    videoId,
    canonicalUrl: canonicalYouTubeUrl(urlValue),
    title: info?.basic_info?.title || 'YouTube video',
    duration: Number(info?.basic_info?.duration) || null,
    thumbnailUrl: thumbnail?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    isLive: Boolean(info?.basic_info?.is_live)
  };
}

async function writeBoundedStream(webStream, target, budget) {
  let bytes = 0;
  const limiter = new Transform({ transform(chunk, _encoding, callback) { bytes += chunk.length; callback(bytes > budget ? new Error('YouTube download exceeds the 250 MB safety limit') : null, chunk); } });
  try {
    await pipeline(Readable.fromWeb(webStream), limiter, fs.createWriteStream(target, { flags: 'wx' }));
    return bytes;
  } catch (error) {
    await fsp.rm(target, { force: true }).catch(() => {});
    throw error;
  }
}

function muxStreams(ffmpegPath, videoPath, audioPath, target) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-i', videoPath, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-movflags', '+faststart', target], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let errorText = '';
    child.stderr.on('data', (chunk) => { errorText = `${errorText}${chunk}`.slice(-4000); });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve(target) : reject(new Error(errorText.trim() || `Could not combine YouTube video and audio (${code})`)));
  });
}

async function downloadYouTubeVideo(urlValue, { outputDir, quality = '720', maxBytes = 250 * 1024 * 1024, ffmpegPath, createClient, mux = muxStreams } = {}) {
  const videoId = youtubeVideoId(urlValue);
  if (!videoId) throw new Error('This is not a supported YouTube video address');
  const requestedQuality = YOUTUBE_QUALITIES.has(String(quality)) ? String(quality) : '720';
  const client = createClient ? await createClient() : await import('youtubei.js').then(({ Innertube }) => Innertube.create());
  const info = await client.getBasicInfo(videoId);
  if (info?.basic_info?.is_live) throw new Error('Live YouTube videos cannot be imported until the stream has ended');
  await fsp.mkdir(outputDir, { recursive: true });
  const base = `${Date.now()}-${safeVideoName(info?.basic_info?.title)}`;
  const target = path.join(outputDir, `${base}.mp4`);
  const qualityLabel = `${requestedQuality}p`;
  const temporary = [];
  try {
    if (requestedQuality !== '1080') {
      const stream = await info.download({ type: 'video+audio', quality: qualityLabel, format: 'mp4' });
      await writeBoundedStream(stream, target, maxBytes);
    } else {
      if (!ffmpegPath) throw new Error('Pigeon media support is unavailable for 1080p YouTube imports');
      const videoPath = path.join(outputDir, `${base}.video.mp4`), audioPath = path.join(outputDir, `${base}.audio.m4a`);
      temporary.push(videoPath, audioPath);
      const videoStream = await info.download({ type: 'video', quality: qualityLabel, format: 'mp4' });
      const videoBytes = await writeBoundedStream(videoStream, videoPath, maxBytes);
      const audioStream = await info.download({ type: 'audio', quality: 'best', format: 'mp4' });
      await writeBoundedStream(audioStream, audioPath, maxBytes - videoBytes);
      await mux(ffmpegPath, videoPath, audioPath, target);
      const stat = await fsp.stat(target);
      if (stat.size > maxBytes) throw new Error('YouTube download exceeds the 250 MB safety limit');
    }
    return { target, title: info?.basic_info?.title || 'YouTube video', videoId, quality: requestedQuality };
  } catch (error) {
    await fsp.rm(target, { force: true }).catch(() => {});
    throw error;
  } finally {
    await Promise.all(temporary.map((file) => fsp.rm(file, { force: true }).catch(() => {})));
  }
}

module.exports = { YOUTUBE_QUALITIES, youtubeVideoId, canonicalYouTubeUrl, safeVideoName, getYouTubeMetadata, writeBoundedStream, downloadYouTubeVideo };
