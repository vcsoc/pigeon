(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonPortfolioStatistics=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const TYPES=[['image','Images','#63c6b0'],['video','Video','#6ea5ec'],['audio','Audio','#efa868'],['document','Documents','#e0ca76'],['font','Fonts','#df8caa'],['other','Other','#87949e']];
  function empty(){return {totalFiles:0,totalBytes:0,byType:TYPES.map(([type,label,color])=>({type,label,color,count:0,bytes:0})),activity:{},years:[],protected:false,locations:0,collections:0};}
  function add(stats,asset){
    if(asset.deletedAt||asset.locked)return;
    const type=stats.byType.find(t=>t.type===asset.kind)||stats.byType[stats.byType.length-1];
    const bytes=Math.max(0,Number(asset.size)||0);type.count++;type.bytes+=bytes;stats.totalFiles++;stats.totalBytes+=bytes;
    const timestamp=asset.indexedAt;const date=timestamp===null||timestamp===undefined||timestamp===''?null:new Date(timestamp);
    if(date&&Number.isFinite(date.getTime())){const day=date.toISOString().slice(0,10);stats.activity[day]=(stats.activity[day]||0)+1;}
  }
  function finish(stats){stats.years=[...new Set(Object.keys(stats.activity).map(day=>Number(day.slice(0,4))))].sort((a,b)=>b-a);return stats;}
  function calendar(activity,year){
    const first=new Date(Date.UTC(year,0,1)),last=new Date(Date.UTC(year,11,31));
    const start=first.getTime()-((first.getUTCDay()+6)%7)*86400000;
    const end=last.getTime()+(6-(last.getUTCDay()+6)%7)*86400000;
    const days=[];for(let t=start;t<=end;t+=86400000){const date=new Date(t),key=date.toISOString().slice(0,10);days.push({date:key,count:Math.max(0,Number(activity[key])||0),outside:date.getUTCFullYear()!==year});}return days;
  }
  return {TYPES,empty,add,finish,calendar};
});
