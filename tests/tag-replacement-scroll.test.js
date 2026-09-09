const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8');
function harness(){
 let mutation,disconnected=false,rowPresent=true,scrolls=0;const frames=[];
 const wrap={scrollTop:0,getBoundingClientRect:()=>({top:0,bottom:500})};
 const row={focus(){},getBoundingClientRect:()=>({top:2000-wrap.scrollTop,bottom:2040-wrap.scrollTop}),scrollIntoView(){scrolls++;wrap.scrollTop=1800;}};
 const context={state:{},gridScrollInteractionVersion:1,selectedTagNames:new Set(['replacement']),allTagsViewActive:()=>true,CSS:{escape:value=>value},elements:{gridWrap:wrap,tagBrowser:{querySelector:()=>rowPresent?row:null}},MutationObserver:class{constructor(callback){mutation=callback;}observe(){}disconnect(){disconnected=true;}},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame(){},setTimeout:()=>1,clearTimeout(){}};
 vm.createContext(context);vm.runInContext(renderer.slice(renderer.indexOf('let cancelTagReplacementReveal='),renderer.indexOf('async function replaceSelectedTags')),context);
 return{context,wrap,flush(){while(frames.length)frames.shift()();},mutate(){mutation();},setPresent(value){rowPresent=value;},get disconnected(){return disconnected;},get scrolls(){return scrolls;}};
}
test('a visible replacement never jumps back to the old scroll position on subsequent rebuilds',()=>{
 const h=harness();h.context.revealSelectedTag('replacement',100);h.flush();assert.equal(h.wrap.scrollTop,1800);
 h.mutate();h.flush();assert.equal(h.wrap.scrollTop,1800);assert.equal(h.scrolls,1);
});
test('replacement reveal waits for a late row and cancels after user scrolling',()=>{
 const h=harness();h.setPresent(false);h.context.revealSelectedTag('replacement',100);h.flush();assert.equal(h.scrolls,0);
 h.setPresent(true);h.mutate();h.flush();assert.equal(h.scrolls,1);
 h.context.gridScrollInteractionVersion++;h.wrap.scrollTop=20;h.mutate();h.flush();assert.equal(h.wrap.scrollTop,20);assert.equal(h.disconnected,true);
});
