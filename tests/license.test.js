'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('project licensing preserves the community, commercial, notice, and trademark terms', () => {
  assert.match(read('LICENSE.md'), /^# PolyForm Shield License 1\.0\.0/m);
  assert.match(read('LICENSE.md'), /^## Noncompete/m);
  assert.match(read('NOTICE.md'), /^Required Notice: Copyright © 2026 Chris Visser/m);
  assert.match(read('NOTICE.md'), /^Licensor Line of Business: Pigeon visual asset management/m);
  assert.match(read('COMMERCIAL-LICENSE.md'), /does not itself grant a commercial license/);
  assert.match(read('TRADEMARKS.md'), /software license does not grant permission to use that branding/);
  assert.match(read('CONTRIBUTING.md'), /will not be merged/);
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.license, 'SEE LICENSE IN LICENSE.md');
  for (const file of ['LICENSE.md', 'NOTICE.md', 'COMMERCIAL-LICENSE.md', 'TRADEMARKS.md']) assert.ok(manifest.build.files.includes(file));
});

test('About presents every distributed legal document in flat inline tabs', () => {
  const html=read('src/index.html'),styles=read('src/styles.css'),renderer=read('src/renderer.js'),preload=read('electron/preload.js'),main=read('electron/main.js');
  for(const key of ['community','commercial','notices','trademarks']) assert.match(html,new RegExp(`data-about-license="${key}"`));
  assert.match(html,/id="about-layout" class="about-layout"/);
  assert.match(html,/id="about-license-text"[^>]*role="tabpanel"/);
  assert.match(styles,/\.about-layout \{[^}]*grid-template-columns/);
  assert.match(styles,/\.about-license-tabs button \{[^}]*border:0;[^}]*background:transparent/);
  assert.match(styles,/\.about-license-text \{[^}]*overflow:auto/);
  assert.match(preload,/getLegalDocuments: \(\) => ipcRenderer\.invoke\('app:legal-documents'\)/);
  assert.match(main,/ipcMain\.handle\('app:legal-documents'/);
  assert.match(renderer,/function selectAboutLegalDocument/);
  assert.match(renderer,/about-license-tabs/);
});
