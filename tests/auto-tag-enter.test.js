'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

test('Enter adds a non-empty auto-tag draft but submits when the input is empty', () => {
  const handler = renderer.match(/\$\('#text-entry-input'\)\.addEventListener\('keydown'[\s\S]*?\n/)?.[0] || '';
  assert.match(handler, /textEntryTagMode&&event\.currentTarget\.value\.trim\(\)/);
  assert.match(handler, /addTextEntryTags\(event\.currentTarget\.value\.split\(','\)\)/);
  assert.match(handler, /else finishTextEntry\(true\)/);
});

test('tag autocomplete does not treat the active query as an already-used tag', () => {
  const autocomplete = renderer.slice(renderer.indexOf('function renderTagAutocomplete'), renderer.indexOf('function applyTagSuggestion'));
  assert.match(autocomplete, /input\.value\.slice\(0,token\.start\)/);
  assert.match(autocomplete, /input\.value\.slice\(token\.end\)/);
  assert.doesNotMatch(autocomplete, /input\.value\.split\(','\)/);
  assert.match(autocomplete, /exactIndex = matches\.findIndex\(\(tag\) => tag\.toLowerCase\(\) === queryKey\)/);
});
