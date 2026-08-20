const { parentPort } = require('node:worker_threads');
const sharp = require('sharp');
const exifReader = require('exif-reader');
const fs=require('node:fs/promises');
const {pngTextMetadata}=require('./embedded-metadata');
const {RAW_IMAGE_EXTENSION_SET:RAW_CAMERA_EXTENSIONS,HEIC_IMAGE_EXTENSION_SET}=require('./file-types');
const {decodeHeicToRaw}=require('./heic-preview');
let LibRawClass;
async function decodeRawCamera(source,proxyTarget){
  const {installNodeWebWorker}=await import('./node-web-worker.mjs');installNodeWebWorker();
  LibRawClass ||= (await import('libraw-wasm')).default;
  const stat=await fs.stat(source);if(stat.size>1024*1024*1024)throw new Error('RAW camera file exceeds the 1 GB preview safety limit');
  const bytes=new Uint8Array(await fs.readFile(source)),raw=new LibRawClass();
  try{
    await raw.open(bytes,{halfSize:true,useCameraWb:true,useAutoWb:false,outputBps:8,outputColor:1,userQual:2});
    const rawMetadata=await raw.metadata();
    let decoded;
    try{decoded=await raw.imageData();}catch{}
    if(decoded?.data?.length&&decoded.width&&decoded.height){
      const channels=Math.max(3,Math.min(4,Number(decoded.colors)||3));
      await sharp(Buffer.from(decoded.data.buffer,decoded.data.byteOffset,decoded.data.byteLength),{raw:{width:decoded.width,height:decoded.height,channels}}).rotate().resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true}).jpeg({quality:88,chromaSubsampling:'4:4:4'}).toFile(proxyTarget);
    }else{
      const thumbnail=await raw.thumbnailData();if(!thumbnail?.data?.length)throw new Error('RAW file contains no decodable image or embedded preview');
      const buffer=Buffer.from(thumbnail.data.buffer,thumbnail.data.byteOffset,thumbnail.data.byteLength),embedded=thumbnail.format==='jpeg'?sharp(buffer):sharp(buffer,{raw:{width:thumbnail.width,height:thumbnail.height,channels:Math.max(3,Math.min(4,Math.round(buffer.length/thumbnail.width/thumbnail.height)))}});
      await embedded.rotate().resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true}).jpeg({quality:88,chromaSubsampling:'4:4:4'}).toFile(proxyTarget);
    }
    return {path:proxyTarget,metadata:rawMetadata||{}};
  }finally{raw.dispose();}
}
function boundedEmbeddedText(buffers={}){const result={};for(const[name,value]of Object.entries(buffers)){if(!value||!Buffer.isBuffer(value)||value.length>2*1024*1024)continue;const text=value.toString('utf8').replace(/\0+$/,'').trim();if(!text||text.length>500000)continue;if(/^(prompt|workflow|parameters)$/i.test(name)||/"(?:nodes|class_type|prompt|workflow)"/.test(text))result[name]=text;}return Object.keys(result).length?result:null;}

parentPort.on('message', async ({source,target,rawProxyTarget,metadataOnly=false}) => {
  try {
    if(metadataOnly){parentPort.postMessage({ok:true,embeddedMetadata:await pngTextMetadata(source)});return;}
    const extension=require('node:path').extname(source).toLowerCase(),rawCamera=RAW_CAMERA_EXTENSIONS.has(extension),heic=HEIC_IMAGE_EXTENSION_SET.has(extension),rawPreview=rawCamera?await decodeRawCamera(source,rawProxyTarget):null,heicPreview=heic?await decodeHeicToRaw(source):null;
    const imageSource=rawPreview?.path||source;
    const image = heicPreview?sharp(heicPreview.data,{raw:{width:heicPreview.width,height:heicPreview.height,channels:heicPreview.channels},failOn:'none'}):sharp(imageSource, { failOn: 'none', limitInputPixels: 268402689 });
    const [metadata, stats, sample] = await Promise.all([
      image.metadata(),
      image.clone().stats(),
      image.clone().resize({ width: 64, height: 64, fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    ]);
    await image
      .rotate()
      .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#20232d' })
      .jpeg({ quality: 58, chromaSubsampling: '4:2:0', mozjpeg: true })
      .toFile(target);
    const rotated = metadata.orientation >= 5 && metadata.orientation <= 8;
    const dominant = stats.dominant;
    const histogram = Array(32).fill(0);
    const colorBuckets = new Map();
    for (let index = 0; index < sample.data.length; index += sample.info.channels) {
      const r = sample.data[index], g = sample.data[index + 1], b = sample.data[index + 2];
      const luminance = r * .2126 + g * .7152 + b * .0722;
      histogram[Math.min(31, Math.floor(luminance / 8))] += 1;
      const bucket = [r, g, b].map((value) => Math.min(255, Math.round(value / 32) * 32)).map((value) => value.toString(16).padStart(2, '0')).join('');
      colorBuckets.set(bucket, (colorBuckets.get(bucket) || 0) + 1);
    }
    const palette = [...colorBuckets].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([color]) => `#${color}`);
    const cells = [];
    for (let cellY = 0; cellY < 8; cellY += 1) for (let cellX = 0; cellX < 8; cellX += 1) {
      let sum = 0, count = 0;
      const startY = Math.floor(cellY * sample.info.height / 8), endY = Math.max(startY + 1, Math.floor((cellY + 1) * sample.info.height / 8));
      const startX = Math.floor(cellX * sample.info.width / 8), endX = Math.max(startX + 1, Math.floor((cellX + 1) * sample.info.width / 8));
      for (let y = startY; y < endY; y += 1) for (let x = startX; x < endX; x += 1) {
        const offset = (y * sample.info.width + x) * sample.info.channels;
        sum += sample.data[offset] * .2126 + sample.data[offset + 1] * .7152 + sample.data[offset + 2] * .0722; count += 1;
      }
      cells.push(sum / count);
    }
    const average = cells.reduce((sum, value) => sum + value, 0) / cells.length;
    const perceptualHash = cells.reduce((bits, value) => (bits << 1n) | (value >= average ? 1n : 0n), 0n).toString(16).padStart(16, '0');
    let exif = null;
    try {
      const parsed = metadata.exif ? exifReader(metadata.exif) : null;
      if (parsed) exif = JSON.parse(JSON.stringify(parsed, (_key, value) => value instanceof Date ? value.toISOString() : Buffer.isBuffer(value) ? undefined : typeof value === 'bigint' ? Number(value) : value));
    } catch {}
    const pngMetadata=metadata.format==='png'?await pngTextMetadata(imageSource):null;
    parentPort.postMessage({
      ok: true,
      target,
      proxyPath:rawCamera?imageSource:null,
      proxyVersion:rawCamera?3:null,
      width: rotated ? metadata.height : metadata.width,
      height: rotated ? metadata.width : metadata.height,
      histogram,
      palette,
      perceptualHash,
      exif:exif||(rawCamera?{Image:{Make:rawPreview.metadata.camera_make||null,Model:rawPreview.metadata.camera_model||null},Photo:{ISOSpeedRatings:rawPreview.metadata.iso_speed||null,ExposureTime:rawPreview.metadata.shutter||null,FNumber:rawPreview.metadata.aperture||null,FocalLength:rawPreview.metadata.focal_len||null},DateTimeOriginal:rawPreview.metadata.timestamp instanceof Date?rawPreview.metadata.timestamp.toISOString():rawPreview.metadata.timestamp||null}:null),
      embeddedMetadata: pngMetadata||boundedEmbeddedText({ exif:metadata.exif, xmp:metadata.xmp, iptc:metadata.iptc, tEXt:metadata.comments?Buffer.from(JSON.stringify(metadata.comments)):null }),
      technicalMetadata: { format: rawCamera?'camera-raw':heic?'heic':metadata.format, decodedFormat:rawCamera?metadata.format:heic?'raw-rgba':null, sourceExtension:rawCamera||heic?extension.slice(1).toUpperCase():null, imageCount:heic?heicPreview.imageCount:null, cameraMake:rawCamera?rawPreview.metadata.camera_make||null:null, cameraModel:rawCamera?rawPreview.metadata.camera_model||null:null, space: metadata.space, channels: metadata.channels, depth: metadata.depth, density: metadata.density || null, hasAlpha: metadata.hasAlpha, orientation: metadata.orientation || 1 },
      dominantColor: dominant ? `#${[dominant.r, dominant.g, dominant.b].map((value) => value.toString(16).padStart(2, '0')).join('')}` : null
    });
  } catch (error) {
    parentPort.postMessage({ ok: false, target, message: error.message });
  }
});
