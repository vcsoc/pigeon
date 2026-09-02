'use strict';

const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');

async function renderEditedPreview(source,target){
  const sharp=require('sharp');
  const info=await sharp(source,{limitInputPixels:100*1024*1024,animated:false}).rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:84,mozjpeg:true}).toFile(target);
  return{target,width:info.width,height:info.height,size:info.size};
}

function createEditedPreview(source,target){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(__filename,{workerData:{source,target}});let settled=false;
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate().catch(()=>{});error?reject(error):resolve(result);};
    const timer=setTimeout(()=>finish(new Error('Edited preview generation timed out')),120000);timer.unref?.();
    worker.once('message',(message)=>message.error?finish(new Error(message.error)):finish(null,message.result));
    worker.once('error',(error)=>finish(error));worker.once('exit',(code)=>{if(code&&!settled)finish(new Error(`Edited preview worker stopped with code ${code}`));});
  });
}

if(!isMainThread)renderEditedPreview(workerData.source,workerData.target).then((result)=>parentPort.postMessage({result})).catch((error)=>parentPort.postMessage({error:error.message}));

module.exports={createEditedPreview};
