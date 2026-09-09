const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../src/styles.css'),'utf8');
test('All Tags hover does not resize rows and keeps keyboard actions accessible',()=>{
 assert.match(css,/\.tag-manager-actions \{ width:34px; flex:0 0 34px;/);
 const hover=css.match(/\.tag-manager-item:hover \.tag-manager-actions[^}]+\}/)[0];
 assert.doesNotMatch(hover,/width:|display:|padding:/);
 assert.match(hover,/:focus-within/);
 assert.match(css,/\.tag-manager-item,\.tag-manager-item \* \{ transition:none; \}/);
 assert.match(css,/\.tag-manager-item \{ contain:layout paint; content-visibility:auto;/);
});
