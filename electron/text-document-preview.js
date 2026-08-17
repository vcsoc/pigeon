const fsp=require('node:fs/promises');
const sharp=require('sharp');

const TEXT_PREVIEW_DOCUMENT_EXTENSIONS=new Set(['TXT','MD','MARKDOWN','JSON','JSONC','YAML','YML']);
function escapePreviewXml(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
async function createTextDocumentThumbnail(asset,target){
  const handle=await fsp.open(asset.path,'r');let content='';
  try{const buffer=Buffer.alloc(256*1024),{bytesRead}=await handle.read(buffer,0,buffer.length,0);content=buffer.subarray(0,bytesRead).toString('utf8').replace(/\r/g,'').replace(/\t/g,'  ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');}
  finally{await handle.close();}
  const extension=String(asset.extension||'TXT').toUpperCase(),colors={MD:'#7b61d1',MARKDOWN:'#7b61d1',JSON:'#d29c38',JSONC:'#d29c38',YAML:'#d05c68',YML:'#d05c68',TXT:'#4d86ba'},accent=colors[extension]||'#63738b',allLines=content.split('\n'),lines=allLines.slice(0,34).map((line)=>line.slice(0,76)),rows=lines.map((line,index)=>`<text x="72" y="${150+index*21}" fill="#777f8b" font-family="Consolas,monospace" font-size="14">${String(index+1).padStart(2,'0')}</text><text x="112" y="${150+index*21}" fill="#252a32" font-family="Consolas,monospace" font-size="16">${escapePreviewXml(line||' ')}</text>`).join(''),truncated=allLines.length>lines.length?'<text x="112" y="866" fill="#7a808a" font-family="Consolas,monospace" font-size="15">…</text>':'';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900"><rect width="720" height="900" rx="14" fill="#f4f3ef"/><rect width="720" height="92" fill="${accent}"/><text x="36" y="58" fill="#fff" font-family="Arial,sans-serif" font-size="28" font-weight="700">${escapePreviewXml(extension)}</text><text x="132" y="57" fill="#fff" opacity=".86" font-family="Arial,sans-serif" font-size="19">${escapePreviewXml(String(asset.filename||'').slice(0,46))}</text><line x1="96" y1="118" x2="96" y2="870" stroke="#d8d6d0" stroke-width="1"/>${rows}${truncated}</svg>`;
  await sharp(Buffer.from(svg)).jpeg({quality:82,chromaSubsampling:'4:4:4'}).toFile(target);
  return{ok:true,target,width:720,height:900,technicalMetadata:{format:'text-preview',sourceExtension:extension}};
}
module.exports={TEXT_PREVIEW_DOCUMENT_EXTENSIONS,createTextDocumentThumbnail,escapePreviewXml};
