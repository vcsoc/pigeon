"use strict";
const os = require('node:os');
const POLICY = Object.freeze({automatic: {cpu: 0.12, memory: 0.12, busy: 0.35}, manual: {cpu: 0.18, memory: 0.18, busy: 0.70}});
function budget(mode='automatic', cores=os.cpus().length, memory=os.totalmem(), resourcePercent=null) {
  const base=POLICY[mode]||POLICY.automatic,percent=Number(resourcePercent);
  const fraction=resourcePercent!==null&&Number.isFinite(percent)?Math.max(5,Math.min(50,percent))/100:null;
  const p=fraction===null?base:{...base,cpu:fraction,memory:fraction};
  return {...p, cores:Math.max(1,cores), threads:Math.max(1,Math.floor(cores*p.cpu)), fileWorkers:Math.min(mode==='manual'?4:2,Math.max(1,cores)), memoryBytes:Math.floor(memory*p.memory)};
}
function systemCpuDelta(previous, current) {
  if(!previous?.length||previous.length!==current.length)return null;
  let total=0,idle=0;
  for(let i=0;i<current.length;i++){for(const key of ['user','nice','sys','idle','irq'])total+=Math.max(0,current[i].times[key]-previous[i].times[key]);idle+=Math.max(0,current[i].times.idle-previous[i].times.idle);}
  return total>0?Math.max(0,Math.min(1,1-idle/total)):null;
}
function contentFingerprint(asset){return JSON.stringify([asset.path,asset.size,asset.modified,asset.contentHash||'',asset.editedPath||'',asset.editedAt||0,asset.editedPreviewPath||'',asset.proxyPath||'',asset.thumbnailPath||'']);}
function fingerprint(asset) {return JSON.stringify([contentFingerprint(asset),asset.name||asset.filename,asset.note||'',asset.tags||[]]);}
function admissible(asset) {return Boolean(asset?.id&&asset.path&&!asset.deletedAt&&!asset.sourceMissing&&!asset.sourcePending&&!asset.locked&&!asset.encrypted);}
function fingerprintsMatch(current,stored){if(current===stored)return true;try{const old=JSON.parse(stored),next=JSON.parse(current),content=JSON.parse(next[0]);return old.length===9&&next.length===4&&content.length===9&&!content[4]&&!content[5]&&!content[6]&&JSON.stringify(old.slice(0,4))===JSON.stringify(content.slice(0,4))&&JSON.stringify(old.slice(7,9))===JSON.stringify(content.slice(7,9))&&JSON.stringify(old.slice(4,7))===JSON.stringify(next.slice(1));}catch{return false;}}
module.exports={POLICY,budget,systemCpuDelta,contentFingerprint,fingerprint,fingerprintsMatch,admissible};
