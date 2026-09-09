const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yauzl = require('yauzl');

const root = path.resolve(__dirname, '..');

test('Firefox build packages Chrome feature parity in a root-level unsigned XPI', async () => {
  // The existing browser-extension suite also invokes this builder; run this test
  // against its own temporary output tree to avoid concurrent archive writes.
  const os = require('node:os');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pigeon-firefox-'));
  try {
    fs.cpSync(path.join(root, 'browser-extension'), path.join(directory, 'browser-extension'), { recursive: true });
    fs.mkdirSync(path.join(directory, 'scripts'));
    fs.copyFileSync(path.join(root, 'scripts/build-browser-extensions.js'), path.join(directory, 'scripts/build-browser-extensions.js'));
    execFileSync(process.execPath, [path.join(directory, 'scripts/build-browser-extensions.js')], {
      timeout: 10000, env: { ...process.env, NODE_PATH: path.join(root, 'node_modules') }
    });
    const output = path.join(directory, 'release/browser-extensions');
    const firefox = JSON.parse(fs.readFileSync(path.join(output, 'firefox/manifest.json')));
    const chrome = JSON.parse(fs.readFileSync(path.join(output, 'chrome/manifest.json')));
    assert.deepEqual(firefox.content_scripts, chrome.content_scripts);
    assert.deepEqual(firefox.action, chrome.action);
    assert.deepEqual(firefox.permissions, chrome.permissions);
    assert.deepEqual(firefox.background.scripts, ['service-worker.js']);
    assert.equal(firefox.background.service_worker, undefined);
    const entries = await new Promise((resolve, reject) => {
      yauzl.open(path.join(output, `Pigeon-${firefox.version}-firefox-unsigned.xpi`), { lazyEntries: true }, (error, zip) => {
        if (error) return reject(error);
        const names = [];
        zip.on('error', reject);
        zip.on('entry', (entry) => { names.push(entry.fileName); zip.readEntry(); });
        zip.on('end', () => resolve(names));
        zip.readEntry();
      });
    });
    for (const file of ['manifest.json', 'popup.html', 'popup.js', 'content-script.js', 'drop-url.js', 'service-worker.js', 'icons/icon-128.png']) assert.ok(entries.includes(file), file);
    for (const file of ['popup.js', 'content-script.js', 'drop-url.js', 'service-worker.js']) {
      assert.deepEqual(fs.readFileSync(path.join(output, 'firefox', file)), fs.readFileSync(path.join(output, 'chrome', file)));
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
