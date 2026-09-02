'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const main=fs.readFileSync(path.join(root,'electron','main.js'),'utf8');
const preload=fs.readFileSync(path.join(root,'electron','preload.js'),'utf8');
const renderer=fs.readFileSync(path.join(root,'src','renderer.js'),'utf8');

test('Omarchy images can be copied into the active theme and applied immediately',()=>{
  assert.match(main,/\.config','omarchy','backgrounds',themeName/);
  assert.match(main,/execFile\('omarchy',\['theme','bg','set',target\]/);assert.match(main,/execFile\('omarchy',\['theme','bg','cache'\]/);
  assert.match(main,/asset:set-omarchy-wallpaper/);
  assert.match(preload,/isOmarchy/);assert.match(preload,/setOmarchyThemeWallpaper/);
  assert.match(renderer,/Set as theme wallpaper/);assert.match(renderer,/window\.pigeon\.isOmarchy&&asset\.kind==='image'/);
});

test('edited thumbnails never fall back to the full-resolution derivative',()=>{
  assert.match(main,/wantsEdited&&asset\.editedPath\?\(editedPreviewReady\?\[asset\.editedPreviewPath\]:asset\.thumbnailPath\?\[asset\.thumbnailPath\]:\[\]\)/);
  assert.match(main,/ensureEditedPreview\(asset\)/);assert.match(main,/editedPreviewPath:previewTarget/);
});
