(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonSmartFolderRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function resolve(folders=[],folderOrId){
    const list=Array.isArray(folders)?folders:[],byId=new Map(list.filter((folder)=>folder?.id).map((folder)=>[folder.id,folder])),target=typeof folderOrId==='object'?folderOrId:byId.get(folderOrId);
    if(!target)return{folder:null,chain:[],inherited:[],valid:false,cycle:false,missing:true,missingParentId:null};
    const chain=[],seen=new Set();let current=target,cycle=false,missingParentId=null;
    while(current){if(seen.has(current.id)){cycle=true;break;}seen.add(current.id);chain.unshift(current);if(!current.parentId)break;const parent=byId.get(current.parentId);if(!parent){missingParentId=current.parentId;break;}current=parent;}
    return{folder:target,chain,inherited:chain.slice(0,-1),valid:!cycle,cycle,missing:false,missingParentId};
  }
  function matchesResolved(asset,resolution,evaluator){return Boolean(resolution?.folder&&resolution.valid&&typeof evaluator==='function'&&resolution.chain.every((folder)=>evaluator(asset,folder.filters||{})));}
  function matches(asset,folders,folderOrId,evaluator){return matchesResolved(asset,resolve(folders,folderOrId),evaluator);}
  function dependsOnField(folders,folderOrId,field){const resolution=resolve(folders,folderOrId);return resolution.valid&&resolution.chain.some((folder)=>(folder.filters?.rules||[]).some((rule)=>rule.field===field));}
  function ruleValues(rule={}){const source=Array.isArray(rule.values)?rule.values:[rule.value],result=[],seen=new Set();for(const entry of source){const value=String(entry??'').trim(),key=value.toLowerCase();if(value&&!seen.has(key)){seen.add(key);result.push(value);}}return result;}
  function matchesRuleValues(actualValues,rule={}){const actual=(Array.isArray(actualValues)?actualValues:[actualValues]).map((value)=>String(value??'').toLowerCase()),operator=rule.operator||'contains',expected=ruleValues(rule).map((value)=>value.toLowerCase());if(operator==='null')return actual.length===0||actual.every((value)=>!value.trim());if(operator==='not-null')return actual.some((value)=>value.trim());if(!expected.length)return operator==='excludes';const test=(value,target)=>{if(operator==='equals')return value===target;if(operator==='begins')return value.startsWith(target);if(operator==='ends')return value.endsWith(target);if(operator==='regex'){try{return new RegExp(target,'i').test(value);}catch{return false;}}return value.includes(target);};return operator==='excludes'?expected.every((target)=>actual.every((value)=>!test(value,target))):expected.some((target)=>actual.some((value)=>test(value,target)));}
  return{resolve,matches,matchesResolved,dependsOnField,ruleValues,matchesRuleValues};
});
