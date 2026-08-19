const test=require('node:test');
const assert=require('node:assert/strict');
const layout=require('../src/virtual-layout-model');

const ratios=Array.from({length:5198},(_,index)=>[.42,.66,.8,1,1.25,1.5,1.78,2.2,3.1][index%9]);
const cases=[
  {viewport:1280,sidebar:298,inspector:360,size:120},
  {viewport:1600,sidebar:340,inspector:420,size:180},
  {viewport:1920,sidebar:298,inspector:0,size:240},
];
function contentWidth(item){return item.viewport-item.sidebar-item.inspector-12;}
function assertContiguous(model,scrollTop){const range=layout.windowForScroll({model,scrollTop,viewportHeight:720,size:480}),indices=model.items.slice(range.start,range.end).map((item)=>item.index);assert.ok(indices.length);assert.equal(indices.at(0),range.start);assert.equal(indices.at(-1),range.end-1);assert.deepEqual(indices,Array.from({length:range.count},(_,index)=>range.start+index));return range;}

test('grid masonry packs every column with only configured spacing at representative widths',()=>{
  for(const item of cases){const model=layout.build({mode:'grid',width:contentWidth(item),cardWidth:item.size,gap:4,metaHeight:32,ratios});assert.equal(model.total,ratios.length);assert.ok(model.density>.72,`density ${model.density} at ${model.width}px`);const columns=new Map();for(const card of model.items){const key=card.x;if(!columns.has(key))columns.set(key,[]);columns.get(key).push(card);}assert.equal(columns.size,model.columns);for(const cards of columns.values())for(let index=1;index<cards.length;index++)assert.ok(Math.abs(cards[index].y-(cards[index-1].y+cards[index-1].height+4))<.001);assert.equal(model.extentPx,Math.max(...model.items.map((card)=>card.y+card.height)));assertContiguous(model,model.extentPx*.48);}
});

test('justified rows densely fill every complete row without oversized unused bands',()=>{
  for(const item of cases){const model=layout.build({mode:'justified',width:contentWidth(item),cardWidth:item.size,gap:4,metaHeight:32,ratios}),rows=new Map();for(const card of model.items){const key=card.y.toFixed(3);if(!rows.has(key))rows.set(key,[]);rows.get(key).push(card);}assert.ok(model.density>.78,`density ${model.density} at ${model.width}px`);const values=[...rows.values()];for(let rowIndex=0;rowIndex<values.length;rowIndex++){const row=values[rowIndex];for(let index=1;index<row.length;index++)assert.ok(Math.abs(row[index].x-(row[index-1].x+row[index-1].width+4))<.001);const unused=model.width-(row.at(-1).x+row.at(-1).width);if(rowIndex<values.length-1)assert.ok(unused<1,`complete row left ${unused}px`);else assert.ok(unused<model.width*.7,'last row wastes most of the viewport');}assertContiguous(model,model.extentPx*.52);}
});

test('list uses one full-width card per logical row with no missing slots',()=>{
  const model=layout.build({mode:'list',width:920,cardWidth:200,gap:3,ratios});assert.equal(model.columns,1);assert.ok(model.density>.94);for(let index=1;index<model.items.length;index++){assert.equal(model.items[index].index,index);assert.equal(model.items[index].x,0);assert.equal(model.items[index].width,920);assert.equal(model.items[index].y-model.items[index-1].y,62);}assertContiguous(model,model.extentPx*.4);
});

test('responsive relayout preserves the same anchor and recalculates one exact extent',()=>{
  for(const mode of ['grid','justified','list']){const before=layout.build({mode,width:690,cardWidth:160,gap:mode==='list'?3:4,metaHeight:mode==='list'?10:32,ratios}),after=layout.build({mode,width:1080,cardWidth:220,gap:mode==='list'?3:4,metaHeight:mode==='list'?10:32,ratios}),anchor=layout.anchorForScroll(before,before.extentPx*.57),scroll=layout.scrollForAnchor(after,anchor,720),range=assertContiguous(after,scroll);assert.ok(range.start<=anchor.index&&range.end>anchor.index);assert.notEqual(before.key,after.key);assert.equal(after.extentPx,Math.max(...after.items.map((card)=>card.y+card.height)));}
});

test('late aspect refinement rebuilds exact geometry without ratcheting or losing navigation',()=>{
  const initial=layout.build({mode:'grid',width:980,cardWidth:156,gap:4,metaHeight:32,ratios}),changed=[...ratios];changed[2600]=.35;changed[2601]=3.5;const refined=layout.build({mode:'grid',width:980,cardWidth:156,gap:4,metaHeight:32,ratios:changed}),anchor=layout.anchorForScroll(initial,initial.extentPx*.65),scroll=layout.scrollForAnchor(refined,anchor,700);assert.notEqual(refined.key,initial.key);assert.equal(refined.extentPx,Math.max(...refined.items.map((card)=>card.y+card.height)));assert.ok(assertContiguous(refined,scroll).start<=anchor.index);
});

test('bottom to up to down windows remain contiguous and retain the full result tail',()=>{
  for(const mode of ['grid','justified','list']){const model=layout.build({mode,width:1040,cardWidth:180,gap:mode==='list'?3:4,metaHeight:mode==='list'?10:32,ratios}),bottom=assertContiguous(model,model.extentPx-720),up=assertContiguous(model,model.extentPx*.55),down=assertContiguous(model,model.extentPx-720);assert.equal(bottom.end,ratios.length);assert.ok(up.start<bottom.start);assert.equal(down.end,ratios.length);}
});

test('fullscreen masonry expands beyond the base window and never clips visible lanes or the tail',()=>{
  const viewportHeight=1280,model=layout.build({mode:'grid',width:3560,cardWidth:80,gap:4,metaHeight:32,ratios});
  const assertVisibleRange=(scrollTop)=>{const overscanPx=viewportHeight*.75,lower=Math.max(0,scrollTop-overscanPx-model.maxItemHeight),upper=scrollTop+viewportHeight+overscanPx,visible=model.items.filter((item)=>item.y+item.height>=lower&&item.y<=upper),range=layout.windowForScroll({model,scrollTop,viewportHeight,size:120});assert.ok(visible.length);assert.ok(range.count>=120);for(const item of visible)assert.ok(item.index>=range.start&&item.index<range.end,`card ${item.index} at ${item.y}px was clipped from ${range.start}-${range.end}`);return range;};
  const top=assertVisibleRange(0),middle=assertVisibleRange(model.extentPx*.5),bottom=assertVisibleRange(model.extentPx-viewportHeight);
  assert.ok(top.count>120,'fullscreen viewport must grow beyond the normal 120-card base window');assert.ok(middle.start>top.start);assert.equal(bottom.end,model.total,'the final source items must render at the bottom');
});
