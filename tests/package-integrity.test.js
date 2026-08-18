'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const asar = require('@electron/asar');
const verifier = require('../scripts/verify-packaged-app');

const projectRoot = path.join(__dirname, '..');

test('packaged startup resources must exactly match their source files', async () => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'pigeon-asar-integrity-'));
  try {
    const staged=path.join(directory,'staged');
    for(const relativePath of verifier.criticalFiles){
      const target = path.join(staged, relativePath);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.copyFile(path.join(projectRoot, relativePath), target);
    }
    const validAsar=path.join(directory,'valid.asar');
    await asar.createPackage(staged,validAsar);
    assert.equal(verifier.verifyPackagedApp(validAsar),true);

    await fsp.writeFile(path.join(staged,'src','styles.css'),'corrupted packaged bytes');
    const corruptAsar=path.join(directory,'corrupt.asar');
    await asar.createPackage(staged,corruptAsar);
    assert.throws(() => verifier.verifyPackagedApp(corruptAsar), /styles\.css: packaged bytes do not match source/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
