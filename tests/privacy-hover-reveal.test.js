'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const renderer=fs.readFileSync(require.resolve('../src/renderer.js'),'utf8');
const code=renderer.slice(renderer.indexOf('function attachHoverMediaPreview('),renderer.indexOf('\nfunction shapeFor('));
function fixture(kind='image'){
  let hovered=null,blocked=false;
  const frames=[],previews=[],stops=new Set(),reveals=new Set();
  const classes=()=>{const values=new Set();return{add:value=>values.add(value),remove:value=>values.delete(value),contains:value=>values.has(value)};};
  class Media{constructor(){this.classList=classes();this.events={};this.plays=0;}addEventListener(name,fn){this.events[name]=fn;}remove(){this.parent.children=this.parent.children.filter(value=>value!==this);}play(){this.plays++;return Promise.resolve();}pause(){}load(){}removeAttribute(){}}
  class Video extends Media{}
  const context=vm.createContext({
    state:{thumbnailEffectRevealPressed:false,view:'all'},preferences:{videoHoverPreview:true,audioHoverPreview:true,hoverPreviewDelay:0,hoverAudioShortcut:'Ctrl'},
    isOffline:()=>false,temporaryShortcutPressed:()=>false,protectedUrl:value=>value,formatMediaTime:()=>'',
    activeHoverPreviewStops:stops,activeProtectedHoverReveals:reveals,hoveredVideoSoundSync:null,
    setTimeout,clearTimeout,requestAnimationFrame:fn=>frames.push(fn),HTMLVideoElement:Video,
    document:{elementFromPoint:()=>blocked?{}:hovered,createElement:tag=>tag==='video'?new Video():new Media()},
    window:{pigeon:{monitorHoverControl(){}},addEventListener(){},removeEventListener(){}}
  });
  vm.runInContext(code,context);
  for(let i=0;i<5;i++){
    const preview={events:{},children:[],classList:classes(),style:{setProperty(){},removeProperty(){}},matches:()=>hovered===preview,
      contains:node=>node===preview,querySelector:()=>null,getBoundingClientRect:()=>({left:i*100,width:100}),
      addEventListener(name,fn){this.events[name]=fn;},appendChild(node){node.parent=this;this.children.push(node);}};
    const card={isConnected:true,querySelector:()=>preview,addEventListener(){}};
    context.attachHoverMediaPreview(card,{id:String(i),kind,extension:kind==='image'?'GIF':'MP4',thumbnailEffect:true,duration:2,mediaUrl:'fixture'});
    previews.push({preview,card,enter:()=>preview.events.pointerenter({clientX:i*100+50,clientY:50})});
  }
  return{context,previews,reveals,frames,hover:index=>hovered=index===null?null:previews[index].preview,block:()=>blocked=true,
    press(value){context.state.thumbnailEffectRevealPressed=value;for(const reveal of [...reveals])reveal(value,{key:'Alt',altKey:value});},
    media:()=>previews.flatMap(value=>value.preview.children),flush(){while(frames.length)frames.shift()();}};
}
test('Alt never reveals the five stale private hover registrations when the pointer is elsewhere',()=>{
  const f=fixture();for(const item of f.previews)item.enter();assert.equal(f.reveals.size,5);
  f.press(true);assert.equal(f.media().length,0);assert.equal(f.reveals.size,0);
});
test('Alt reveals only the current private thumbnail and removes stale registrations',()=>{
  const f=fixture();f.hover(2);for(const item of f.previews)item.enter();f.press(true);
  assert.equal(f.media().length,1);assert.equal(f.previews[2].preview.children.length,1);assert.equal(f.reveals.size,1);
  f.press(false);assert.equal(f.media().length,0);f.press(true);assert.equal(f.media().length,1);
  f.hover(null);f.press(true);assert.equal(f.media().length,0);assert.equal(f.reveals.size,0);
});
test('detached cards and occluded previews cannot authorize a private reveal',()=>{
  for(const detached of [false,true]){const f=fixture();f.hover(1);f.previews[1].enter();if(detached)f.previews[1].card.isConnected=false;else f.block();f.press(true);assert.equal(f.media().length,0);assert.equal(f.reveals.size,0);}
});
test('late image/video readiness and animation frames cannot expose a thumbnail after hover is lost',()=>{
  for(const kind of ['image','video'])for(const afterLoad of [false,true]){
    const f=fixture(kind);f.hover(0);f.previews[0].enter();f.press(true);const media=f.media()[0];assert(media);
    if(afterLoad)media.events[kind==='image'?'load':'loadeddata']();
    f.hover(null);if(!afterLoad)media.events[kind==='image'?'load':'loadeddata']();f.flush();
    assert.equal(media.classList.contains('hover-media-ready'),false);
    assert.equal(f.previews[0].preview.classList.contains(kind==='image'?'animated-hovering':'media-hovering'),false);
    f.press(false);assert.equal(f.media().length,0);
  }
});
