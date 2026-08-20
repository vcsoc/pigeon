const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {ytDlpFormatSelectors,downloadYouTubeWithYtDlp}=require('../electron/yt-dlp-import');

test('yt-dlp selectors preserve the requested MP4 quality and deterministic lower fallbacks',()=>{
  const[adaptive,progressive]=ytDlpFormatSelectors(1080);
  assert.match(adaptive,/vcodec\^=avc1/);
  assert.match(adaptive,/1080p.*720p.*480p.*360p.*240p/);
  assert.match(progressive,/1080p.*720p.*480p.*360p.*240p/);
  assert.doesNotMatch(ytDlpFormatSelectors(360)[0],/1080p|720p|480p/);
});

test('yt-dlp download uses the proven embedded client and records a bounded local MP4',async()=>{
  const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-ytdlp-')),calls=[];
  try{
    const run=async(command,args)=>{calls.push({command,args});const template=args[args.indexOf('-o')+1],prefix=path.basename(template).split('%')[0],target=path.join(path.dirname(template),`${prefix}Downloaded video [dQw4w9WgXcQ].mp4`);await fsp.writeFile(target,'video');return target;};
    const result=await downloadYouTubeWithYtDlp('https://www.youtube.com/watch?v=dQw4w9WgXcQ',{outputDir:directory,quality:'720',dependencies:{ytDlpPath:'yt-dlp-test',denoPath:'deno-test'},ffmpegPath:'ffmpeg-test',run});
    assert.equal(calls.length,1);assert.equal(calls[0].command,'yt-dlp-test');assert.ok(calls[0].args.includes('youtube:player_client=web_embedded'));assert.ok(calls[0].args.includes('1M'));assert.ok(calls[0].args.includes('deno:deno-test'));assert.ok(calls[0].args.includes('ffmpeg-test'));assert.equal(await fsp.readFile(result.target,'utf8'),'video');assert.equal(result.downloader,'yt-dlp');
  }finally{await fsp.rm(directory,{recursive:true,force:true});}
});

test('yt-dlp retries a progressive selector after a retryable CDN rejection',async()=>{
  const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-ytdlp-'));let attempts=0;
  try{
    const run=async(_command,args)=>{attempts++;if(attempts===1)throw new Error('HTTP Error 403: Forbidden');const template=args[args.indexOf('-o')+1],prefix=path.basename(template).split('%')[0],target=path.join(path.dirname(template),`${prefix}Retry [dQw4w9WgXcQ].mp4`);await fsp.writeFile(target,'retry');return target;};
    await downloadYouTubeWithYtDlp('https://youtu.be/dQw4w9WgXcQ',{outputDir:directory,quality:'360',dependencies:{ytDlpPath:'yt-dlp',denoPath:'deno'},run});assert.equal(attempts,2);
  }finally{await fsp.rm(directory,{recursive:true,force:true});}
});
