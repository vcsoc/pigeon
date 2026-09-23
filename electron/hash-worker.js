const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createBackgroundCpuLimiter } = require('./background-cpu-limiter');

const hash = crypto.createHash('sha256');
const checkpoint=createBackgroundCpuLimiter({dutyCycle:workerData.dutyCycle||0.08,...(Number.isFinite(workerData.startedAt)?{startedAt:workerData.startedAt,now:Date.now,initialUsage:{user:0,system:0}}:{})});
const stream = fs.createReadStream(workerData.source, { highWaterMark: 1024 * 1024 });
stream.on('data', (chunk) => {hash.update(chunk);checkpoint();});
stream.once('error', (error) => parentPort.postMessage({ ok: false, message: error.message }));
stream.once('end', () => parentPort.postMessage({ ok: true, hash: hash.digest('hex') }));
