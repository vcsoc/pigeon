const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');
const {TEXT_PREVIEW_DOCUMENT_EXTENSIONS,createTextDocumentThumbnail,escapePreviewXml}=require('../electron/text-document-preview');

test('text document preview extensions cover requested readable formats',()=>{
  for(const extension of ['TXT','MD','MARKDOWN','JSON','JSONC','YAML','YML'])assert.equal(TEXT_PREVIEW_DOCUMENT_EXTENSIONS.has(extension),true,extension);
});

test('text document thumbnails render safe readable JPEG previews',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pigeon-text-preview-')),source=path.join(directory,'sample.jsonc'),target=path.join(directory,'sample.jpg');
  try{
    fs.writeFileSync(source,'{\n  // <unsafe & text>\n  "enabled": true\n}\n','utf8');
    const result=await createTextDocumentThumbnail({path:source,filename:'sample.jsonc',extension:'JSONC'},target),metadata=await sharp(target).metadata();
    assert.equal(result.ok,true);assert.equal(result.technicalMetadata.format,'text-preview');assert.equal(metadata.format,'jpeg');assert.equal(metadata.width,720);assert.equal(metadata.height,900);assert.ok(fs.statSync(target).size>1000);assert.equal(escapePreviewXml('<tag a="b">&'), '&lt;tag a=&quot;b&quot;&gt;&amp;');
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
