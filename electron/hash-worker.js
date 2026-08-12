const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const crypto = require('node:crypto');

const hash = crypto.createHash('sha256');
const stream = fs.createReadStream(workerData.source, { highWaterMark: 1024 * 1024 });
stream.on('data', (chunk) => hash.update(chunk));
stream.once('error', (error) => parentPort.postMessage({ ok: false, message: error.message }));
stream.once('end', () => parentPort.postMessage({ ok: true, hash: hash.digest('hex') }));
