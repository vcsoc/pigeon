'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createObservability,signalUrl}=require('../electron/observability');
test('OTLP endpoints honor base and per-signal overrides',()=>{
  assert.equal(signalUrl({},'traces'),'http://tuf.vcsoc.com:4318/v1/traces');
  assert.equal(signalUrl({OTEL_EXPORTER_OTLP_ENDPOINT:'http://localhost:1234/prefix/'},'logs'),'http://localhost:1234/prefix/v1/logs');
  assert.equal(signalUrl({OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:'http://localhost:1234/custom'},'logs'),'http://localhost:1234/custom');
});
test('disabled telemetry runs operations without export',async()=>{const telemetry=createObservability({disabled:true});assert.equal(telemetry.run('library:get',()=>42),42);await telemetry.shutdown();});
test('exports all three signals and excludes diagnostic text and private attributes',async()=>{
  const requests=[];const server=http.createServer((req,res)=>{const chunks=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>{requests.push({path:req.url,type:req.headers['content-type'],body:Buffer.concat(chunks)});res.writeHead(200,{'content-type':'application/x-protobuf'});res.end();});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const endpoint=`http://127.0.0.1:${server.address().port}`,telemetry=createObservability({env:{OTEL_EXPORTER_OTLP_ENDPOINT:endpoint},version:'test'});
    telemetry.diagnostic('error','/private/secret.jpg');telemetry.performance({name:'sqlite-open',durationMs:25,portfolioId:'private-portfolio'});
    assert.equal(await telemetry.run('library:get',async()=>42),42);await telemetry.shutdown();
    for(const signal of ['traces','metrics','logs']){const request=requests.find(item=>item.path===`/v1/${signal}`);assert.ok(request,JSON.stringify(requests.map(item=>item.path)));assert.match(request.type,/protobuf/);assert.ok(request.body.length>0);assert.equal(request.body.includes(Buffer.from('/private/secret.jpg')),false);assert.equal(request.body.includes(Buffer.from('private-portfolio')),false);assert.ok(request.body.includes(Buffer.from('pigeon-desktop')));}
  }finally{await new Promise(resolve=>server.close(resolve));}
});
