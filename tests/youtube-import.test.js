const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { youtubeVideoId, canonicalYouTubeUrl, safeVideoName, getYouTubeMetadata, downloadYouTubeVideo } = require('../electron/youtube-import');

function bytes(value) { return new ReadableStream({ start(controller) { controller.enqueue(Buffer.from(value)); controller.close(); } }); }

test('YouTube watch, short, and shortened links resolve without accepting ordinary HTML pages', () => {
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=4'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), '');
  assert.equal(safeVideoName('Title: bad/name?'), 'Title- bad-name-');
  assert.equal(canonicalYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=4'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('linked YouTube metadata uses the canonical URL and largest available thumbnail', async () => {
  const metadata = await getYouTubeMetadata('https://youtube.com/shorts/dQw4w9WgXcQ', { createClient: async () => ({ getBasicInfo: async () => ({ basic_info: { title: 'Linked Test', duration: 42, thumbnail: [{ url: 'small', width: 120 }, { url: 'large', width: 480 }] } }) }) });
  assert.deepEqual(metadata, { videoId: 'dQw4w9WgXcQ', canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Linked Test', duration: 42, thumbnailUrl: 'large', isLive: false });
});

test('720p is downloaded as one bounded local playable file', async () => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'pigeon-youtube-'));
  const calls = [];
  const info = { basic_info: { title: 'Local Test', is_live: false }, download: async (options) => { calls.push(options); return bytes('video-audio'); } };
  try {
    const result = await downloadYouTubeVideo('https://youtu.be/dQw4w9WgXcQ', { outputDir: directory, createClient: async () => ({ getBasicInfo: async () => info }) });
    assert.equal(result.quality, '720');
    assert.deepEqual(calls, [{ type: 'video+audio', quality: '720p', format: 'mp4' }]);
    assert.equal(fs.readFileSync(result.target, 'utf8'), 'video-audio');
  } finally { await fsp.rm(directory, { recursive: true, force: true }); }
});

test('720p falls back to an available lower MP4 quality instead of failing format selection', async () => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'pigeon-youtube-'));
  const calls=[];
  const info={basic_info:{title:'Fallback Test',is_live:false},download:async(options)=>{calls.push(options);if(options.quality==='720p')throw new Error('No matching formats found');return bytes('fallback-video');}};
  try{
    const result=await downloadYouTubeVideo('https://youtu.be/dQw4w9WgXcQ',{outputDir:directory,createClient:async()=>({getBasicInfo:async()=>info})});
    assert.equal(result.quality,'360');
    assert.deepEqual(calls,[{type:'video+audio',quality:'720p',format:'mp4'},{type:'video+audio',quality:'360p',format:'mp4'}]);
    assert.equal(fs.readFileSync(result.target,'utf8'),'fallback-video');
  }finally{await fsp.rm(directory,{recursive:true,force:true});}
});

test('1080p downloads separate streams, merges them, and removes temporary parts', async () => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'pigeon-youtube-'));
  const calls = [];
  const info = { basic_info: { title: 'HD Test', is_live: false }, download: async (options) => { calls.push(options); return bytes(options.type); } };
  let muxed = false;
  try {
    const result = await downloadYouTubeVideo('https://youtube.com/watch?v=dQw4w9WgXcQ', { outputDir: directory, quality: '1080', ffmpegPath: 'ffmpeg', createClient: async () => ({ getBasicInfo: async () => info }), mux: async (_ffmpeg, video, audio, target) => { muxed = fs.existsSync(video) && fs.existsSync(audio); await fsp.writeFile(target, 'muxed'); } });
    assert.equal(muxed, true);
    assert.deepEqual(calls, [{ type: 'video', quality: '1080p', format: 'mp4' }, { type: 'audio', quality: 'best', format: 'mp4' }]);
    assert.equal(fs.readFileSync(result.target, 'utf8'), 'muxed');
    assert.deepEqual((await fsp.readdir(directory)).filter((name) => /\.(video\.mp4|audio\.m4a)$/.test(name)), []);
  } finally { await fsp.rm(directory, { recursive: true, force: true }); }
});
