const { parentPort, workerData, threadId } = require('node:worker_threads');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createBackgroundCpuLimiter } = require('./background-cpu-limiter');
const checkpoint=createBackgroundCpuLimiter({dutyCycle:workerData.dutyCycle||0.08,...(Number.isFinite(workerData.startedAt)?{startedAt:workerData.startedAt,now:Date.now,initialUsage:{user:0,system:0}}:{})});

async function hashFile(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    const hash = crypto.createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024);
    let position = 0;
    while (true) { const { bytesRead } = await handle.read(buffer, 0, buffer.length, position); if (!bytesRead) break; hash.update(buffer.subarray(0, bytesRead)); position += bytesRead; checkpoint(); }
    return hash.digest('hex');
  } finally { await handle.close(); }
}

(async () => {
  const results = [];
  for (const item of workerData.batch) {
    checkpoint();let stat = null;
    try {
      stat = await fs.stat(item.filePath);
      if (!stat.isFile()) continue;
      const unchanged = item.existing && item.existing.size === stat.size && item.existing.modified === stat.mtimeMs;
      const deferHash=workerData.deferHash||stat.size>=(Number(workerData.inlineHashMaxBytes)||Infinity);
      results.push({ filePath: item.filePath, size: stat.size, created: stat.birthtimeMs, modified: stat.mtimeMs, contentHash: unchanged && item.existing.contentHash ? item.existing.contentHash : deferHash ? null : await hashFile(item.filePath) });
    } catch (error) { results.push({ filePath: item.filePath, size: stat?.size ?? item.existing?.size ?? 0, created: stat?.birthtimeMs ?? 0, modified: stat?.mtimeMs ?? item.existing?.modified ?? 0, contentHash: item.existing?.contentHash || null, error: error.message, errorCode: error.code || '' }); }
  }
  parentPort.postMessage({ threadId, results });
})().catch((error) => parentPort.postMessage({ threadId, error: error.message }));
