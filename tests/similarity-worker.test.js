'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

function runSimilarityWorker(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '..', 'electron', 'similarity-worker.js'), { workerData });
    const progress = [];
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Similarity worker timed out')); }, 5000);
    worker.on('message', (message) => {
      if (message.progress) progress.push(message.progress);
      if (message.groups) { clearTimeout(timer); worker.terminate(); resolve({ groups: message.groups, progress }); }
      if (message.error) { clearTimeout(timer); worker.terminate(); reject(new Error(message.error)); }
    });
    worker.once('error', reject);
  });
}

test('similarity worker streams real progress and returns groups', async () => {
  const assets = Array.from({ length: 600 }, (_, index) => ({
    id: `image-${index}`,
    kind: 'image',
    width: 1000 + index % 7,
    height: 1000,
    perceptualHash: (BigInt(index) * 0x9e3779b97f4a7c15n & 0xffffffffffffffffn).toString(16).padStart(16, '0')
  }));
  assets[1].perceptualHash = assets[0].perceptualHash;
  const result = await runSimilarityWorker({ assets, accuracy: 95, sourceId: null });
  assert.ok(result.progress.length >= 2);
  assert.equal(result.progress.at(-1).completed, result.progress.at(-1).total);
  assert.ok(result.groups.some((group) => group.includes('image-0') && group.includes('image-1')));
});
