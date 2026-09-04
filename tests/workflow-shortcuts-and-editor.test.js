'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const renderer = read('src/renderer.js');
const main = read('electron/main.js');
const html = read('src/index.html');
const styles = read('src/styles.css');

test('tag replacement preserves scroll and reveals the selected replacement tag', () => {
  const source = renderer.slice(renderer.indexOf('function revealSelectedTag'), renderer.indexOf("elements.tagBrowser.addEventListener('click'"));
  assert.match(source, /previousScrollTop=elements\.gridWrap\.scrollTop/);
  assert.match(source, /selectedTagNames=new Set\(\[String\(resolved\)\.toLowerCase\(\)\]\)/);
  assert.match(source, /revealSelectedTag\(resolved,previousScrollTop\)/);
  assert.match(source, /row\.scrollIntoView\(\{block:'center'/);
});

test('Escape reliably exits the internal viewer before global shortcuts run', () => {
  assert.match(renderer, /window\.addEventListener\('keydown',\(event\)=>\{if\(event\.key!==\'Escape\'/);
  assert.match(renderer, /event\.stopImmediatePropagation\(\);lastEscapeShortcutAt=0;closeInternalViewer\(\)/);
  const capture=renderer.indexOf("window.addEventListener('keydown',(event)=>{if(event.key!=='Escape'");
  assert.ok(capture >= 0 && capture < renderer.indexOf("document.addEventListener('keydown', (event) => {",capture));
});

test('double Escape opens the virtual Pigeon-tag view and Alt+P tags selected thumbnails', () => {
  assert.match(renderer, /function openPigeonTaggedView\(\)/);
  assert.match(renderer, /state\.view='pigeon-tag'/);
  assert.match(renderer, /state\.filters\.tags\.add\('pigeon'\)/);
  assert.match(renderer, /now-lastEscapeShortcutAt<=500/);
  assert.match(renderer, /openPigeonTaggedView\(\)/);
  assert.match(renderer, /shortcutFromEvent\(event\)==='Alt\+P'&&thumbnailGridActive\(\)/);
  assert.match(renderer, /addTagsToAssets\(ids,\['pigeon'\]\)/);
});

test('duplicates remain adjacent to their original in immediate and rebuilt views', () => {
  assert.match(renderer, /duplicateAdjacencyById\.set\(duplicate\.id,sourceId\)/);
  assert.match(renderer, /sourceCard\.after\(card\)/);
  assert.match(renderer, /function placeDuplicatesNextToSources/);
  assert.match(renderer, /finalIndices=placeDuplicatesNextToSources\(finalIndices/);
  assert.match(renderer, /result\.next=placeDuplicatesNextToSources\(result\.next/);
});

test('duplicates inherit and immediately display the source privacy effect', () => {
  const duplicate = main.slice(main.indexOf('async function duplicateAsset'), main.indexOf('const EDITABLE_PREVIEW_EXTENSIONS'));
  const stage = renderer.slice(renderer.indexOf('function stageDuplicatedAssetCard'), renderer.indexOf('async function duplicateAssetsWithoutGridRefresh'));
  assert.match(duplicate, /duplicate\.thumbnailEffect=Boolean\(source\.thumbnailEffect\)/);
  assert.match(stage, /classList\.toggle\('thumbnail-effect-applied',Boolean\(duplicate\.thumbnailEffect\)\)/);
  assert.match(stage, /renderPixelatedCard\(card\)/);
});

test('an idle Threads panel returns to Details when an asset is selected', () => {
  const inspector = renderer.slice(renderer.indexOf('function renderInspector()'), renderer.indexOf('function renderBatchBar'));
  assert.match(inspector, /right-panel-threads-tab/);
  assert.match(inspector, /!activeBackgroundThreads\(\)\.length/);
  assert.match(inspector, /selectRightPanelTab\('details'\)/);
});

test('editor resize controls use a compact aspect toggle beside Original', () => {
  assert.match(html, /class="editor-resize-actions"/);
  assert.match(html, /id="edit-resize-reset" title="Restore the image width and height to the original source dimensions">Original</);
  assert.match(html, /class="editor-aspect-toggle"/);
  assert.match(html, /id="edit-resize-lock" type="checkbox" checked/);
  assert.doesNotMatch(html, />Original dimensions</);
  assert.match(styles, /\.editor-aspect-toggle input:checked\+span::before/);
});
