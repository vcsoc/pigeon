'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');
const {outputFormat,normalizedCrop,renderImageDerivative}=require('../electron/image-derivative');

test('image derivatives convert, rotate, crop, and apply tonal adjustments',async()=>{
  const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-derivative-'));
  try{
    const source=path.join(directory,'source.tiff'),target=path.join(directory,'result.webp');
    await sharp({create:{width:120,height:80,channels:3,background:{r:200,g:80,b:30}}}).tiff().toFile(source);
    const result=await renderImageDerivative(source,target,{format:'webp',rotate:90,crop:{normalized:true,x:.25,y:.25,width:.5,height:.5},grayscale:true,negative:true,sepia:true,brightness:1.2,contrast:1.1,annotations:[{type:'rect',x:5,y:5,width:20,height:15,color:'#ffffff',stroke:2,rotation:20},{type:'text',text:'Curved',x:12,y:18,size:16,width:70,color:'#ffffff',rotation:-12,bend:45}]});
    const metadata=await sharp(await fsp.readFile(target)).metadata();assert.equal(result.format,'webp');assert.equal(metadata.format,'webp');assert.equal(metadata.width,40);assert.equal(metadata.height,60);
  }finally{await new Promise((resolve)=>setTimeout(resolve,25));await fsp.rm(directory,{recursive:true,force:true,maxRetries:4,retryDelay:25});}
});

test('derivative formats and crops are normalized safely',()=>{
  assert.equal(outputFormat('jpg'),'jpeg');assert.equal(outputFormat('', 'copy.PNG'),'png');assert.equal(outputFormat('invalid','copy.webp'),'webp');
  assert.deepEqual(normalizedCrop({normalized:true,x:.5,y:.5,width:1,height:1},100,80),{left:50,top:40,width:50,height:40});
});
