'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const policy=require('../src/context-menu-layouts');
const studio=fs.readFileSync(path.join(__dirname,'../src/context-menu-studio.js'),'utf8');
const declaration=studio.match(/const actionLabel=id=>[^;]+;/)[0];
function label(profile,id){return vm.runInNewContext(`${declaration} actionLabel(${JSON.stringify(id)})`,{policy,profile});}
test('folder and collection auto-tag actions use their menu names and remain configurable',()=>{
  for(const profile of ['folder','collection']){
    assert.equal(label(profile,'auto-tag'),'Set Auto-Tag / Edit Auto-Tag');
    for(const search of ['set auto-tag','edit auto-tag','auto-tag'])assert.ok(label(profile,'auto-tag').toLowerCase().includes(search));
    const layout=policy.defaults(profile);layout.placements['auto-tag']='root';
    assert.equal(policy.normalize(profile,layout).placements['auto-tag'],'root');
  }
  assert.equal(label('image','auto-tag'),policy.labels['auto-tag']);
  assert.equal(policy.definitions['smart-folder'].actions.includes('auto-tag'),false);
});
test('studio uses the profile label for rows, search and preview',()=>{
  assert.match(studio,/label=actionLabel\(id\)/);
  assert.match(studio,/actionLabel\(id\)\.toLowerCase\(\)\.includes\(filter\)/);
  assert.match(studio,/escape\(actionLabel\(key\)\)/);
});
