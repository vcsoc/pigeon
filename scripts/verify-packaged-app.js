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
  'src/renderer.js',
  'electron/main.js',
  'electron/preload.js',
  'electron/embedded-metadata.js',
  'electron/thumbnail-worker.js'
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
    try { packaged = asar.extractFile(asarPath, relativePath); }
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
