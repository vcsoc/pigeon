const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('grouped menus use opaque app-menu styling and separate right-aligned arrows',()=>{
 const js=read('src/context-menu-groups.js'),css=read('src/styles.css');
 assert.match(js,/panel.className='app-menu context-menu grouped-context-panel hidden'/);
 assert.match(js,/menu.classList.remove\('asset-context-menu-expanded'\)/);
 assert.match(js,/trigger.append\(caption,arrow\)/);
 assert.match(css,/\.context-menu \.context-action-group>button \{[^}]*width:100%;[^}]*justify-content:space-between/);
 assert.match(css,/\.context-menu.grouped-context-panel \{ background:#222428;/);
});
test('auto-tagging has a preferences icon and conservative defaults',()=>{
 const js=read('src/renderer.js');assert.match(js,/'auto-tagging':'tags'/);assert.match(js,/autoTagFilename:false/);assert.match(js,/autoTagColor:false/);
});
