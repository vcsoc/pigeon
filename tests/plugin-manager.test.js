const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createPluginManager,isLoopbackEndpoint}=require('../electron/plugin-manager');

const bundledDir=path.join(__dirname,'..','electron','plugin-examples');
test('plugin manager catalogs, installs, configures and uninstalls bundled plugins',async()=>{
  const pluginsDir=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-plugins-'));
  const manager=createPluginManager({pluginsDir,bundledDir});
  try{
    let plugins=await manager.list(),ai=plugins.find((plugin)=>plugin.id==='ai-removal');
    assert.equal(ai.installed,false);assert.equal(ai.enabled,false);
    plugins=await manager.install('ai-removal');ai=plugins.find((plugin)=>plugin.id==='ai-removal');
    assert.equal(ai.installed,true);assert.equal(ai.model.name,'Simple LaMa ONNX');assert.equal(ai.modelReady,false);await fsp.mkdir(path.join(pluginsDir,'ai-removal','models'),{recursive:true});await fsp.writeFile(path.join(pluginsDir,'ai-removal','models','lama_fp32.onnx'),'');await fsp.truncate(path.join(pluginsDir,'ai-removal','models','lama_fp32.onnx'),208044816);await fsp.writeFile(path.join(pluginsDir,'ai-removal','.model-ready'),'ready');ai=(await manager.list()).find((plugin)=>plugin.id==='ai-removal');assert.equal(ai.modelReady,true);assert.equal(ai.modelState.status,'ready');assert.equal(ai.configured.endpoint,'http://127.0.0.1:8765/inpaint');
    plugins=await manager.configure('ai-removal',{endpoint:'http://localhost:9988/inpaint',brushSize:73});ai=plugins.find((plugin)=>plugin.id==='ai-removal');
    assert.equal(ai.configured.brushSize,73);assert.equal(ai.configured.endpoint,'http://localhost:9988/inpaint');
    await assert.rejects(()=>manager.configure('ai-removal',{endpoint:'https://example.com/inpaint'}),/loopback-only/);
    plugins=await manager.uninstall('ai-removal');assert.equal(plugins.find((plugin)=>plugin.id==='ai-removal').installed,false);
  }finally{manager.close();await fsp.rm(pluginsDir,{recursive:true,force:true});}
});

test('local script plugins can be enabled and disabled without service execution',async()=>{
  const pluginsDir=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-plugins-'));
  const manager=createPluginManager({pluginsDir,bundledDir});
  try{await fsp.writeFile(path.join(pluginsDir,'sample.js'),'pigeon.emit({type:"tag",ids:[],tag:"ok"});');let plugin=(await manager.list()).find((item)=>item.entry==='sample.js');assert.equal(plugin.enabled,true);plugin=(await manager.setEnabled(plugin.id,false)).find((item)=>item.entry==='sample.js');assert.equal(plugin.enabled,false);assert.equal((await manager.uninstall(plugin.id)).some((item)=>item.entry==='sample.js'),false);}
  finally{manager.close();await fsp.rm(pluginsDir,{recursive:true,force:true});}
});

test('legacy AI Removal folders migrate into managed storage without deleting the legacy folder',async()=>{
  const pluginsDir=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-plugins-')),legacy=path.join(pluginsDir,'AI Removal');
  await fsp.mkdir(legacy,{recursive:true});await fsp.writeFile(path.join(legacy,'server.py'),'legacy');
  const manager=createPluginManager({pluginsDir,bundledDir});
  try{const ai=(await manager.list()).find((plugin)=>plugin.id==='ai-removal');assert.equal(ai.installed,true);assert.equal(await fsp.readFile(path.join(legacy,'server.py'),'utf8'),'legacy');assert.match(ai.statusDetail,/Migrated the legacy/);}
  finally{manager.close();await fsp.rm(pluginsDir,{recursive:true,force:true});}
});

test('managed models can be imported and removed while configuration is retained',async()=>{
  const pluginsDir=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-plugins-')),source=path.join(pluginsDir,'source.onnx');
  const manager=createPluginManager({pluginsDir,bundledDir});
  try{await manager.install('ai-removal');await fsp.writeFile(source,'');await fsp.truncate(source,208044816);let ai=(await manager.importModel('ai-removal',source)).find((plugin)=>plugin.id==='ai-removal');assert.equal(ai.modelState.status,'unvalidated');assert.equal(ai.modelState.bytes,208044816);ai=(await manager.removeModel('ai-removal')).find((plugin)=>plugin.id==='ai-removal');assert.equal(ai.modelState.status,'missing');assert.equal(ai.installed,true);}
  finally{manager.close();await fsp.rm(pluginsDir,{recursive:true,force:true});}
});

test('plugin endpoints are restricted to loopback HTTP',()=>{assert.equal(isLoopbackEndpoint('http://127.0.0.1:8765/inpaint'),true);assert.equal(isLoopbackEndpoint('http://localhost:9000/inpaint'),true);assert.equal(isLoopbackEndpoint('https://127.0.0.1/inpaint'),false);assert.equal(isLoopbackEndpoint('http://192.168.1.10/inpaint'),false);});
