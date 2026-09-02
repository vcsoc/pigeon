'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const fsp=require('node:fs/promises');
const {serveMediaFile}=require('../electron/media-stream');

test('media range responses survive request completion for slow external-drive delivery',async(t)=>{const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-media-stream-'));t.after(()=>fsp.rm(directory,{recursive:true,force:true}));const source=path.join(directory,'video.mp4'),body=Buffer.alloc(3*1024*1024);for(let index=0;index<body.length;index+=1)body[index]=index%251;await fsp.writeFile(source,body);const server=http.createServer((request,response)=>serveMediaFile(request,response,source,'video/mp4').catch((error)=>response.destroy(error)));await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise((resolve)=>server.close(resolve)));const received=await new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port:server.address().port,headers:{Range:'bytes=1048576-2097151'}},(response)=>{assert.equal(response.statusCode,206);assert.equal(response.headers['accept-ranges'],'bytes');assert.equal(response.headers['content-range'],`bytes 1048576-2097151/${body.length}`);const chunks=[];response.on('data',(chunk)=>{chunks.push(chunk);response.pause();setTimeout(()=>response.resume(),1);});response.once('error',reject);response.once('end',()=>resolve(Buffer.concat(chunks)));}).once('error',reject);});assert.equal(received.length,1024*1024);assert.deepEqual(received,body.subarray(1048576,2097152));});

test('invalid media ranges return 416',async(t)=>{const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-media-range-'));t.after(()=>fsp.rm(directory,{recursive:true,force:true}));const source=path.join(directory,'audio.mp3');await fsp.writeFile(source,'tiny');const server=http.createServer((request,response)=>serveMediaFile(request,response,source,'audio/mpeg'));await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise((resolve)=>server.close(resolve)));const status=await new Promise((resolve,reject)=>http.get({host:'127.0.0.1',port:server.address().port,headers:{Range:'bytes=999-'}},(response)=>{response.resume();response.once('end',()=>resolve(response.statusCode));}).once('error',reject));assert.equal(status,416);});
