const os = require('node:os');
const { execFile } = require('node:child_process');

const MAC_MEMORY_SAMPLE_TTL_MS = 2000;
let cachedMacMemory = null;
let pendingMacMemory = null;

function parseMacAvailableMemory(output) {
  const text = String(output || '');
  const pageSize = Number(text.match(/page size of (\d+) bytes/i)?.[1]);
  if (!Number.isFinite(pageSize) || pageSize <= 0) return null;

  const pages = new Map();
  for (const match of text.matchAll(/^([^:]+):\s+(\d+)\.?$/gm)) pages.set(match[1].trim(), Number(match[2]));
  const reclaimable = ['Pages free', 'Pages inactive', 'Pages speculative', 'Pages purgeable']
    .reduce((total, label) => total + (pages.get(label) || 0), 0);
  return reclaimable > 0 ? reclaimable * pageSize : null;
}

function readMacAvailableMemory() {
  return new Promise((resolve) => {
    execFile('/usr/bin/vm_stat', { timeout: 1500, maxBuffer: 256 * 1024 }, (error, stdout) => {
      resolve(error ? null : parseMacAvailableMemory(stdout));
    });
  });
}

async function availableMemoryBytes() {
  const fallback = os.freemem();
  if (process.platform !== 'darwin') return fallback;
  if (cachedMacMemory && Date.now() - cachedMacMemory.sampledAt < MAC_MEMORY_SAMPLE_TTL_MS) return cachedMacMemory.bytes;
  if (!pendingMacMemory) {
    pendingMacMemory = readMacAvailableMemory()
      .then((bytes) => {
        const value = Number.isFinite(bytes) && bytes > 0 ? bytes : fallback;
        cachedMacMemory = { bytes: value, sampledAt: Date.now() };
        return value;
      })
      .finally(() => { pendingMacMemory = null; });
  }
  return pendingMacMemory;
}

module.exports = { availableMemoryBytes, parseMacAvailableMemory };
