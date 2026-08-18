'use strict';

const fsp = require('node:fs/promises');

const MAX_LIGHTROOM_PREVIEW_BYTES = 256 * 1024 * 1024;
const MIN_JPEG_BYTES = 128;
const SOF_MARKERS = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);

function jpegDimensions(buffer,start,end){
  let offset=start+2;
  while(offset+4<=end){
    if(buffer[offset]!==0xff){offset+=1;continue;}
    while(offset<end&&buffer[offset]===0xff)offset+=1;
    const marker=buffer[offset++];
    if(marker===0xd8||marker===0x01||(marker>=0xd0&&marker<=0xd9))continue;
    if(offset+2>end)return null;
    const length=buffer.readUInt16BE(offset);if(length<2||offset+length>end)return null;
    if(SOF_MARKERS.has(marker)&&length>=7){const height=buffer.readUInt16BE(offset+3),width=buffer.readUInt16BE(offset+5);return width&&height?{width,height}:null;}
    if(marker===0xda)break;
    offset+=length;
  }
  return null;
}

function embeddedJpegCandidates(buffer){
  if(!Buffer.isBuffer(buffer))return[];
  const candidates=[];
  for(let start=0;start+MIN_JPEG_BYTES<=buffer.length;start+=1){
    if(buffer[start]!==0xff||buffer[start+1]!==0xd8||buffer[start+2]!==0xff)continue;
    const endMarker=buffer.indexOf(Buffer.from([0xff,0xd9]),start+3);if(endMarker<0)break;
    const end=endMarker+2,length=end-start,dimensions=jpegDimensions(buffer,start,end);
    if(dimensions&&length>=MIN_JPEG_BYTES)candidates.push({start,end,length,...dimensions});
    start=endMarker+1;
  }
  return candidates;
}

async function extractLightroomPreview(source,targetBase){
  const handle=await fsp.open(source,'r');let temporaryPath=null;
  try{
    const stat=await handle.stat();if(!stat.size||stat.size>MAX_LIGHTROOM_PREVIEW_BYTES)return null;
    const buffer=await handle.readFile();if(buffer.length!==stat.size)return null;
    const candidates=embeddedJpegCandidates(buffer);if(!candidates.length)return null;
    candidates.sort((a,b)=>b.width*b.height-a.width*a.height||b.length-a.length);const selected=candidates[0],target=`${targetBase}.jpg`;
    temporaryPath=`${target}.${process.pid}.${Date.now()}.tmp`;await fsp.writeFile(temporaryPath,buffer.subarray(selected.start,selected.end),{flag:'wx'});await fsp.rm(target,{force:true});await fsp.rename(temporaryPath,target);temporaryPath=null;
    return{target,format:'jpeg',width:selected.width,height:selected.height,previewCount:candidates.length,sourceBytes:stat.size,previewBytes:selected.length};
  }finally{await handle.close();if(temporaryPath)await fsp.rm(temporaryPath,{force:true}).catch(()=>{});}
}

module.exports={extractLightroomPreview,embeddedJpegCandidates,jpegDimensions,MAX_LIGHTROOM_PREVIEW_BYTES};
