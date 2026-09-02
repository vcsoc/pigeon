'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');
const {createEditedPreview}=require('../electron/edited-preview');

test('edited derivatives receive a bounded lightweight preview',async()=>{const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-edited-preview-'));try{const source=path.join(directory,'large.png'),target=path.join(directory,'preview.jpg');await sharp({create:{width:2400,height:1600,channels:3,background:'#4b7aa8'}}).png().toFile(source);const result=await createEditedPreview(source,target),metadata=await sharp(target).metadata();assert.equal(metadata.format,'jpeg');assert.equal(metadata.width,1280);assert.equal(metadata.height,853);assert.ok(result.size<100000);}finally{await fsp.rm(directory,{recursive:true,force:true});}});
