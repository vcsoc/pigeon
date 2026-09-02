const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawn } = require('node:child_process');
const vm = require('node:vm');
const { downloadYouTubeWithYtDlp } = require('./yt-dlp-import');

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

async function createYouTubeClient() {
  const { Innertube, Platform } = await import('youtubei.js');
  Platform.shim.eval = async (data) => new vm.Script(`(()=>{${data.output}\n})()`, { filename: 'youtube-player-decipher.js' }).runInNewContext(Object.create(null), { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return Innertube.create();
}

async function getYouTubeMetadata(urlValue, { createClient } = {}) {
  const videoId = youtubeVideoId(urlValue);
  if (!videoId) throw new Error('This is not a supported YouTube video address');
  const client = createClient ? await createClient() : await createYouTubeClient();
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

async function writeBoundedStream(webStream, target, budget, waitForResume) {
  let bytes = 0;
  const limiter = new Transform({ transform(chunk, _encoding, callback) { Promise.resolve(waitForResume?.()).then(()=>{bytes += chunk.length;callback(bytes > budget ? new Error('YouTube download exceeds the 250 MB safety limit') : null,chunk);},callback); } });
  try {
    await pipeline(Readable.fromWeb(webStream), limiter, fs.createWriteStream(target, { flags: 'wx' }));
    return bytes;
  } catch (error) {
    await fsp.rm(target, { force: true }).catch(() => {});
    throw error;
  }
}

function isFormatUnavailableError(error) { return /no matching formats|no playable.*format|format(?:s)? (?:was|were|is|are)? ?(?:not found|unavailable)|could not find.*format/i.test(String(error?.message || error)); }
async function firstAvailableStream(info, candidates) {
  let lastError;
  for (const options of candidates) {
    try { return { stream: await info.download(options), options }; }
    catch (error) { if (!isFormatUnavailableError(error)) throw error; lastError = error; }
  }
  throw new Error(`No playable YouTube formats were available${lastError?.message ? `: ${lastError.message}` : ''}`);
}

function muxStreams(ffmpegPath, videoPath, audioPath, target, onProcess) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-i', videoPath, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-movflags', '+faststart', target], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    onProcess?.(child);let errorText = '';
    child.stderr.on('data', (chunk) => { errorText = `${errorText}${chunk}`.slice(-4000); });
    child.once('error',(error)=>{onProcess?.(null);reject(error);});
    child.once('exit', (code) => {onProcess?.(null);code === 0 ? resolve(target) : reject(new Error(errorText.trim() || `Could not combine YouTube video and audio (${code})`));});
  });
}

async function downloadYouTubeVideo(urlValue, { outputDir, quality = '720', format = 'mp4', chapterMode = 'embed', maxBytes = 250 * 1024 * 1024, ffmpegPath, createClient, mux = muxStreams, onProgress, onProcess, onTitle, waitForResume } = {}) {
  const videoId = youtubeVideoId(urlValue);
  if (!videoId) throw new Error('This is not a supported YouTube video address');
  const requestedQuality = YOUTUBE_QUALITIES.has(String(quality)) ? String(quality) : '720';
  if(!createClient){try{return{...(await downloadYouTubeWithYtDlp(canonicalYouTubeUrl(urlValue),{outputDir,quality:requestedQuality,format,chapterMode,maxBytes,ffmpegPath,onProgress,onProcess,onTitle})),videoId};}catch(error){if(error.code!=='YOUTUBE_DOWNLOADER_UNAVAILABLE')throw error;if(format==='mp3'||chapterMode==='split')throw new Error('MP3 and chapter-split YouTube downloads require yt-dlp and Deno');}}
  if(format==='mp3'||chapterMode==='split')throw new Error('MP3 and chapter-split YouTube downloads require yt-dlp and Deno');
  const client = createClient ? await createClient() : await createYouTubeClient();
  const info = await client.getBasicInfo(videoId);onTitle?.(info?.basic_info?.title||'YouTube video');
  if (info?.basic_info?.is_live) throw new Error('Live YouTube videos cannot be imported until the stream has ended');
  await fsp.mkdir(outputDir, { recursive: true });
  const base = `${Date.now()}-${safeVideoName(info?.basic_info?.title)}`;
  const target = path.join(outputDir, `${base}.mp4`);
  const qualityLabel = `${requestedQuality}p`, lowerQualities = requestedQuality === '1080' ? ['720p','360p'] : requestedQuality === '720' ? ['360p'] : [];
  const temporary = [];
  try {
    let selectedQuality=requestedQuality;
    if (requestedQuality !== '1080') {
      try {
        const selected=await firstAvailableStream(info,[qualityLabel,...lowerQualities,'best'].map((candidate)=>({type:'video+audio',quality:candidate,format:'mp4'})));selectedQuality=selected.options.quality.replace(/p$/,'');await writeBoundedStream(selected.stream,target,maxBytes,waitForResume);
      } catch(error) {
        if(!isFormatUnavailableError(error)&&!/No playable YouTube formats/i.test(error.message))throw error;
        if(!ffmpegPath)throw error;
        const videoPath=path.join(outputDir,`${base}.video.mp4`),audioPath=path.join(outputDir,`${base}.audio.m4a`);temporary.push(videoPath,audioPath);
        const selectedVideo=await firstAvailableStream(info,[qualityLabel,...lowerQualities,'best'].map((candidate)=>({type:'video',quality:candidate,format:'mp4'})));selectedQuality=selectedVideo.options.quality.replace(/p$/,'');const videoBytes=await writeBoundedStream(selectedVideo.stream,videoPath,maxBytes,waitForResume);const selectedAudio=await firstAvailableStream(info,[{type:'audio',quality:'best',format:'mp4'}]);await writeBoundedStream(selectedAudio.stream,audioPath,maxBytes-videoBytes,waitForResume);await mux(ffmpegPath,videoPath,audioPath,target,onProcess);
      }
    } else {
      if (!ffmpegPath) throw new Error('Pigeon media support is unavailable for 1080p YouTube imports');
      const videoPath = path.join(outputDir, `${base}.video.mp4`), audioPath = path.join(outputDir, `${base}.audio.m4a`);
      temporary.push(videoPath, audioPath);
      const selectedVideo=await firstAvailableStream(info,[qualityLabel,...lowerQualities,'best'].map((candidate)=>({type:'video',quality:candidate,format:'mp4'})));selectedQuality=selectedVideo.options.quality.replace(/p$/,'');
      const videoBytes = await writeBoundedStream(selectedVideo.stream, videoPath, maxBytes, waitForResume);
      const selectedAudio=await firstAvailableStream(info,[{ type: 'audio', quality: 'best', format: 'mp4' }]);
      await writeBoundedStream(selectedAudio.stream, audioPath, maxBytes - videoBytes, waitForResume);
      await mux(ffmpegPath, videoPath, audioPath, target, onProcess);
    }
    if(await fsp.stat(target).then((stat)=>stat.size>maxBytes).catch(()=>false))throw new Error('YouTube download exceeds the 250 MB safety limit');
    return { target, targets:[target], title: info?.basic_info?.title || 'YouTube video', videoId, quality: selectedQuality, format:'mp4', chapterMode:'none' };
  } catch (error) {
    await fsp.rm(target, { force: true }).catch(() => {});
    throw error;
  } finally {
    await Promise.all(temporary.map((file) => fsp.rm(file, { force: true }).catch(() => {})));
  }
}

module.exports = { YOUTUBE_QUALITIES, youtubeVideoId, canonicalYouTubeUrl, safeVideoName, getYouTubeMetadata, writeBoundedStream, downloadYouTubeVideo };
