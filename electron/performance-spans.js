const { performance } = require('node:perf_hooks');

function boundedNumber(value) { const number = Number(value); return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0; }
function safeDetail(detail = {}) {
  const allowed = ['portfolioId','portfolioSize','generation','sequence','size','batchSize','batchCount','changedRecords','queueWaitMs','serializationMs','transactionMs','durationMs','cache','phase','source','assetMix','longTaskMs','frameMs','ackWaitMs','heapUsedMb','rssMb','sourceBytes','projectedBytes','owner','ownerDurationMs','domCards','visibleCount','uniqueTags','generationReason'];
  return Object.fromEntries(allowed.filter((key) => Object.hasOwn(detail, key)).map((key) => [key, typeof detail[key] === 'number' ? boundedNumber(detail[key]) : detail[key]]));
}
function assetMix(assets = []) { const mix = {}; for (const asset of assets) mix[asset.kind || 'other'] = (mix[asset.kind || 'other'] || 0) + 1; return mix; }
function createPerformanceRecorder({ limit = 300, now = () => performance.now(), onRecord = null } = {}) {
  const spans = [];
  const record = (name, detail = {}) => { const entry = { name: String(name), timestamp: Date.now(), ...safeDetail(detail) }; spans.push(entry); if (spans.length > limit) spans.splice(0, spans.length - limit);try{onRecord?.(entry);}catch{}return entry; };
  const start = (name, detail = {}) => ({ name, detail: safeDetail(detail), startedAt: now() });
  const end = (token, detail = {}) => record(token.name, { ...token.detail, ...detail, durationMs: now() - token.startedAt });
  return { record, start, end, snapshot: () => spans.slice(), clear: () => { spans.length = 0; } };
}

module.exports = { createPerformanceRecorder, assetMix, safeDetail };
