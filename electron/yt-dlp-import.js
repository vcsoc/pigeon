'use strict';

const fsp=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');

const QUALITY_ORDER=[1080,720,480,360,240];
let dependencyProbe;

function ytDlpFormatSelectors(quality){
  const preferred=Number(quality)||720,qualities=QUALITY_ORDER.filter((value)=>value<=preferred);
  const adaptive=qualities.flatMap((value)=>[`bestvideo[ext=mp4][vcodec^=avc1][format_note^=${value}p]+bestaudio[ext=m4a]`,`bestvideo[ext=mp4][format_note^=${value}p]+bestaudio[ext=m4a]`,`best[ext=mp4][format_note^=${value}p]`]).join('/');
  const progressive=qualities.map((value)=>`best[ext=mp4][format_note^=${value}p]`).join('/');
  return[adaptive,progressive];
}

function capture(command,args,{timeout=12000,env=process.env}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],env});let stdout='',stderr='',settled=false;
    const timer=setTimeout(()=>{child.kill();finish(new Error(`${command} did not respond`));},timeout);timer.unref?.();
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(result);};
    child.stdout.on('data',(chunk)=>{stdout=`${stdout}${chunk}`.slice(-16000);});child.stderr.on('data',(chunk)=>{stderr=`${stderr}${chunk}`.slice(-16000);});
    child.once('error',(error)=>finish(error));child.once('close',(code)=>code===0?finish(null,{stdout:stdout.trim(),stderr:stderr.trim()}):finish(new Error((stderr||stdout).trim()||`${command} exited with code ${code}`)));
  });
}

async function findExecutable(directory,filename,depth=4){
  if(depth<0)return null;const entries=await fsp.readdir(directory,{withFileTypes:true}).catch(()=>[]),direct=entries.find((entry)=>entry.isFile()&&entry.name.toLowerCase()===filename.toLowerCase());if(direct)return path.join(directory,direct.name);
  for(const entry of entries)if(entry.isDirectory()){const found=await findExecutable(path.join(directory,entry.name),filename,depth-1);if(found)return found;}return null;
}
async function resolveCommand(configured,name){
  const candidates=[configured];if(process.platform==='win32'&&process.env.LOCALAPPDATA){const local=process.env.LOCALAPPDATA;candidates.push(path.join(local,'Microsoft','WinGet','Links',`${name}.exe`));const packages=path.join(local,'Microsoft','WinGet','Packages'),prefix=name==='yt-dlp'?'yt-dlp.yt-dlp_':'DenoLand.Deno_',entries=await fsp.readdir(packages,{withFileTypes:true}).catch(()=>[]),directory=entries.find((entry)=>entry.isDirectory()&&entry.name.startsWith(prefix));if(directory)candidates.push(await findExecutable(path.join(packages,directory.name),`${name}.exe`));}
  let lastError;for(const candidate of [...new Set(candidates.filter(Boolean))])try{await capture(candidate,['--version']);return candidate;}catch(error){lastError=error;}throw lastError||new Error(`${name} is unavailable`);
}
async function resolveDependencies({ytDlpPath=process.env.YT_DLP_PATH||'yt-dlp',denoPath=process.env.DENO_PATH||'deno'}={}){
  if(!dependencyProbe)dependencyProbe=(async()=>{try{const[resolvedYtDlp,resolvedDeno]=await Promise.all([resolveCommand(ytDlpPath,'yt-dlp'),resolveCommand(denoPath,'deno')]);return{ytDlpPath:resolvedYtDlp,denoPath:resolvedDeno};}catch(error){error.code='YOUTUBE_DOWNLOADER_UNAVAILABLE';throw error;}})();
  try{return await dependencyProbe;}catch(error){dependencyProbe=null;throw error;}
}

function runDownload(command,args,{timeout=60*60*1000,env=process.env,onProgress,onProcess,onTitle}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],env});onProcess?.(child);let output='',errors='',buffer='',settled=false;
    const consume=(chunk)=>{buffer+=chunk;const lines=buffer.split(/\r?\n/);buffer=lines.pop()||'';for(const line of lines){const file=line.match(/__FILE__:(.+)$/);if(file)output=file[1].trim();const title=line.match(/__TITLE__:(.+)$/);if(title)onTitle?.(title[1].trim());const progress=line.match(/__PROGRESS__:\s*([\d.]+)%/);if(progress)onProgress?.(Math.max(0,Math.min(100,Number(progress[1])||0)));}};
    const timer=setTimeout(()=>{child.kill();finish(new Error('YouTube download took longer than 60 minutes'));},timeout);timer.unref?.();
    const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);onProcess?.(null);error?reject(error):resolve(output);};
    child.stdout.on('data',consume);child.stderr.on('data',(chunk)=>{errors=`${errors}${chunk}`.slice(-24000);consume(chunk);});child.once('error',finish);child.once('close',(code)=>{if(buffer)consume('\n');code===0&&output?finish():finish(new Error(errors.trim()||`yt-dlp stopped (${code})`));});
  });
}

async function cleanupAttempt(outputDir,prefix){for(const entry of await fsp.readdir(outputDir).catch(()=>[]))if(entry.startsWith(prefix))await fsp.rm(path.join(outputDir,entry),{force:true}).catch(()=>{});}

async function completedAttemptFiles(outputDir,prefix){const root=path.resolve(outputDir),entries=await fsp.readdir(root,{withFileTypes:true}).catch(()=>[]);return entries.filter((entry)=>entry.isFile()&&entry.name.startsWith(prefix)&&!/[.](?:part|ytdl|temp)$/i.test(entry.name)).map((entry)=>path.join(root,entry.name)).sort((a,b)=>path.basename(a).localeCompare(path.basename(b),undefined,{numeric:true}));}

async function downloadYouTubeWithYtDlp(urlValue,{outputDir,quality='720',format='mp4',chapterMode='embed',maxBytes=250*1024*1024,ffmpegPath,onProgress,onProcess,onTitle,dependencies,run=runDownload}={}){
  const resolved=dependencies||await resolveDependencies(),mediaFormat=format==='mp3'?'mp3':'mp4',chapters=chapterMode==='split'?'split':'embed',prefix=`${Date.now()}-${Math.random().toString(16).slice(2,10)}-`,template=path.join(outputDir,`${prefix}%(title).150B [%(id)s].%(ext)s`),chapterTemplate=path.join(outputDir,`${prefix}%(title).120B [%(id)s] - %(section_number)03d %(section_title).90B.%(ext)s`),formats=mediaFormat==='mp3'?['bestaudio/best','249/139/18','139/18']:ytDlpFormatSelectors(quality);
  await fsp.mkdir(outputDir,{recursive:true});let lastError;
  for(let attempt=0;attempt<formats.length;attempt+=1){
    const mediaArgs=mediaFormat==='mp3'?['--extract-audio','--audio-format','mp3','--audio-quality','0']:['--merge-output-format','mp4'],chapterArgs=['--embed-metadata','--embed-chapters',...(chapters==='split'?['--split-chapters','-o',`chapter:${chapterTemplate}`]:[])],args=['--encoding','utf-8','--js-runtimes',`deno:${resolved.denoPath}`,'--newline','--no-playlist','--extractor-args','youtube:player_client=web_embedded','--http-chunk-size','1M',...mediaArgs,...chapterArgs,'--format',formats[attempt],'--retries','10','--fragment-retries','10','--retry-sleep','http:exp=1:10','--max-filesize',String(maxBytes),'--progress','--progress-template','download:__PROGRESS__:%(progress._percent_str)s','--print','before_dl:__TITLE__:%(title)s','--print','after_move:__FILE__:%(filepath)s','--windows-filenames'];
    if(ffmpegPath)args.push('--ffmpeg-location',ffmpegPath);args.push('-o',template,urlValue);
    try{
      const reported=await run(resolved.ytDlpPath,args,{onProgress,onProcess,onTitle}),reportedTarget=path.resolve(reported);
      if(path.dirname(reportedTarget)!==path.resolve(outputDir)||!path.basename(reportedTarget).startsWith(prefix))throw new Error('YouTube downloader reported an unsafe output path');
      const reportedStat=await fsp.stat(reportedTarget);if(reportedStat.size>maxBytes){await cleanupAttempt(outputDir,prefix);throw new Error('YouTube download exceeds the 250 MB safety limit');}
      let targets=await completedAttemptFiles(outputDir,prefix);if(chapters==='split'){const chapterTargets=targets.filter((target)=>/ - \d{3} /.test(path.basename(target)));await Promise.all(targets.filter((target)=>!chapterTargets.includes(target)).map((target)=>fsp.rm(target,{force:true})));targets=chapterTargets;if(!targets.length)throw new Error('This YouTube video did not provide chapters to split');}else targets=[reportedTarget];
      const title=path.basename(reportedTarget,path.extname(reportedTarget)).replace(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`),'');return{target:targets[0],targets,title,quality:mediaFormat==='mp4'?String(quality):null,format:mediaFormat,chapterMode:chapters,downloader:'yt-dlp'};
    }catch(error){lastError=error;await cleanupAttempt(outputDir,prefix);if(!/HTTP Error (?:403|429)|timed? out|connection reset|temporary failure|requested format is not available/i.test(error.message)||attempt===formats.length-1)throw error;await new Promise((resolve)=>setTimeout(resolve,1000));}
  }
  throw lastError||new Error('YouTube download failed');
}

module.exports={QUALITY_ORDER,ytDlpFormatSelectors,capture,resolveDependencies,runDownload,downloadYouTubeWithYtDlp};
