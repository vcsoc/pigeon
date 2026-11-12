'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),core=require('../electron/library-core');
test('All smart folder privacy and tag rules follow explicit any versus all semantics',()=>{
  const rules=[{field:'tags',operator:'excludes',value:'asmr',values:['asmr']},{field:'privacyEffect',operator:'equals',value:'false'}],plain={tags:[],thumbnailEffect:false},protectedAsset={tags:[],thumbnailEffect:true},tagged={tags:['asmr'],thumbnailEffect:false};
  assert.equal(core.matchesFilters(plain,{ruleMatch:'all',rules}),true);
  assert.equal(core.matchesFilters(protectedAsset,{ruleMatch:'all',rules}),false);
  assert.equal(core.matchesFilters(tagged,{ruleMatch:'all',rules}),false);
  assert.equal(core.matchesFilters(protectedAsset,{ruleMatch:'any',rules}),true);
  assert.equal(core.matchesFilters(tagged,{ruleMatch:'any',rules}),true);
});
