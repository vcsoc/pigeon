const test = require('node:test');
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('scan worker inspects a batch and fingerprints files', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pigeon-scan-worker-'));
  const first = path.join(directory, 'first.txt'), second = path.join(directory, 'second.txt');
  fs.writeFileSync(first, 'first'); fs.writeFileSync(second, 'second');
  const result = await new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '..', 'electron', 'scan-worker.js'), { workerData: { batch: [{ filePath: first }, { filePath: second }], deferHash: false, dutyCycle: 1 } });
    worker.once('message', resolve); worker.once('error', reject);
  });
  assert.equal(result.results.length, 2);
  assert.ok(result.results.every((item) => item.size > 0 && /^[a-f0-9]{64}$/.test(item.contentHash)));
  fs.rmSync(directory, { recursive: true, force: true });
});
