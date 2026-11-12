'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
function createPreviewCache(root,{maxBytes=256*1024*1024,concurrency=2}={}){
  const pending=new Map(),waiting=[];let active=0,writes=0,pruning=null;
  async function permit(){if(active>=concurrency){if(waiting.length>=64)throw Error('Immich thumbnail queue is busy. Please retry.');await new Promise(resolve=>waiting.push(resolve));}else active++;return()=>{if(waiting.length)waiting.shift()();else active--;};}
  async function prune(){if(pruning)return pruning;pruning=(async()=>{await fs.mkdir(root,{recursive:true,mode:0o700});const files=[];for(const name of await fs.readdir(root)){if(!/^[a-f0-9]{64}-[a-f0-9-]{36}\.preview$/i.test(name))continue;const file=path.join(root,name);try{const stat=await fs.stat(file);files.push({file,size:stat.size,time:stat.mtimeMs});}catch{}}let bytes=files.reduce((n,f)=>n+f.size,0);files.sort((a,b)=>a.time-b.time);for(const f of files){if(bytes<=maxBytes)break;await fs.rm(f.file,{force:true});bytes-=f.size;}})().finally(()=>{pruning=null;});return pruning;}
  async function get(account,id,fetchPreview){
    if(!/^[a-f0-9]{64}$/i.test(account)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw Error('Invalid Immich thumbnail identifier.');
    const key=`${account}-${id}`,file=path.join(root,`${key}.preview`);if(pending.has(key))return pending.get(key);
    const work=(async()=>{await fs.mkdir(root,{recursive:true,mode:0o700});try{const data=await fs.readFile(file),end=data.indexOf(10),mime=data.subarray(0,end).toString();if(end>0&&end<100&&/^image\/(jpeg|png|webp|avif|gif)$/.test(mime)){await fs.utimes(file,new Date(),new Date()).catch(()=>{});return{body:data.subarray(end+1),contentType:mime};}}catch{}
      const release=await permit();try{const result=await fetchPreview(),mime=String(result.contentType||'').split(';')[0].toLowerCase();if(!/^image\/(jpeg|png|webp|avif|gif)$/.test(mime)||!result.body?.length||result.body.length>20*1024*1024)throw Error('Invalid Immich thumbnail response.');const temporary=`${file}.${crypto.randomUUID()}.tmp`;try{await fs.writeFile(temporary,Buffer.concat([Buffer.from(`${mime}\n`),result.body]),{mode:0o600,flag:'wx'});await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true}).catch(()=>{});}if(++writes%32===0||writes===1)await prune();return{body:result.body,contentType:mime};}finally{release();}
    })().finally(()=>pending.delete(key));pending.set(key,work);return work;
  }
  return{get,prune};
}
module.exports={createPreviewCache};
