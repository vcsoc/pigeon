'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs/promises');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');
const {normalizedAiScale,enlargeImageWithAi}=require('../electron/ai-enlarger');

test('AI enlargement scales images locally with the bundled ONNX model',async()=>{
  const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'pigeon-ai-enlarge-'));
  try{
    const source=path.join(directory,'source.png'),target=path.join(directory,'enlarged.png'),previewTarget=path.join(directory,'preview.jpg');
    await sharp({create:{width:24,height:16,channels:3,background:'#3a76b8'}}).png().toFile(source);
    const result=await enlargeImageWithAi(source,target,{scale:2,previewTarget});
    const metadata=await sharp(target).metadata(),preview=await sharp(previewTarget).metadata();
    assert.equal(result.model,'ONNX Super Resolution CNN');
    assert.equal(metadata.width,48);assert.equal(metadata.height,32);assert.equal(preview.format,'jpeg');assert.equal(result.previewTarget,previewTarget);
  }finally{await fsp.rm(directory,{recursive:true,force:true});}
});

test('AI enlargement accepts only supported output scales',()=>{
  assert.equal(normalizedAiScale(3),3);assert.equal(normalizedAiScale(2),2);assert.equal(normalizedAiScale(9),2);
});

test('AI enlargement is exposed through the editor and isolated IPC bridge',()=>{
  const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'src','index.html'),'utf8'),renderer=fs.readFileSync(path.join(root,'src','renderer.js'),'utf8'),preload=fs.readFileSync(path.join(root,'electron','preload.js'),'utf8'),main=fs.readFileSync(path.join(root,'electron','main.js'),'utf8'),packageJson=fs.readFileSync(path.join(root,'package.json'),'utf8');
  assert.match(html,/id="run-ai-enlarge"/);assert.match(html,/id="ai-enlarge-scale"/);assert.match(renderer,/requestAiEnlargement/);assert.match(preload,/asset:ai-enlarge/);assert.match(main,/enlargeImageAsset/);assert.match(main,/enlargeImageWithAi/);assert.match(packageJson,/electron\/ai-models\/\*\*\/\*/);assert.match(packageJson,/onnxruntime-web/);
});
