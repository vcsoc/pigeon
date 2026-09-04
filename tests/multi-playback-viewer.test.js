'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=(file)=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const renderer=read('src/renderer.js'),html=read('src/index.html'),styles=read('src/styles.css');

test('viewer opens up to six selected videos or animated images in a looping muted grid',()=>{
  assert.match(html,/id="viewer-multi-playback"/);
  assert.match(html,/id="viewer-multi-grid"/);
  assert.match(renderer,/function isMultiPlaybackAsset/);
  assert.match(renderer,/\['GIF','WEBP'\]/);
  assert.match(renderer,/\.filter\(isMultiPlaybackAsset\)\.slice\(0,6\)/);
  assert.match(renderer,/function openMultiPlaybackViewer/);
  assert.match(renderer,/video\.muted=true;video\.defaultMuted=true;video\.loop=true/);
  assert.match(renderer,/Multi-playback is limited to 6 items/);
  assert.match(styles,/\.viewer-multi-grid/);
  assert.match(styles,/--multi-columns/);
});

test('multi-playback synchronizes Alt-seeking and toggles every item with Space',()=>{
  assert.match(renderer,/function syncMultiPlaybackSeek/);
  assert.match(renderer,/multiPlaybackAltPressed\|\|performance\.now\(\)<multiPlaybackAltSeekUntil/);
  assert.match(renderer,/pointerdown[^\n]+event\.altKey[^\n]+multiPlaybackAltSeekUntil=performance\.now\(\)\+1500/);
  assert.match(renderer,/video\.currentTime=Math\.max\(0,Math\.min\(source\.currentTime/);
  assert.match(renderer,/event\.key==='Alt'&&isMultiPlaybackOpen\(\)/);
  assert.match(renderer,/if\(isMultiPlaybackOpen\(\)\)toggleMultiPlayback\(\)/);
  assert.match(renderer,/Space \$\{multiPlaybackPlaying\?'pauses':'plays'\} all/);
  assert.match(renderer,/data-motion-src/);
  assert.match(renderer,/data-still-src/);
});
