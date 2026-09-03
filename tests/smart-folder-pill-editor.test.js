'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const renderer=fs.readFileSync(path.join(__dirname,'..','src','renderer.js'),'utf8');
const styles=fs.readFileSync(path.join(__dirname,'..','src','styles.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','src','index.html'),'utf8');

test('Smart Folder name, tag, folder and collection rules use removable multi-value pills',()=>{
  assert.match(renderer,/smartMultiValueFields=new Set\(\['tags','name','folder','collection'\]\)/);
  assert.match(renderer,/function commitSmartRulePill/);
  assert.match(renderer,/data-smart-rule-value-input="true"/);
  assert.match(renderer,/data-remove-rule-value/);
  assert.match(renderer,/event\.key==='Enter'\|\|event\.key==='Tab'/);
  assert.match(renderer,/event\.key==='Backspace'/);
  assert.match(renderer,/input\.dataset\.smartRuleValueInput==='true'/);
  assert.match(renderer,/rule\.values=values/);
  assert.match(styles,/\.smart-rule-pill-editor/);
  assert.match(styles,/\.smart-rule-pill/);
  assert.match(html,/id="smart-collection-suggestions"/);
});
