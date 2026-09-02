const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'browser-extension');
const output = path.join(root, 'release', 'browser-extensions');
const chromiumBrowsers = ['chrome', 'edge', 'brave', 'opera', 'vivaldi'];
const targets = [...chromiumBrowsers, 'firefox', 'safari'];
const browserNames = { chrome: 'Chrome', edge: 'Edge', brave: 'Brave', opera: 'Opera', vivaldi: 'Vivaldi', firefox: 'Firefox', safari: 'Safari' };

function copySharedFiles(destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name.startsWith('manifest.') || entry.name === 'README.md') continue;
    fs.cpSync(path.join(source, entry.name), path.join(destination, entry.name), { recursive: true });
  }
}

fs.mkdirSync(output, { recursive: true });
for (const browser of targets) {
  const destination = path.join(output, browser);
  copySharedFiles(destination);
  const manifestSource = browser === 'firefox' ? 'manifest.firefox.json' : 'manifest.json';
  const manifest = JSON.parse(fs.readFileSync(path.join(source, manifestSource), 'utf8'));
  manifest.name = `Pigeon for ${browserNames[browser]}`;
  fs.writeFileSync(path.join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(`Built ${targets.length} browser packages in ${path.relative(root, output)}`);
console.log('Safari: run xcrun safari-web-extension-converter release/browser-extensions/safari on macOS to create the signed Xcode wrapper.');
