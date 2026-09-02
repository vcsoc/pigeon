'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const sharp = require('sharp');

function generateThumbnail(payload) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '..', 'electron', 'thumbnail-worker.js'));
    const timer = setTimeout(() => { worker.terminate().catch(() => {}); reject(new Error('thumbnail worker timed out')); }, 10000);
    const finish = (callback, value) => { clearTimeout(timer); worker.terminate().catch(() => {}); callback(value); };
    worker.once('message', (result) => finish(resolve, result));
    worker.once('error', (error) => finish(reject, error));
    worker.postMessage(payload);
  });
}

test('JPEG content with a CR2 extension bypasses the RAW decoder', async (context) => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'pigeon-disguised-cr2-'));
  context.after(() => fsp.rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'camera.cr2'), target = path.join(directory, 'thumbnail.jpg');
  await sharp({ create: { width: 80, height: 120, channels: 3, background: '#d28a3a' } }).jpeg().toFile(source);

  const result = await generateThumbnail({ source, target, rawProxyTarget: path.join(directory, 'raw-preview.jpg') });

  assert.equal(result.ok, true, result.message);
  assert.equal(result.technicalMetadata.format, 'jpeg');
  assert.equal(result.proxyPath, null);
  assert.equal(fs.existsSync(target), true);
  assert.equal(fs.existsSync(path.join(directory, 'raw-preview.jpg')), false);
});
