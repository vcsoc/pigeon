'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),styles=fs.readFileSync(path.join(root,'src/styles.css'),'utf8'),renderer=fs.readFileSync(path.join(root,'src/renderer.js'),'utf8');
test('Spoiler caches source-coloured grains without timers, animated resources or per-frame paint',()=>{
 assert.match(styles,/\.privacy-spoiler-base\{opacity:var\(--spoiler-contour-opacity/);assert.match(styles,/\.privacy-spoiler-grain\{[^}]*animation:none/);assert.doesNotMatch(styles,/privacy-spoiler\.svg|privacy-spoiler-static\.svg|@keyframes spoiler-grain-motion/);
 const helper=renderer.slice(renderer.indexOf('function renderSpoilerGrains('),renderer.indexOf('function renderSpoilerPreferencePreview('));assert.match(helper,/drawImage\(base/);assert.match(helper,/destination-in/);assert.doesNotMatch(helper,/setInterval|setTimeout|requestAnimationFrame|animationDuration|animationDelay/);assert.match(renderer,/spoilerStyle\(strength\)\.columns/);assert.match(renderer,/if\(video&&!spoiler&&!glitch&&media\.requestVideoFrameCallback\)/);assert.match(helper,/Math\.min\(240/);assert.match(helper,/Math\.min\(1024/);
});
test('Spoiler grain masks are small, static alpha textures',async()=>{
 for(let i=0;i<4;i++){const metadata=await sharp(path.join(root,`src/privacy-spoiler-grains-${i}.png`)).metadata();assert.equal(metadata.width,96);assert.equal(metadata.height,96);assert.equal(metadata.hasAlpha,true);assert(!metadata.pages||metadata.pages===1);}
});
