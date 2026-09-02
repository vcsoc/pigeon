'use strict';

const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const yauzl=require('yauzl');
const yazl=require('yazl');

const PIGEON_COLLECTION_MIME='application/x-pigeon';
const FORMAT='pigeon-collection';
const FORMAT_VERSION=1;
const DEFAULT_LIMITS=Object.freeze({maxFiles:5000,maxIndividualSize:8*1024**3,maxTotalSize:64*1024**3,maxCompressionRatio:250,maxManifestSize:5*1024**2,maxPreviewBytes:25*1024**2,maxPreviewCount:200});

function archivePath(value){
  const input=String(value||'').replace(/\\/g,'/');
  if(!input||input.startsWith('/')||/^[A-Za-z]:/.test(input)||input.includes('\0'))throw new Error(`Unsafe Pigeon Collection path: ${input||'(empty)'}`);
  const parts=input.split('/');if(parts.some((part)=>!part||part==='.'||part==='..'))throw new Error(`Unsafe Pigeon Collection path: ${input}`);
  return parts.join('/');
}
function safeFilename(value,fallback='file'){
  const name=path.basename(String(value||'').replace(/\\/g,'/')).replace(/[\x00-\x1f<>:"/\\|?*]/g,'_').replace(/[. ]+$/g,'').slice(0,220);
  return name||fallback;
}
function normalizedRelativePath(value){
  if(!value)return'';const normalized=archivePath(String(value).replace(/^\/+|\/+$/g,''));return normalized.split('/').map((part)=>safeFilename(part,'folder')).join('/');
}
function limitsWith(overrides={}){return{...DEFAULT_LIMITS,...overrides};}
function sha256File(filePath){return new Promise((resolve,reject)=>{const hash=crypto.createHash('sha256'),stream=fs.createReadStream(filePath);stream.on('data',(chunk)=>hash.update(chunk));stream.once('error',reject);stream.once('end',()=>resolve(hash.digest('hex')));});}
function zipFinished(zipFile,target){return new Promise((resolve,reject)=>{const output=fs.createWriteStream(target,{flags:'wx'});zipFile.outputStream.once('error',reject);output.once('error',reject);output.once('close',resolve);zipFile.outputStream.pipe(output);zipFile.end();});}

async function createCollection({name,files,destination,applicationVersion='0.0.0',limits={},onProgress=()=>{},isCancelled=()=>false,checkpoint=async()=>true}){
  const bounded=limitsWith(limits),items=Array.isArray(files)?files:[];
  if(!items.length)throw new Error('Select at least one file to create a Pigeon Collection');
  if(items.length>bounded.maxFiles)throw new Error(`Pigeon Collections support up to ${bounded.maxFiles.toLocaleString()} files`);
  const collectionName=String(name||'').trim()||'Pigeon Collection',target=path.resolve(String(destination||''));
  if(!target)throw new Error('Choose where to save the Pigeon Collection');
  const prepared=[];let totalSize=0;
  for(let index=0;index<items.length;index+=1){
    if(isCancelled()||!(await checkpoint()))throw Object.assign(new Error('Pigeon Collection export cancelled'),{code:'CANCELLED'});
    const item=items[index],sourcePath=path.resolve(String(item.sourcePath||item.path||'')),stat=await fsp.stat(sourcePath);
    if(!stat.isFile())throw new Error(`${path.basename(sourcePath)} is not a regular file`);
    if(stat.size>bounded.maxIndividualSize)throw new Error(`${path.basename(sourcePath)} exceeds the collection file-size limit`);
    totalSize+=stat.size;if(totalSize>bounded.maxTotalSize)throw new Error('The selected files exceed the Pigeon Collection size limit');
    onProgress({phase:'hashing',completed:index,total:items.length,filename:path.basename(sourcePath)});
    const id=crypto.randomUUID(),originalName=safeFilename(item.originalName||path.basename(sourcePath),id),payloadPath=archivePath(`files/${id}/${originalName}`),sha256=await sha256File(sourcePath),relativePath=normalizedRelativePath(item.relativePath||'');
    let thumbnail=null;if(item.thumbnailPath){try{const thumbnailStat=await fsp.stat(item.thumbnailPath);if(thumbnailStat.isFile()&&thumbnailStat.size<=5*1024**2)thumbnail=archivePath(`thumbnails/${id}${path.extname(item.thumbnailPath).toLowerCase()||'.jpg'}`);}catch{}}
    prepared.push({id,sourcePath,thumbnailSource:thumbnail?item.thumbnailPath:null,manifest:{id,path:payloadPath,originalName,mimeType:String(item.mimeType||'application/octet-stream'),size:stat.size,sha256,relativePath,thumbnail}});
  }
  const manifest={format:FORMAT,formatVersion:FORMAT_VERSION,name:collectionName,id:crypto.randomUUID(),createdAt:new Date().toISOString(),createdBy:{application:'Pigeon',version:String(applicationVersion)},files:prepared.map((item)=>item.manifest)};
  await fsp.mkdir(path.dirname(target),{recursive:true});const temporary=path.join(path.dirname(target),`.${path.basename(target)}.${crypto.randomUUID()}.tmp`),zipFile=new yazl.ZipFile();
  try{
    prepared.forEach((item,index)=>{zipFile.addFile(item.sourcePath,item.manifest.path,{compress:true});if(item.thumbnailSource)zipFile.addFile(item.thumbnailSource,item.manifest.thumbnail,{compress:true});onProgress({phase:'packaging',completed:index+1,total:prepared.length,filename:item.manifest.originalName});});
    zipFile.addBuffer(Buffer.from(`${JSON.stringify(manifest,null,2)}\n`),'manifest.json',{compress:true});await zipFinished(zipFile,temporary);
    if(isCancelled())throw Object.assign(new Error('Pigeon Collection export cancelled'),{code:'CANCELLED'});
    try{await fsp.rename(temporary,target);}catch(error){if(process.platform!=='win32'||!['EEXIST','EPERM'].includes(error.code))throw error;await fsp.rm(target,{force:true});await fsp.rename(temporary,target);}onProgress({phase:'complete',completed:prepared.length,total:prepared.length,filename:path.basename(target)});
    return{path:target,name:collectionName,files:prepared.length,size:totalSize,manifest};
  }catch(error){await fsp.rm(temporary,{force:true}).catch(()=>{});throw error;}
}

function openZip(filePath){return new Promise((resolve,reject)=>yauzl.open(filePath,{lazyEntries:true,decodeStrings:true,validateEntrySizes:true,strictFileNames:false},(error,zip)=>error?reject(error):resolve(zip)));}
function entryIsSymlink(entry){const mode=(entry.externalFileAttributes>>>16)&0xffff;return(mode&0o170000)===0o120000;}
function readEntry(zip,entry,maxBytes){return new Promise((resolve,reject)=>zip.openReadStream(entry,(error,stream)=>{if(error){reject(error);return;}const chunks=[];let size=0;stream.on('data',(chunk)=>{size+=chunk.length;if(size>maxBytes){stream.destroy(new Error(`Archive entry exceeds ${maxBytes} bytes`));return;}chunks.push(chunk);});stream.once('error',reject);stream.once('end',()=>resolve(Buffer.concat(chunks)));}));}
async function catalogCollection(filePath,limits={}){
  const bounded=limitsWith(limits),zip=await openZip(filePath),entries=new Map();let manifestBuffer=null,total=0,fileCount=0;
  try{await new Promise((resolve,reject)=>{zip.once('error',reject);zip.once('end',resolve);zip.on('entry',async(entry)=>{try{const name=archivePath(entry.fileName.replace(/\/$/,''));if(entries.has(name.toLowerCase()))throw new Error(`Duplicate archive path: ${name}`);if(entryIsSymlink(entry))throw new Error(`Symbolic links are not allowed: ${name}`);if(!entry.fileName.endsWith('/')){fileCount+=1;total+=entry.uncompressedSize;if(fileCount>bounded.maxFiles*2+1)throw new Error('Pigeon Collection contains too many entries');if(entry.uncompressedSize>bounded.maxIndividualSize)throw new Error(`${name} exceeds the individual size limit`);if(total>bounded.maxTotalSize+bounded.maxPreviewBytes+bounded.maxManifestSize)throw new Error('Pigeon Collection exceeds the uncompressed size limit');if(entry.uncompressedSize>0&&entry.uncompressedSize/Math.max(1,entry.compressedSize)>bounded.maxCompressionRatio)throw new Error(`${name} exceeds the compression-ratio limit`);if(entry.generalPurposeBitFlag&1)throw new Error('Encrypted archive entries are not supported');entries.set(name.toLowerCase(),{name,entry});if(name==='manifest.json')manifestBuffer=await readEntry(zip,entry,bounded.maxManifestSize);}zip.readEntry();}catch(error){reject(error);zip.close();}});zip.readEntry();});}finally{zip.close();}
  if(!manifestBuffer)throw new Error('This is not a Pigeon Collection: manifest.json is missing');let manifest;try{manifest=JSON.parse(manifestBuffer.toString('utf8'));}catch{throw new Error('The Pigeon Collection manifest is malformed');}
  validateManifest(manifest,bounded);return{manifest,entries,bounded};
}
function validateManifest(manifest,limits=DEFAULT_LIMITS){
  if(!manifest||manifest.format!==FORMAT)throw new Error('This archive is not a Pigeon Collection');
  if(manifest.formatVersion>FORMAT_VERSION)throw new Error('This Pigeon Collection was created using a newer version of Pigeon and cannot be opened by this version');
  if(manifest.formatVersion!==FORMAT_VERSION)throw new Error('Unsupported Pigeon Collection format version');
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(typeof manifest.name!=='string'||!manifest.name.trim()||!uuid.test(String(manifest.id||''))||!Array.isArray(manifest.files)||!manifest.createdAt||!Number.isFinite(Date.parse(manifest.createdAt)))throw new Error('The Pigeon Collection manifest is missing or has invalid required fields');
  if(manifest.files.length>limits.maxFiles)throw new Error('The Pigeon Collection manifest contains too many files');
  const ids=new Set(),paths=new Set();for(const file of manifest.files){if(!file||!uuid.test(String(file.id||''))||ids.has(file.id)||typeof file.originalName!=='string'||!file.originalName||!Number.isSafeInteger(file.size)||file.size<0||!/^[a-f0-9]{64}$/i.test(String(file.sha256||'')))throw new Error('The Pigeon Collection manifest contains an invalid file record');const itemPath=archivePath(file.path);if(!itemPath.startsWith('files/')||paths.has(itemPath.toLowerCase()))throw new Error('The Pigeon Collection manifest contains a conflicting file path');if(file.thumbnail&&!archivePath(file.thumbnail).startsWith('thumbnails/'))throw new Error('The Pigeon Collection manifest contains an invalid thumbnail path');if(file.relativePath)normalizedRelativePath(file.relativePath);ids.add(file.id);paths.add(itemPath.toLowerCase());}
  return manifest;
}
async function verifyPayloads(filePath,catalog,{includePreviews=true}={}){
  const expected=new Map(catalog.manifest.files.map((file)=>[file.path.toLowerCase(),file])),results=new Map(catalog.manifest.files.map((file)=>[file.id,{...file,status:'missing',error:'File is missing from the collection'}])),previewPaths=new Map();
  if(includePreviews)for(const file of catalog.manifest.files)if(file.thumbnail)previewPaths.set(file.thumbnail.toLowerCase(),file.id);
  const zip=await openZip(filePath);let previewBytes=0,previewCount=0;
  try{await new Promise((resolve,reject)=>{zip.once('error',reject);zip.once('end',resolve);zip.on('entry',(entry)=>{const key=String(entry.fileName).replace(/\\/g,'/').replace(/\/$/,'').toLowerCase(),file=expected.get(key),previewId=previewPaths.get(key);if(!file&&!previewId){zip.readEntry();return;}zip.openReadStream(entry,(error,stream)=>{if(error){reject(error);return;}if(file){const hash=crypto.createHash('sha256');let size=0;stream.on('data',(chunk)=>{size+=chunk.length;hash.update(chunk);});stream.once('error',reject);stream.once('end',()=>{const digest=hash.digest('hex'),valid=size===file.size&&digest.toLowerCase()===file.sha256.toLowerCase();results.set(file.id,{...file,status:valid?'valid':'corrupt',error:valid?'':size!==file.size?'File size does not match the manifest':'SHA-256 integrity check failed'});zip.readEntry();});}else{const chunks=[];let size=0,allowed=previewCount<catalog.bounded.maxPreviewCount&&previewBytes<catalog.bounded.maxPreviewBytes;stream.on('data',(chunk)=>{size+=chunk.length;if(allowed&&previewBytes+size<=catalog.bounded.maxPreviewBytes)chunks.push(chunk);else allowed=false;});stream.once('error',reject);stream.once('end',()=>{if(allowed){const result=results.get(previewId);if(result){const extension=path.extname(entry.fileName).toLowerCase(),mime=extension==='.webp'?'image/webp':extension==='.png'?'image/png':'image/jpeg';result.previewDataUrl=`data:${mime};base64,${Buffer.concat(chunks).toString('base64')}`;previewBytes+=size;previewCount+=1;}}zip.readEntry();});}});});zip.readEntry();});}finally{zip.close();}
  return catalog.manifest.files.map((file)=>results.get(file.id));
}
async function inspectCollection(filePath,options={}){const resolved=path.resolve(filePath),stat=await fsp.stat(resolved);if(!stat.isFile())throw new Error('The Pigeon Collection does not exist');const catalog=await catalogCollection(resolved,options.limits),files=await verifyPayloads(resolved,catalog,options);return{path:resolved,mimeType:PIGEON_COLLECTION_MIME,name:catalog.manifest.name,id:catalog.manifest.id,createdAt:catalog.manifest.createdAt,createdBy:catalog.manifest.createdBy,formatVersion:catalog.manifest.formatVersion,size:stat.size,files,validFiles:files.filter((file)=>file.status==='valid').length,invalidFiles:files.filter((file)=>file.status!=='valid').length};}
async function extractCollectionFiles(filePath,selectedIds,destination,{limits={}}={}){
  const catalog=await catalogCollection(path.resolve(filePath),limits),selected=new Set((selectedIds||[]).map(String)),expected=new Map(catalog.manifest.files.filter((file)=>selected.has(file.id)).map((file)=>[file.path.toLowerCase(),file]));if(!expected.size)return[];
  await fsp.mkdir(destination,{recursive:true,mode:0o700});const outputs=[],zip=await openZip(filePath);
  try{await new Promise((resolve,reject)=>{zip.once('error',reject);zip.once('end',resolve);zip.on('entry',(entry)=>{const file=expected.get(String(entry.fileName).replace(/\\/g,'/').toLowerCase());if(!file){zip.readEntry();return;}zip.openReadStream(entry,(error,stream)=>{if(error){reject(error);return;}const targetDirectory=path.join(destination,file.id),target=path.join(targetDirectory,safeFilename(file.originalName,file.id)),hash=crypto.createHash('sha256');let size=0;fsp.mkdir(targetDirectory,{recursive:true,mode:0o700}).then(()=>{const output=fs.createWriteStream(target,{flags:'wx',mode:0o600});output.once('error',reject);output.once('finish',()=>{const digest=hash.digest('hex');if(size!==file.size||digest.toLowerCase()!==file.sha256.toLowerCase()){fsp.rm(target,{force:true}).finally(()=>reject(new Error(`${file.originalName} failed its integrity check`)));return;}outputs.push({id:file.id,path:target,originalName:file.originalName,relativePath:file.relativePath||''});zip.readEntry();});stream.pipe(output);}).catch(reject);stream.on('data',(chunk)=>{size+=chunk.length;hash.update(chunk);});stream.once('error',reject);});});zip.readEntry();});}finally{zip.close();}
  if(outputs.length!==expected.size)throw new Error('One or more selected files are missing from the Pigeon Collection');return outputs;
}

module.exports={PIGEON_COLLECTION_MIME,FORMAT,FORMAT_VERSION,DEFAULT_LIMITS,archivePath,safeFilename,validateManifest,createCollection,inspectCollection,extractCollectionFiles};
