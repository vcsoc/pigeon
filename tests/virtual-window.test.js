const test=require('node:test');
const assert=require('node:assert/strict');
const {bounded,layout,geometry,windowForScroll,createScrollRestorer}=require('../src/virtual-window');

for(const total of [6000,50000,100000])test(`virtual window stays bounded for ${total} assets`,()=>{
  const first=bounded({total,start:0,size:480,columns:7}),middle=bounded({total,start:Math.floor(total/2),size:480,columns:7}),last=bounded({total,start:total,size:480,columns:7});
  for(const view of [first,middle,last]){assert.equal(view.virtual,true);assert(view.count<=480);assert(view.end-view.start<=480);assert.equal(view.start%7,0);}
  assert.equal(last.end,total,'the final assets remain addressable at the bottom boundary');
});

for(const [name,columns,rowHeight] of [['grid',7,214],['list',1,62],['justified',5,172]])test(`${name} keeps a stable full extent moving bottom to top and back`,()=>{
  const total=41293,size=120,positions=[total,Math.floor(total/2),0,total],snapshots=positions.map((start)=>{const window=bounded({total,start,size,columns});return{window,layout:layout({total,start:window.start,count:window.count,columns,rowHeight})};});
  const extent=snapshots[0].layout.extentPx;
  for(const snapshot of snapshots){assert.equal(snapshot.layout.extentPx,extent);assert(snapshot.layout.topPx>=0);assert(snapshot.layout.bottomPx>=0);assert(snapshot.window.count>0);}
  assert.equal(snapshots[0].window.end,total);
  assert.equal(snapshots.at(-1).window.end,total);
  assert.deepEqual(snapshots.at(-1).window,snapshots[0].window,'the unloaded tail reappears with the same item range');
});

test('user input cancels a pending saved-position restore and background commits cannot snap back',()=>{
  let identity='collection:large:g1',interaction=0,scrollTop=0,writes=0;
  const restorer=createScrollRestorer({getIdentity:()=>identity,getInteraction:()=>interaction,write:(value)=>{scrollTop=value;writes+=1;}});
  restorer.schedule(900000,{waitUntilReady:true});
  assert.equal(restorer.commit({ready:false}),false);
  scrollTop=899200;interaction+=1;restorer.cancel();
  assert.equal(restorer.commit({ready:true}),false);
  assert.equal(scrollTop,899200);
  assert.equal(writes,0);
});

test('a view-scoped restore writes once while later thumbnail and final-sort commits are inert',()=>{
  let identity='collection:large:g1',interaction=3,scrollTop=0,writes=0;
  const restorer=createScrollRestorer({getIdentity:()=>identity,getInteraction:()=>interaction,write:(value)=>{scrollTop=value;writes+=1;}});
  restorer.schedule(64000);
  assert.equal(restorer.commit({ready:true}),true);
  assert.equal(restorer.commit({ready:true}),false);
  assert.equal(restorer.commit({ready:true}),false);
  assert.equal(scrollTop,64000);assert.equal(writes,1);
  restorer.schedule(1000);identity='smart-folder:other:g1';
  assert.equal(restorer.commit({ready:true}),false,'navigation generations cannot inherit a stale restore');
});

test('switching to a 700-result portfolio retains only the 120-card live window',()=>{
  const total=700,size=120,columns=5,top=geometry({identity:'portfolio:destination',total,start:0,size,columns,rowHeight:180,scrollTop:0,viewportHeight:900}),bottom=geometry({identity:'portfolio:destination',total,start:total,size,columns,rowHeight:180,scrollTop:999999,viewportHeight:900});
  for(const view of [top,bottom]){assert.equal(view.virtual,true);assert.equal(view.count,size);assert.ok(view.end<=total);assert.equal(view.extentPx,Math.ceil(total/columns)*180);}
  assert.equal(bottom.end,total);assert.ok(bottom.start>top.start);assert.equal(bottom.scrollTop,bottom.maxScrollTop);
});

test('view geometry clamps a stale full-library offset to the active Smart Folder extent',()=>{
  const result=geometry({identity:'smart:unrated',total:5198,start:12000,size:120,columns:5,rowHeight:180,scrollTop:500000,viewportHeight:900});
  assert.equal(result.identity,'smart:unrated');assert.equal(result.end,5198);assert.ok(result.count>0&&result.count<=120);assert.ok(result.start>=0&&result.start<result.end);assert.equal(result.extentPx,Math.ceil(5198/5)*180);assert.equal(result.scrollTop,result.maxScrollTop);
});

test('different result counts never inherit a prior view extent or blank tail',()=>{
  const library=geometry({identity:'all',total:17839,start:9000,size:120,columns:5,rowHeight:180,scrollTop:320000,viewportHeight:900}),smart=geometry({identity:'smart',total:5198,start:library.start,size:120,columns:5,rowHeight:180,scrollTop:library.scrollTop,viewportHeight:900});
  assert.equal(smart.extentPx,Math.ceil(5198/5)*180);assert.notEqual(smart.extentPx,library.extentPx);assert.equal(smart.end,5198);assert.ok(smart.count>0);assert.ok(smart.scrollTop<=smart.extentPx-900);
});

test('late thumbnail dimensions cannot change logical geometry and upward scrolling moves the window upward',()=>{
  const inputs=[1.32,.5,2.7,.8,1.9],baseline=geometry({identity:'collection',total:5200,start:5080,size:120,columns:5,rowHeight:180,scrollTop:186000,viewportHeight:900});
  for(const ratio of inputs)assert.equal(geometry({identity:'collection',total:5200,start:5080,size:120,columns:5,rowHeight:180,scrollTop:186000,viewportHeight:900,ratio}).extentPx,baseline.extentPx);
  const down=windowForScroll({total:5200,currentStart:5080,size:120,columns:5,rowHeight:180,scrollTop:baseline.maxScrollTop}),up=windowForScroll({total:5200,currentStart:down.start,size:120,columns:5,rowHeight:180,scrollTop:baseline.maxScrollTop-9000});
  assert.ok(up.start<down.start);assert.ok(bounded({total:5200,start:up.start,size:120,columns:5}).count>0);
});

test('rating membership deltas keep the window nonempty and shrink extent exactly',()=>{
  const before=geometry({identity:'smart:unrated',total:5198,start:5080,size:120,columns:5,rowHeight:180,scrollTop:186000,viewportHeight:900}),after=geometry({identity:'smart:unrated',total:5196,start:before.start,size:120,columns:5,rowHeight:180,scrollTop:before.scrollTop,viewportHeight:900});
  assert.equal(after.extentPx,Math.ceil(5196/5)*180);assert.equal(after.end,5196);assert.ok(after.count>0);assert.ok(after.scrollTop<=after.maxScrollTop);
});
