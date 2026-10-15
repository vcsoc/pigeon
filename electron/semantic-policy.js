"use strict";
const os = require('node:os');
const POLICY = Object.freeze({automatic: {cpu: 0.12, memory: 0.12, busy: 0.35}, manual: {cpu: 0.18, memory: 0.18, busy: 0.70}});
function budget(mode='automatic', cores=os.cpus().length, memory=os.totalmem(), resourcePercent=null) {
  const base=POLICY[mode]||POLICY.automatic,percent=Number(resourcePercent);
  const fraction=resourcePercent!==null&&Number.isFinite(percent)?Math.max(5,Math.min(50,percent))/100:null;
  const p=fraction===null?base:{...base,cpu:fraction,memory:fraction};
  return {...p, cores:Math.max(1,cores), threads:Math.max(1,Math.floor(cores*p.cpu)), fileWorkers:Math.min(mode==='manual'?4:2,Math.max(1,cores)), memoryBytes:Math.floor(memory*p.memory)};
}
function normalizeIdleMinutes(value=10){const minutes=Number(value);return Number.isFinite(minutes)&&minutes>0?Math.max(1,Math.min(240,Math.round(minutes))):10;}
function systemCpuDelta(previous, current) {
  if(!previous?.length||previous.length!==current.length)return null;
  let total=0,idle=0;
  for(let i=0;i<current.length;i++){for(const key of ['user','nice','sys','idle','irq'])total+=Math.max(0,current[i].times[key]-previous[i].times[key]);idle+=Math.max(0,current[i].times.idle-previous[i].times.idle);}
  return total>0?Math.max(0,Math.min(1,1-idle/total)):null;
}
function contentFingerprint(asset){return JSON.stringify([asset.path,asset.size,asset.modified,asset.contentHash||'',asset.editedPath||'',asset.editedAt||0,asset.editedPreviewPath||'',asset.proxyPath||'',asset.thumbnailPath||'']);}
function fingerprint(asset) {return JSON.stringify([contentFingerprint(asset),asset.name||asset.filename,asset.note||'',asset.tags||[]]);}
function admissible(asset) {return Boolean(asset?.id&&asset.path&&!asset.deletedAt&&!asset.sourceMissing&&!asset.sourcePending&&!asset.locked&&!asset.encrypted);}
// Cache paths and a first hash do not change the source; losing a known hash does.
function contentFingerprintsMatch(current,stored){if(current===stored)return Boolean(current);try{const a=JSON.parse(current),b=JSON.parse(stored);return Array.isArray(a)&&Array.isArray(b)&&a.length===9&&b.length===9&&[0,1,2,4,5,6].every(index=>a[index]===b[index])&&(!b[3]||a[3]===b[3]);}catch{return false;}}
function fingerprintsMatch(current,stored){if(current===stored)return true;try{const unpack=value=>{const item=JSON.parse(value);if(!Array.isArray(item))return null;if(item.length===4)return{content:item[0],metadata:item.slice(1)};if(item.length===9)return{content:JSON.stringify([...item.slice(0,4),'',0,'',...item.slice(7,9)]),metadata:item.slice(4,7)};return null;},a=unpack(current),b=unpack(stored);return Boolean(a&&b&&contentFingerprintsMatch(a.content,b.content)&&JSON.stringify(a.metadata)===JSON.stringify(b.metadata));}catch{return false;}}
module.exports={POLICY,budget,systemCpuDelta,contentFingerprint,contentFingerprintsMatch,fingerprint,fingerprintsMatch,admissible,normalizeIdleMinutes};
