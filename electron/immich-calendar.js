'use strict';
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
function calendarForImages(assets=[]){
  const years=new Map();
  for(const asset of assets){if(!asset||asset.type!=='IMAGE'||!asset.id)continue;const value=String(asset.localDateTime||asset.fileCreatedAt||''),match=/^(\d{4})-(\d{2})-(\d{2})/.exec(value);if(!match)continue;const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),date=new Date(0);date.setUTCFullYear(year,month-1,day);if(year<1||month<1||month>12||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)continue;if(!years.has(year))years.set(year,MONTHS.map((name,index)=>({month:index+1,name,assetIds:[]})));years.get(year)[month-1].assetIds.push(asset.id);}
  return [...years].sort(([a],[b])=>b-a).map(([year,months])=>({year,months}));
}
module.exports={calendarForImages,MONTHS};
