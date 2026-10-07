"use strict";
const os = require('node:os');
const POLICY = Object.freeze({automatic: {cpu: 0.12, memory: 0.12, busy: 0.35}, manual: {cpu: 0.18, memory: 0.18, busy: 0.70}});
function budget(mode='automatic', cores=os.cpus().length, memory=os.totalmem()) {
  const p=POLICY[mode]||POLICY.automatic;
  return {...p, cores:Math.max(1,cores), threads:Math.max(1,Math.floor(cores*p.cpu)), fileWorkers:Math.min(mode==='manual'?4:2,Math.max(1,cores)), memoryBytes:Math.floor(memory*p.memory)};
}
function systemCpuDelta(previous, current) {
  if(!previous?.length||previous.length!==current.length)return null;
  let total=0,idle=0;
  for(let i=0;i<current.length;i++){for(const key of ['user','nice','sys','idle','irq'])total+=Math.max(0,current[i].times[key]-previous[i].times[key]);idle+=Math.max(0,current[i].times.idle-previous[i].times.idle);}
  return total>0?Math.max(0,Math.min(1,1-idle/total)):null;
}
function fingerprint(asset) {return JSON.stringify([asset.path,asset.size,asset.modified,asset.contentHash||'',asset.name||asset.filename,asset.note||'',asset.tags||[],asset.proxyPath||'',asset.thumbnailPath||'']);}
function admissible(asset) {return Boolean(asset?.id&&asset.path&&!asset.deletedAt&&!asset.sourceMissing&&!asset.sourcePending&&!asset.locked&&!asset.encrypted);}
module.exports={POLICY,budget,systemCpuDelta,fingerprint,admissible};
