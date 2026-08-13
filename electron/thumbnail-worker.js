const { parentPort } = require('node:worker_threads');
const sharp = require('sharp');
const exifReader = require('exif-reader');
const fs=require('node:fs/promises'),zlib=require('node:zlib');
async function pngTextMetadata(source){let bytes;try{const stat=await fs.stat(source);if(stat.size>128*1024*1024)return null;bytes=await fs.readFile(source);}catch{return null;}if(bytes.length<8||bytes.subarray(1,4).toString()!=='PNG')return null;const result={};for(let offset=8;offset+12<=bytes.length;){const length=bytes.readUInt32BE(offset),type=bytes.subarray(offset+4,offset+8).toString('ascii'),data=bytes.subarray(offset+8,offset+8+length);offset+=12+length;if(length>2*1024*1024||!['tEXt','zTXt','iTXt'].includes(type))continue;try{let zero=data.indexOf(0),key=data.subarray(0,zero).toString('latin1'),text='';if(type==='tEXt')text=data.subarray(zero+1).toString('utf8');else if(type==='zTXt')text=zlib.inflateSync(data.subarray(zero+2),{maxOutputLength:2*1024*1024}).toString('utf8');else{const compressed=data[zero+1]===1;let cursor=zero+3;cursor=data.indexOf(0,cursor)+1;cursor=data.indexOf(0,cursor)+1;const payload=data.subarray(cursor);text=(compressed?zlib.inflateSync(payload,{maxOutputLength:2*1024*1024}):payload).toString('utf8');}if(/^(prompt|workflow|parameters)$/i.test(key)||/"(?:nodes|class_type|prompt|workflow)"/.test(text))result[key]=text.slice(0,500000);}catch{}}return Object.keys(result).length?result:null;}
function boundedEmbeddedText(buffers={}){const result={};for(const[name,value]of Object.entries(buffers)){if(!value||!Buffer.isBuffer(value)||value.length>2*1024*1024)continue;const text=value.toString('utf8').replace(/\0+$/,'').trim();if(!text||text.length>500000)continue;if(/^(prompt|workflow|parameters)$/i.test(name)||/"(?:nodes|class_type|prompt|workflow)"/.test(text))result[name]=text;}return Object.keys(result).length?result:null;}

parentPort.on('message', async ({ source, target }) => {
  try {
    const image = sharp(source, { failOn: 'none', limitInputPixels: 268402689 });
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
    const pngMetadata=metadata.format==='png'?await pngTextMetadata(source):null;
    parentPort.postMessage({
      ok: true,
      target,
      width: rotated ? metadata.height : metadata.width,
      height: rotated ? metadata.width : metadata.height,
      histogram,
      palette,
      perceptualHash,
      exif,
      embeddedMetadata: pngMetadata||boundedEmbeddedText({ exif:metadata.exif, xmp:metadata.xmp, iptc:metadata.iptc, tEXt:metadata.comments?Buffer.from(JSON.stringify(metadata.comments)):null }),
      technicalMetadata: { format: metadata.format, space: metadata.space, channels: metadata.channels, depth: metadata.depth, density: metadata.density || null, hasAlpha: metadata.hasAlpha, orientation: metadata.orientation || 1 },
      dominantColor: dominant ? `#${[dominant.r, dominant.g, dominant.b].map((value) => value.toString(16).padStart(2, '0')).join('')}` : null
    });
  } catch (error) {
    parentPort.postMessage({ ok: false, target, message: error.message });
  }
});
