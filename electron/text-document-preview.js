const fsp=require('node:fs/promises');
const sharp=require('sharp');
const {textExtensions:SUBTITLE_TEXT_EXTENSIONS}=require('../src/subtitle-formats');

const TEXT_PREVIEW_DOCUMENT_EXTENSIONS=new Set(['TXT','MD','MARKDOWN','JSON','JSONC','YAML','YML',...SUBTITLE_TEXT_EXTENSIONS]);
function decodeTextDocumentBuffer(buffer,{partial=false}={}){
  if(buffer.length>=4&&buffer[0]===0&&buffer[1]===0&&buffer[2]===1&&buffer[3]===0xba)throw new Error('Bitmap subtitles cannot be read as text. Open this file in an external player.');
  let encoding='utf-8';
  if(buffer[0]===0xff&&buffer[1]===0xfe)encoding='utf-16le';
  else if(buffer[0]===0xfe&&buffer[1]===0xff)encoding='utf-16be';
  else if(buffer.length>=8){let even=0,odd=0;const pairs=Math.min(128,Math.floor(buffer.length/2));for(let i=0;i<pairs;i++){if(buffer[i*2]===0)even++;if(buffer[i*2+1]===0)odd++;}if(odd/pairs>.4&&even/pairs<.1)encoding='utf-16le';else if(even/pairs>.4&&odd/pairs<.1)encoding='utf-16be';}
  let text;try{text=new TextDecoder(encoding,{fatal:encoding==='utf-8'}).decode(buffer,{stream:partial});}catch{text=new TextDecoder('windows-1252').decode(buffer);}
  if(text.includes('\u0000'))throw new Error('Binary subtitle or document data cannot be displayed as text. Open this file externally.');
  return text;
}
function escapePreviewXml(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
async function createTextDocumentThumbnail(asset,target){
  const handle=await fsp.open(asset.path,'r');let content='';
  try{const buffer=Buffer.alloc(256*1024),{bytesRead}=await handle.read(buffer,0,buffer.length,0);content=decodeTextDocumentBuffer(buffer.subarray(0,bytesRead),{partial:true}).replace(/\r/g,'').replace(/\t/g,'  ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');}
  finally{await handle.close();}
  const extension=String(asset.extension||'TXT').toUpperCase(),colors={MD:'#7b61d1',MARKDOWN:'#7b61d1',JSON:'#d29c38',JSONC:'#d29c38',YAML:'#d05c68',YML:'#d05c68',TXT:'#4d86ba'},accent=colors[extension]||'#63738b',allLines=content.split('\n'),lines=allLines.slice(0,34).map((line)=>line.slice(0,76)),rows=lines.map((line,index)=>`<text x="72" y="${150+index*21}" fill="#777f8b" font-family="Consolas,monospace" font-size="14">${String(index+1).padStart(2,'0')}</text><text x="112" y="${150+index*21}" fill="#252a32" font-family="Consolas,monospace" font-size="16">${escapePreviewXml(line||' ')}</text>`).join(''),truncated=allLines.length>lines.length?'<text x="112" y="866" fill="#7a808a" font-family="Consolas,monospace" font-size="15">…</text>':'';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900"><rect width="720" height="900" rx="14" fill="#f4f3ef"/><rect width="720" height="92" fill="${accent}"/><text x="36" y="58" fill="#fff" font-family="Arial,sans-serif" font-size="28" font-weight="700">${escapePreviewXml(extension)}</text><text x="132" y="57" fill="#fff" opacity=".86" font-family="Arial,sans-serif" font-size="19">${escapePreviewXml(String(asset.filename||'').slice(0,46))}</text><line x1="96" y1="118" x2="96" y2="870" stroke="#d8d6d0" stroke-width="1"/>${rows}${truncated}</svg>`;
  await sharp(Buffer.from(svg)).jpeg({quality:82,chromaSubsampling:'4:4:4'}).toFile(target);
  return{ok:true,target,width:720,height:900,technicalMetadata:{format:'text-preview',sourceExtension:extension}};
}
module.exports={TEXT_PREVIEW_DOCUMENT_EXTENSIONS,createTextDocumentThumbnail,escapePreviewXml,decodeTextDocumentBuffer};
