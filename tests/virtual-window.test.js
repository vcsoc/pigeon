const test=require('node:test');
const assert=require('node:assert/strict');
const {bounded,layout,createScrollRestorer}=require('../src/virtual-window');

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
