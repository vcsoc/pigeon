const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
const renderer=read('renderer.js');

test('Details and pill typography apply independently with bounded sizes and safe fonts',()=>{
  const properties=new Map(),preferences={appFontFamily:'Arial',appFontSize:18,detailsFontFamily:'Georgia',detailsFontSize:15,pillFontSize:8,consoleFontSize:11};
  const context={preferences,preferenceDefaults:{appFontFamily:'sans-serif',consoleFontFamily:'monospace'},document:{documentElement:{style:{setProperty:(key,value)=>properties.set(key,value)}}}};
  vm.createContext(context);
  const start=renderer.indexOf('function safeFontFamily'),end=renderer.indexOf('function applyPrimarySidebarVisibility',start);
  vm.runInContext(renderer.slice(start,end)+'\napplyTypographyPreferences()',context);
  assert.equal(properties.get('--details-font-family'),'Georgia');
  assert.equal(properties.get('--details-font-size'),'15px');
  assert.equal(properties.get('--pill-font-size'),'8px');
  assert.equal(properties.get('--app-font-size'),'18px');
  assert.equal(properties.get('--console-font-size'),'11px');
  Object.assign(preferences,{detailsFontFamily:'bad;{}',detailsFontSize:100,pillFontSize:-1});
  vm.runInContext('applyTypographyPreferences()',context);
  assert.equal(properties.get('--details-font-family'),'Arial');
  assert.equal(properties.get('--details-font-size'),'24px');
  assert.equal(properties.get('--pill-font-size'),'8px');
});
test('Appearance exposes saved Details and pill settings with scoped CSS',()=>{
  const html=read('index.html'),css=read('styles.css');
  for(const key of ['detailsFontFamily','detailsFontSize','pillFontSize'])assert.ok(html.includes(`data-pref="${key}"`));
  assert.match(css,/#inspector-details-panel :where\(\*\)[\s\S]*?--details-font-family/);
  assert.match(css,/font-size: var\(--pill-font-size, 10px\)/);
});
