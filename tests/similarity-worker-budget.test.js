const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{Worker}=require('node:worker_threads');

test('similarity worker throttles its measured CPU and preserves grouping for a populated hash set',async()=>{
 const assets=Array.from({length:1600},(_,index)=>({id:`image-${index}`,kind:'image',width:1200,height:800,perceptualHash:(BigInt(index)*0x9e3779b97f4a7c15n&0xffffffffffffffffn).toString(16).padStart(16,'0')}));assets[1].perceptualHash=assets[0].perceptualHash;
 const worker=new Worker(path.join(__dirname,'../electron/similarity-worker.js'),{workerData:{assets,accuracy:95,dutyCycle:0.08,startedAt:Date.now()}});
 const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker.terminate();reject(Error('Similarity budget timed out'));},11000);worker.on('message',message=>{if(message.error){clearTimeout(timer);reject(Error(message.error));}if(message.groups){clearTimeout(timer);resolve(message);}});worker.once('error',reject);});await worker.terminate();
 assert.ok(result.groups.some(group=>group.includes('image-0')&&group.includes('image-1')));assert.ok(result.cpuMs/result.wallMs<0.12,JSON.stringify(result));
});
