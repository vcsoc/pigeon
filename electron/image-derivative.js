'use strict';

const path = require('node:path');
const sharp = require('sharp');

const OUTPUT_FORMATS = new Set(['png','jpeg','webp']);

function outputFormat(value, filePath = '') {
  const requested=String(value||'').toLowerCase().replace(/^jpg$/,'jpeg');
  if(OUTPUT_FORMATS.has(requested))return requested;
  const extension=path.extname(filePath).slice(1).toLowerCase().replace(/^jpg$/,'jpeg');
  return OUTPUT_FORMATS.has(extension)?extension:'png';
}

function normalizedAdjustments(input={}){
  return{
    rotate:[0,90,180,270].includes(Number(input.rotate))?Number(input.rotate):0,
    flip:Boolean(input.flip),grayscale:Boolean(input.grayscale),negative:Boolean(input.negative),sepia:Boolean(input.sepia),
    brightness:Math.max(.1,Math.min(3,Number(input.brightness)||1)),
    contrast:Math.max(.1,Math.min(3,Number(input.contrast)||1))
  };
}

function normalizedCrop(crop,width,height){
  if(!crop||!width||!height)return null;
  const normalized=Boolean(crop.normalized),x=normalized?Number(crop.x)*width:Number(crop.x),y=normalized?Number(crop.y)*height:Number(crop.y),w=normalized?Number(crop.width)*width:Number(crop.width),h=normalized?Number(crop.height)*height:Number(crop.height),left=Math.max(0,Math.min(width-1,Math.round(x)||0)),top=Math.max(0,Math.min(height-1,Math.round(y)||0));
  return{left,top,width:Math.max(1,Math.min(width-left,Math.round(w)||width-left)),height:Math.max(1,Math.min(height-top,Math.round(h)||height-top))};
}

function escapeSvgText(value){return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function annotationSvg(item,index){const color=/^#[0-9a-f]{6}$/i.test(item.color||'')?item.color:'#ff3b30',rotation=Number(item.rotation)||0;if(item.type==='rect'){const x=Number(item.x)||0,y=Number(item.y)||0,width=Number(item.width)||0,height=Number(item.height)||0;return`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${color}" stroke-width="${Number(item.stroke)||4}" transform="rotate(${rotation} ${x+width/2} ${y+height/2})"/>`;}if(item.type==='text'){const x=Number(item.x)||0,y=Number(item.y)||0,size=Number(item.size)||28,width=Math.max(size*1.5,Number(item.width)||size*Math.max(1,String(item.text||'').length)*.68),bend=Number(item.bend)||0,text=escapeSvgText(item.text);if(bend){const pathId=`text-curve-${index}`,baseline=y+size,controlY=baseline-bend*size*.02;return`<path id="${pathId}" d="M ${x} ${baseline} Q ${x+width/2} ${controlY} ${x+width} ${baseline}" fill="none"/><text fill="${color}" font-size="${size}" transform="rotate(${rotation} ${x+width/2} ${y+size/2})"><textPath href="#${pathId}" startOffset="0">${text}</textPath></text>`;}return`<text x="${x}" y="${y+size}" fill="${color}" font-size="${size}" transform="rotate(${rotation} ${x+width/2} ${y+size/2})">${text}</text>`;}return'';}

async function renderImageDerivative(source,target,options={}){
  const adjustments=normalizedAdjustments(options),format=outputFormat(options.format,target);
  let pipeline=sharp(source,{limitInputPixels:200*1024*1024,animated:false}).rotate();
  const sourceMetadata=await pipeline.metadata();let width=sourceMetadata.autoOrient?.width||sourceMetadata.width,height=sourceMetadata.autoOrient?.height||sourceMetadata.height;
  if(options.annotations?.length){const shapes=options.annotations.map(annotationSvg).join(''),annotated=await pipeline.composite([{input:Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${shapes}</svg>`)}]).png().toBuffer();pipeline=sharp(annotated,{limitInputPixels:200*1024*1024});}
  if(adjustments.rotate){pipeline=pipeline.rotate(adjustments.rotate);if(adjustments.rotate%180)[width,height]=[height,width];}
  if(adjustments.flip)pipeline=pipeline.flop();
  const crop=normalizedCrop(options.crop,width,height);if(crop){pipeline=pipeline.extract(crop);width=crop.width;height=crop.height;}
  if(adjustments.grayscale)pipeline=pipeline.grayscale();
  if(adjustments.negative)pipeline=pipeline.negate({alpha:false});
  if(adjustments.sepia)pipeline=pipeline.recomb([[.393,.769,.189],[.349,.686,.168],[.272,.534,.131]]);
  if(adjustments.brightness!==1)pipeline=pipeline.modulate({brightness:adjustments.brightness});
  if(adjustments.contrast!==1)pipeline=pipeline.linear(adjustments.contrast,128*(1-adjustments.contrast));
  if(format==='jpeg')pipeline=pipeline.flatten({background:'#ffffff'}).jpeg({quality:Math.max(1,Math.min(100,Number(options.quality)||92))});
  else if(format==='webp')pipeline=pipeline.webp({quality:Math.max(1,Math.min(100,Number(options.quality)||92))});
  else pipeline=pipeline.png();
  const info=await pipeline.toFile(target);return{target,format,width:info.width||width,height:info.height||height,size:info.size};
}

module.exports={OUTPUT_FORMATS,outputFormat,normalizedAdjustments,normalizedCrop,renderImageDerivative};
