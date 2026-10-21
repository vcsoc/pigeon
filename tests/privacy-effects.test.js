'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const policy=require('../src/privacy-effects');
test('privacy modes cycle predictably without an unprotected/off step',()=>{
 assert.deepEqual(policy.modes,['blur','pixelate','spoiler','glitch','hidden']);let mode='blur';const visited=[];for(let i=0;i<5;i++){mode=policy.next(mode);visited.push(mode);}assert.deepEqual(visited,['pixelate','spoiler','glitch','hidden','blur']);assert.equal(policy.next('invalid'),'blur');
});
test('privacy strength maxima double while preserving existing settings',()=>{
 assert.deepEqual(policy.normalize('blur',80),{mode:'blur',minimum:8,maximum:80,strength:80});assert.equal(policy.normalize('pixelate',120).strength,120);assert.equal(policy.normalize('pixelate',999).strength,120);assert.equal(policy.normalize('blur',999).strength,80);
 assert.equal(policy.normalize('blur',40).strength,40);assert.equal(policy.normalize('pixelate',60).strength,60);assert.equal(policy.normalize('spoiler',80).strength,80);assert.equal(policy.normalize('glitch',1000).strength,80);assert.equal(policy.normalize('glitch',undefined).strength,35);assert.equal(policy.glitchScale(8),.45);assert.equal(policy.glitchScale(80),1.35);assert.equal(policy.glitchScale(Infinity),.7875);assert.equal(policy.normalize('pixelate',1).strength,6);
});
test('Spoiler is adjustable and higher strengths remove contours and source detail',()=>{assert.deepEqual(policy.normalize('spoiler',35),{mode:'spoiler',minimum:8,maximum:80,strength:35});assert.equal(policy.normalize('spoiler',1).strength,8);assert.equal(policy.normalize('spoiler',999).strength,80);let previous=policy.spoilerStyle(8);for(let strength=9;strength<=80;strength++){const current=policy.spoilerStyle(strength);assert(current.columns<=previous.columns);assert(current.contourOpacity<previous.contourOpacity);previous=current;}assert.equal(previous.columns,8);});
test('all five modes default to 35 without overriding valid saved strengths',()=>{for(const mode of policy.modes){assert.equal(policy.normalize(mode,undefined).strength,35);assert.equal(policy.normalize(mode,48).strength,48);}assert.equal(policy.defaultStrength,35);});
test('glitch displacement stays finite, bounded and monotonic across strengths',()=>{
 for(const value of [undefined,NaN,Infinity,-Infinity,'bad',0,-1])assert.equal(policy.glitchScale(value),.7875);
 let previous=0;for(let strength=8;strength<=80;strength++){const scale=policy.glitchScale(strength);assert(Number.isFinite(scale)&&scale>=.45&&scale<=1.35&&scale>previous);previous=scale;}
 assert.equal(policy.glitchScale(999),1.35);assert.equal(policy.glitchScale(1),.45);
});
test('Glitch reuses normalized channel canvases without reading protected source pixels',()=>{
 let allocations=0,draws=0;function canvas(width,height){const surface={width,height,ownerDocument:{createElement(){allocations++;return canvas(0,0);}}};surface.getContext=()=>({canvas:surface,fillRect(){},drawImage(){draws++;}});return surface;}
 const context=canvas(240,140).getContext(),media={};policy.drawGlitch(context,media,24);const layers=context.canvas._glitchLayers;assert.equal(allocations,3);assert(draws>100);policy.drawGlitch(context,media,80);assert.equal(context.canvas._glitchLayers,layers);assert.equal(allocations,3);assert.equal(context.globalAlpha,1);assert.equal(context.globalCompositeOperation,'source-over');policy.releaseGlitch(context);assert.equal(context.canvas._glitchLayers,undefined);assert(layers.every(layer=>layer.canvas.width===0&&layer.canvas.height===0));policy.drawGlitch(context,media,35);assert.equal(allocations,6);
});
test('invalid modes and strengths normalize safely, including non-finite numbers',()=>{
 for(const value of [undefined,NaN,Infinity,-Infinity,'bad',0,-1])assert.equal(policy.normalize('invalid',value).strength,35);
 assert.equal(policy.normalize('pixelate',undefined).strength,35);assert.equal(policy.normalize('spoiler',undefined).strength,35);assert.equal(policy.normalize('hidden',1000).strength,80);
});
test('magnifier fitting uses only the actual image rectangle, including quarter turns',()=>{assert.deepEqual(policy.fitPreview(1920,1080,0,600,800),{width:600,height:337.5,imageWidth:600,imageHeight:337.5});for(const angle of [90,-90,270])assert.deepEqual(policy.fitPreview(1920,1080,angle,600,800),{width:450,height:800,imageWidth:800,imageHeight:450});assert.deepEqual(policy.fitPreview(1920,1080,180,600,800),policy.fitPreview(1920,1080,0,600,800));});
test('magnifier fitting never returns invalid dimensions while preview metadata is loading',()=>{for(const input of [[0,0,0,0,0],[Infinity,NaN,Infinity,600,800],['bad',null,undefined,-1,600]]){const fitted=policy.fitPreview(...input);for(const value of Object.values(fitted))assert(Number.isFinite(value)&&value>=0);}});
test('cycling persists normalized mode/strength without changing private asset membership',async()=>{
 const source=fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),code=source.slice(source.indexOf('async function cycleThumbnailPrivacyEffect('),source.indexOf('function applyTreeLevelColors('));
 const preferences={thumbnailEffectMode:'pixelate',thumbnailEffectStrength:120},select={},saved=[],toasts=[],storage=new Map();
 const sandbox={preferences,document:{querySelector:()=>select},window:{PigeonPrivacyEffects:policy,pigeon:{updatePreferences:async value=>saved.push({...value})}},localStorage:{setItem:(k,v)=>storage.set(k,v)},showToast:text=>toasts.push(text),applyThumbnailEffectPreferences(){const value=policy.normalize(preferences.thumbnailEffectMode,preferences.thumbnailEffectStrength);preferences.thumbnailEffectMode=value.mode;preferences.thumbnailEffectStrength=value.strength;}};
 vm.createContext(sandbox);vm.runInContext(code,sandbox);await sandbox.cycleThumbnailPrivacyEffect();assert.equal(select.value,'spoiler');assert.equal(saved[0].thumbnailEffectStrength,35);assert.equal(JSON.parse(storage.get('pigeon.preferences')).thumbnailEffectMode,'spoiler');assert.match(toasts[0],/Spoiler/);
 await sandbox.cycleThumbnailPrivacyEffect();assert.equal(select.value,'glitch');assert.match(toasts[1],/Glitch/);await sandbox.cycleThumbnailPrivacyEffect();assert.equal(select.value,'hidden');await sandbox.cycleThumbnailPrivacyEffect();assert.equal(select.value,'blur');assert.equal(saved.length,4);await sandbox.cycleThumbnailPrivacyEffect();assert.equal(select.value,'pixelate');assert.equal(saved[4].thumbnailEffectStrength,120);assert.equal(preferences.thumbnailEffectStrengths.pixelate,120);
});
