'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const renderer = read('src/renderer.js');
const preload = read('electron/preload.js');
const main = read('electron/main.js');
const core = read('electron/library-core.js');

test('Alt+U opens the selected-tag replacement popup only in All Tags', () => {
  assert.match(renderer, /shortcutFromEvent\(event\)==='Alt\+U'&&allTagsViewActive\(\)/);
  assert.match(renderer, /title:'Replace Selected Tags'/);
  assert.match(renderer, /label:'Replacement tag'/);
  assert.match(renderer, /sources\.length<2/);
  assert.match(renderer, /multipleTags:false/);
});

test('selected tags are replaced through one atomic IPC operation', () => {
  assert.match(renderer, /window\.pigeon\.replaceTags\(sources,requested\)/);
  assert.match(preload, /replaceTags:[^\n]*tags:replace/);
  assert.match(main, /ipcMain\.handle\('tags:replace'/);
  assert.match(main, /libraryCore\.replaceTags\(library,from,to\)/);
  assert.match(main, /persistAssetBatch\(result\.assets\)/);
  assert.match(core, /function replaceTags\(library, requestedTags, to\)/);
  assert.match(core, /renameTag, replaceTags, deleteTags/);
});
