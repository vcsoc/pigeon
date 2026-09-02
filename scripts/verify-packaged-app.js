'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');

const projectRoot = path.join(__dirname, '..');
const criticalFiles = [
  'src/index.html',
  'src/styles.css',
  'src/icons.js',
  'src/world-land.js',
  'src/cooperative-view.js',
  'src/asset-indexes.js',
  'src/renderer.js',
  'pigeon-logo.png',
  'electron/main.js',
  'electron/preload.js',
  'electron/media-stream.js',
  'electron/pigeon-collection.js',
  'electron/embedded-metadata.js',
  'electron/image-derivative.js',
  'electron/ai-enlarger.js',
  'electron/edited-preview.js',
  'electron/ai-models/super-resolution-10.onnx',
  'node_modules/onnxruntime-web/dist/ort.node.min.js',
  'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
  'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
  'electron/thumbnail-worker.js',
  'electron/folder-tree-worker.js',
  'electron/library-deduplication.js',
  'electron/background-thread-manager.js',
  'electron/plugin-manager.js',
  'electron/plugin-examples/ai-removal/server.py',
  'electron/plugin-examples/ai-removal/requirements.txt',
  'electron/plugin-examples/ai-removal/README.md'
];

function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function findAsar(directory) {
  const pending = [directory];
  while (pending.length) {
    const current = pending.shift();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isFile() && entry.name === 'app.asar') return target;
      if (entry.isDirectory()) pending.push(target);
    }
  }
  return null;
}

function verifyPackagedApp(asarPath) {
  if (!asarPath || !fs.existsSync(asarPath)) throw new Error(`Packaged app.asar was not found: ${asarPath || 'unknown path'}`);
  const failures = [];
  for (const relativePath of criticalFiles) {
    const sourcePath = path.join(projectRoot, relativePath);
    let packaged;
    try { packaged = asar.extractFile(asarPath, relativePath.split('/').join(path.sep)); }
    catch (error) { failures.push(`${relativePath}: missing (${error.message})`); continue; }
    const source = fs.readFileSync(sourcePath);
    if (source.length !== packaged.length || digest(source) !== digest(packaged)) failures.push(`${relativePath}: packaged bytes do not match source`);
  }
  if (failures.length) throw new Error(`Packaged application integrity check failed:\n${failures.join('\n')}`);
  console.log(`Verified ${criticalFiles.length} critical files in ${asarPath}`);
  return true;
}

async function afterPack(context) {
  verifyPackagedApp(findAsar(context.appOutDir));
}

module.exports = afterPack;
module.exports.criticalFiles = criticalFiles;
module.exports.findAsar = findAsar;
module.exports.verifyPackagedApp = verifyPackagedApp;

if (require.main === module) verifyPackagedApp(process.argv[2] || findAsar(process.cwd()));
