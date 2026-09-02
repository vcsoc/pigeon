'use strict';

const fs=require('node:fs');
const fsp=require('node:fs/promises');

async function serveMediaFile(request,response,source,mime='application/octet-stream'){
  const stat=await fsp.stat(source),match=String(request.headers.range||'').match(/bytes=(\d+)-(\d*)/),headers={'Content-Type':mime,'Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600','Access-Control-Allow-Origin':'*'};
  let start=0,end=stat.size-1,status=200;
  if(match){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(!Number.isSafeInteger(start)||start<0||start>end){response.writeHead(416,{...headers,'Content-Range':`bytes */${stat.size}`}).end();return;}status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;}
  headers['Content-Length']=String(Math.max(0,end-start+1));response.writeHead(status,headers);
  if(request.method==='HEAD'||stat.size===0){response.end();return;}
  const stream=fs.createReadStream(source,{start,end});
  stream.once('error',(error)=>{if(!response.headersSent)response.writeHead(404);response.destroy(error);});
  request.once('aborted',()=>stream.destroy());
  response.once('close',()=>{if(!response.writableEnded)stream.destroy();});
  stream.pipe(response);
}

module.exports={serveMediaFile};
