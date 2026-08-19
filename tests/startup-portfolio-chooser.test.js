'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { portfolioChooserHtml, startupModifierPowerShell } = require('../electron/startup-portfolio-chooser');

test('startup modifier probe requires Control alone through Windows async key state', () => {
  const script = startupModifierPowerShell();
  assert.match(script, /GetAsyncKeyState\(0x11\)/);
  assert.doesNotMatch(script, /GetAsyncKeyState\(0x10\)/);
  assert.match(script, /if\(\$control\)/);
});

test('startup portfolio chooser escapes names and exposes selection and safe cancellation', () => {
  const html = portfolioChooserHtml([{ id: 'safe', name: '<Broken & Current>' }, { id: 'recovery', name: 'Recovery' }], 'safe');
  assert.match(html, /&lt;Broken &amp; Current&gt;/);
  assert.match(html, /data-portfolio-id="recovery"/);
  assert.match(html, /pigeon-portfolio-choice:\/\/select/);
  assert.match(html, /pigeon-portfolio-choice:\/\/cancel/);
  assert.match(html, /bypass a portfolio that cannot be loaded/);
});
