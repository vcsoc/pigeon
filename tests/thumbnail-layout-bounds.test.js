const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {build}=require('../src/virtual-layout-model');
test('extreme aspect rows never overlap or extend outside the viewport, including the final row',()=>{
  for(const width of [80,137,301,617,1230,1920])for(const cardWidth of [80,240,550])for(const count of [1,2,9,120,529]){
    const model=build({mode:'justified',width,cardWidth,ratios:Array.from({length:count},(_,i)=>[.35,.56,.75,3.5,3.5,1.32][i%6])});
    for(const item of model.items){assert.ok(item.x>=0&&item.x+item.width<=width+.001,JSON.stringify({width,cardWidth,item}));assert.ok(item.width>0);const next=model.items[item.index+1];if(next?.y===item.y)assert.ok(next.x>=item.x+item.width+3.999);}
  }
});
test('masonry distributes leftover width evenly, reaching both edges',()=>{
  for(const width of [80,301,617,1230,1920])for(const cardWidth of [80,240,550]){const model=build({mode:'grid',width,cardWidth,ratios:Array(80).fill(1)});const row=model.items.slice(0,model.columns);assert.equal(row[0].x,0);assert.ok(Math.abs(row.at(-1).x+row.at(-1).width-width)<.001);}
});
test('virtual placement overrides the flex layout minimum width',()=>{
 const css=fs.readFileSync('src/styles.css','utf8');assert.match(css,/\.virtual-card-window>\.asset-card\{[^}]*min-width:0;max-width:none/);
});
