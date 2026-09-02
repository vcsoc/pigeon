const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {ytDlpFormatSelectors,downloadYouTubeWithYtDlp}=require('../electron/yt-dlp-import');
const ytDlpSource=fs.readFileSync(path.join(__dirname,'..','electron','yt-dlp-import.js'),'utf8');

test('yt-dlp allows long chapter and high-quality downloads to finish',()=>{
  assert.match(ytDlpSource,/timeout=60\*60\*1000/);
  assert.match(ytDlpSource,/longer than 60 minutes/);
});

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
    assert.equal(calls.length,1);assert.equal(calls[0].command,'yt-dlp-test');assert.ok(calls[0].args.includes('youtube:player_client=web_embedded'));assert.ok(calls[0].args.includes('1M'));assert.ok(calls[0].args.includes('deno:deno-test'));assert.ok(calls[0].args.includes('ffmpeg-test'));assert.ok(calls[0].args.includes('--embed-metadata'));assert.ok(calls[0].args.includes('--embed-chapters'));assert.equal(await fsp.readFile(result.target,'utf8'),'video');assert.deepEqual(result.targets,[result.target]);assert.equal(result.format,'mp4');assert.equal(result.chapterMode,'embed');assert.equal(result.downloader,'yt-dlp');
  }finally{await fsp.rm(directory,{recursive:true,force:true});}
});

test('yt-dlp converts to MP3 and returns only numbered split chapter files',async()=>{
  const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-ytdlp-')),calls=[];
  try{
    const run=async(command,args)=>{calls.push({command,args});const template=args[args.lastIndexOf('-o')+1],prefix=path.basename(template).split('%')[0],main=path.join(directory,`${prefix}Chaptered audio [dQw4w9WgXcQ].mp3`);const intro=path.join(directory,`${prefix}Chaptered audio [dQw4w9WgXcQ] - 001 Intro.mp3`),lastChapter=path.join(directory,`${prefix}Chaptered audio [dQw4w9WgXcQ] - 002 Main.mp3`);await Promise.all([fsp.writeFile(main,'combined'),fsp.writeFile(intro,'intro'),fsp.writeFile(lastChapter,'main')]);return lastChapter;};
    const result=await downloadYouTubeWithYtDlp('https://youtu.be/dQw4w9WgXcQ',{outputDir:directory,format:'mp3',chapterMode:'split',dependencies:{ytDlpPath:'yt-dlp',denoPath:'deno'},ffmpegPath:'ffmpeg',run});
    const args=calls[0].args;assert.ok(args.includes('--extract-audio'));assert.ok(args.includes('--audio-format'));assert.ok(args.includes('mp3'));assert.ok(args.includes('--split-chapters'));assert.ok(args.some((item)=>String(item).startsWith('chapter:')));assert.equal(result.targets.length,2);assert.ok(result.targets.every((target)=>/ - 00[12] /.test(path.basename(target))));assert.equal(await fsp.readFile(result.targets[0],'utf8'),'intro');assert.equal(await fsp.readFile(result.targets[1],'utf8'),'main');assert.equal(result.format,'mp3');assert.equal(result.chapterMode,'split');assert.equal(await fsp.readFile(path.join(directory,path.basename(result.target)),'utf8'),'intro');
  }finally{await fsp.rm(directory,{recursive:true,force:true});}
});

test('yt-dlp retries a progressive selector after a retryable CDN rejection',async()=>{
  const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-ytdlp-'));let attempts=0;
  try{
    const run=async(_command,args)=>{attempts++;if(attempts===1)throw new Error('HTTP Error 403: Forbidden');const template=args[args.indexOf('-o')+1],prefix=path.basename(template).split('%')[0],target=path.join(path.dirname(template),`${prefix}Retry [dQw4w9WgXcQ].mp4`);await fsp.writeFile(target,'retry');return target;};
    await downloadYouTubeWithYtDlp('https://youtu.be/dQw4w9WgXcQ',{outputDir:directory,quality:'360',dependencies:{ytDlpPath:'yt-dlp',denoPath:'deno'},run});assert.equal(attempts,2);
  }finally{await fsp.rm(directory,{recursive:true,force:true});}
});
