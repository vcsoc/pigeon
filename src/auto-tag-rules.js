(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonAutoTagRules=api;})(globalThis,()=>{
  const fields=['name','filename','path','kind','extension','rating','width','height','tags','collectionIds'];
  function parse(value){try{const rules=typeof value==='string'?JSON.parse(value):value;return Array.isArray(rules)?rules.filter(rule=>rule&&typeof rule==='object'&&!Array.isArray(rule)).slice(0,100):[];}catch{return[];}}
  function matches(asset,condition){if(!condition||!fields.includes(condition.field))return false;const raw=asset[condition.field],values=(Array.isArray(raw)?raw:[raw??'']).map(value=>String(value).toLowerCase()),wanted=String(condition.value??'').toLowerCase();switch(condition.operator){case 'equals':return values.includes(wanted);case 'contains':return wanted!==''&&values.some(value=>value.includes(wanted));case 'starts':return wanted!==''&&values.some(value=>value.startsWith(wanted));case 'excludes':return wanted!==''&&values.every(value=>!value.includes(wanted));case 'gte':return wanted!==''&&Number.isFinite(Number(raw))&&Number(raw)>=Number(wanted);case 'lte':return wanted!==''&&Number.isFinite(Number(raw))&&Number(raw)<=Number(wanted);default:return false;}}
  function template(value,asset){const parts=String(asset.path||'').replace(/\\/g,'/').split('/'),date=new Date(asset.modified||0),tokens={name:asset.name||'',folder:parts.at(-2)||'',extension:String(asset.extension||'').toLowerCase(),kind:asset.kind||'',year:asset.modified&&Number.isFinite(date.getTime())?String(date.getFullYear()):''};return String(value).replace(/\{(name|folder|extension|kind|year)\}/g,(_,key)=>tokens[key]).trim().slice(0,120);}
  let cachedRulesSource=null,cachedRules=[];
  function generate(asset,config={},automatic=true){
    if(automatic&&config.autoTagEnabled===false)return[];
    const tags=new Map(),add=value=>{const tag=String(value||'').trim();if(tag&&!tags.has(tag.toLowerCase())&&tags.size<64)tags.set(tag.toLowerCase(),tag);};
    const source=config.autoTagRulesJson;let rules;if(typeof source==='string'){if(source!==cachedRulesSource){cachedRulesSource=source;cachedRules=parse(source);}rules=cachedRules;}else rules=parse(source);
    for(const rule of rules){if(rule.enabled===false)continue;const conditions=Array.isArray(rule.conditions)?rule.conditions.slice(0,20):[];if(!conditions.length)continue;if(rule.match==='any'?conditions.some(c=>matches(asset,c)):conditions.every(c=>matches(asset,c)))for(const tag of (Array.isArray(rule.tags)?rule.tags:[]).slice(0,32))if(typeof tag==='string')add(template(tag,asset));}
    const built=[];
    if(config.autoTagFilename===true)built.push(...`${asset.name||''} ${asset.filename||''}`.toLowerCase().split(/[^a-z0-9]+/).filter(word=>word.length>=3&&word.length<=24));
    if(config.autoTagKind!==false&&asset.kind)built.push(asset.kind);
    if(config.autoTagOrientation!==false&&asset.width&&asset.height)built.push(asset.width>asset.height?'landscape':asset.width<asset.height?'portrait':'square');
    if(config.autoTagColor===true&&/^#[\da-f]{6}$/i.test(asset.dominantColor||'')){const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),color=rgb(asset.dominantColor),colors=[['dark','#222222'],['light','#eeeeee'],['red','#d94747'],['orange','#e4933d'],['yellow','#e4c33c'],['green','#49a96f'],['blue','#417bd5'],['purple','#7855cb']];colors.sort((a,b)=>{const distance=x=>rgb(x).reduce((sum,v,i)=>sum+(v-color[i])**2,0);return distance(a[1])-distance(b[1]);});built.push(colors[0][0]);}
    for(const value of [...new Set(built)].slice(0,12))add(value);return [...tags.values()];
  }
  return{fields,parse,matches,template,generate};
});
