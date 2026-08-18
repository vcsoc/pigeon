const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const main=fs.readFileSync(path.join(__dirname,'..','electron','main.js'),'utf8');

test('collection password persistence uses the descendant Set contract once per operation',()=>{
  const start=main.indexOf("ipcMain.handle('collection:set-password'");
  const end=main.indexOf("ipcMain.handle('collection:unlock'",start);
  const handler=main.slice(start,end);
  assert.match(handler,/const descendants=collectionDescendants\(id\)/);
  assert.match(handler,/descendants\.has\(collectionId\)/);
  assert.doesNotMatch(handler,/collectionDescendants\(id\)\.includes/);
});
