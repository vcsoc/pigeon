'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),rules=require('../src/smart-folder-rules'),core=require('../electron/library-core');
const conditions=[{field:'tags',operator:'contains',value:'asmr'},{field:'privacyEffect',operator:'equals',value:'true'}];
const asset=(tag,effect)=>({filename:'sample.jpg',tags:tag?['asmr']:[],thumbnailEffect:effect});
test('include and exclude apply to the entire any/all condition group',()=>{
  for(const [tag,effect] of [[false,false],[true,false],[false,true],[true,true]]){
    const item=asset(tag,effect),any=tag||effect,all=tag&&effect;
    for(const [mode,matched] of [['any',any],['all',all]]){
      assert.equal(core.matchesFilters(item,{ruleMatch:mode,rules:conditions}),matched);
      assert.equal(core.matchesFilters(item,{ruleAction:'include',ruleMatch:mode,rules:conditions}),matched);
      assert.equal(core.matchesFilters(item,{ruleAction:'exclude',ruleMatch:mode,rules:conditions}),!matched);
    }
  }
});
test('empty or incomplete rules do not exclude the entire library',()=>{
  for(const mode of ['include','exclude'])for(const ruleMatch of ['all','any'])assert.equal(core.matchesFilters(asset(false,false),{ruleAction:mode,ruleMatch,rules:[{field:'tags',operator:'contains',value:''}]}),true);
});
test('inherited include and exclude groups both constrain descendants',()=>{
  const folders=[{id:'parent',filters:{ruleAction:'exclude',ruleMatch:'any',rules:conditions}},{id:'child',parentId:'parent',filters:{ruleAction:'include',ruleMatch:'all',rules:[{field:'name',operator:'contains',value:'sample'}]}}];
  assert.equal(rules.matches(asset(false,false),folders,'child',core.matchesFilters),true);
  assert.equal(rules.matches(asset(true,false),folders,'child',core.matchesFilters),false);
  assert.equal(rules.matches(asset(false,true),folders,'child',core.matchesFilters),false);
});
test('null operators are active exclusion conditions',()=>{
  const filters={ruleAction:'exclude',ruleMatch:'any',rules:[{field:'tags',operator:'null'}]};
  assert.equal(core.matchesFilters(asset(false,false),filters),false);assert.equal(core.matchesFilters(asset(true,false),filters),true);
});
