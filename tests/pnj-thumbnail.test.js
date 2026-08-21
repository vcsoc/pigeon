'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {Worker}=require('node:worker_threads');
const sharp=require('sharp');

function renderWithWorker(source,target){return new Promise((resolve,reject)=>{const worker=new Worker(path.join(__dirname,'..','electron','thumbnail-worker.js'));worker.once('message',(message)=>{worker.terminate();resolve(message);});worker.once('error',reject);worker.postMessage({source,target});});}

test('JPEG and PNG byte streams with PNJ extensions render as image thumbnails',async()=>{const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-pnj-thumbnail-'));try{for(const format of ['jpeg','png']){const source=path.join(directory,`source-${format}.pnj`),target=path.join(directory,`thumb-${format}.jpg`),pipeline=sharp({create:{width:120,height:80,channels:3,background:{r:30,g:120,b:210}}});await pipeline[format]().toFile(source);const result=await renderWithWorker(source,target);assert.equal(result.ok,true,result.message);assert.ok(fs.statSync(target).size>100);assert.equal(result.width,120);assert.equal(result.height,80);}}finally{fs.rmSync(directory,{recursive:true,force:true});}});
