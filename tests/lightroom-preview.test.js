'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');
const {extractLightroomPreview,embeddedJpegCandidates}=require('../electron/lightroom-preview');

test('Lightroom preview containers expose their largest embedded JPEG',async()=>{
  const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-lrprev-'));
  try{
    const small=await sharp({create:{width:96,height:64,channels:3,background:'#cc5533'}}).jpeg({quality:70}).toBuffer();
    const large=await sharp({create:{width:640,height:420,channels:3,background:'#3355cc'}}).jpeg({quality:82}).toBuffer();
    const source=path.join(directory,'sample.lrprev'),targetBase=path.join(directory,'extracted');
    await fsp.writeFile(source,Buffer.concat([Buffer.from('AgHg Lightroom preview\0'),small,Buffer.from([0,1,2,3]),large,Buffer.from('tail')]));
    const result=await extractLightroomPreview(source,targetBase),metadata=await sharp(result.target).metadata();
    assert.equal(result.previewCount,2);assert.equal(result.width,640);assert.equal(result.height,420);assert.equal(metadata.format,'jpeg');assert.equal(metadata.width,640);assert.equal(metadata.height,420);
  }finally{await fsp.rm(directory,{recursive:true,force:true});}
});

test('malformed Lightroom preview data is rejected safely',async()=>{
  assert.deepEqual(embeddedJpegCandidates(Buffer.from('not a preview')),[]);
  const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-lrprev-bad-'));
  try{const source=path.join(directory,'bad.lrprev');await fsp.writeFile(source,Buffer.from([0xff,0xd8,0xff,0xe0,0,20]));assert.equal(await extractLightroomPreview(source,path.join(directory,'out')),null);}finally{await fsp.rm(directory,{recursive:true,force:true});}
});
