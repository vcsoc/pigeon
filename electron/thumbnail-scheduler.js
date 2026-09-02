const PRIORITY = Object.freeze({ selected: 0, visible: 1, ahead: 2, behind: 3, idle: 4 });

function normalizedJob(value, reason) {
  if (!value) return null;
  if (typeof value === 'string') return { id: value, version: 0, reason };
  if (!value.id) return null;
  return { id: String(value.id), version: Number(value.version ?? value.modified) || 0, reason };
}

function createThumbnailScheduler({ processJob, maxConcurrency = 2, idleDelayMs = 750, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (typeof processJob !== 'function') throw new Error('processJob is required');
  const queued = new Map(), active = new Map();
  let portfolioId = null, generation = 0, sequence = 0, idleProvider = null, idleTimer = null, disposed = false, lastActivityAt = now();

  const contextMatches = (value = {}) => value.portfolioId === portfolioId && Number(value.generation) === generation;
  const setContext = (value = {}) => {
    const changed = value.portfolioId !== portfolioId || Number(value.generation) !== generation;
    portfolioId = value.portfolioId ?? null; generation = Number(value.generation) || 0;
    if (changed) queued.clear();
    lastActivityAt = now();
    return changed;
  };
  const upsert = (value, priority, reason) => {
    const job = normalizedJob(value, reason); if (!job) return;
    const running = active.get(job.id); if (running?.version === job.version) return;
    const existing = queued.get(job.id);
    if (existing?.version === job.version) { existing.priority = Math.min(existing.priority, priority); existing.reason = existing.priority === priority ? reason : existing.reason; return; }
    queued.set(job.id, { ...job, priority, sequence: sequence++, portfolioId, generation, enqueuedAt: now() });
  };
  const nextQueued = () => [...queued.values()].sort((a, b) => a.priority - b.priority || a.sequence - b.sequence)[0] || null;
  const activeBackground = () => [...active.values()].filter((job) => job.priority === PRIORITY.idle).length;
  const canTakeIdle = () => activeBackground() < Math.max(1, maxConcurrency - 1);
  const requestIdleCandidate = () => {
    if (!idleProvider || now() - lastActivityAt < idleDelayMs || !canTakeIdle()) return null;
    const candidate = normalizedJob(idleProvider(), 'idle');
    if (!candidate || active.get(candidate.id)?.version === candidate.version) return null;
    return { ...candidate, priority: PRIORITY.idle, sequence: sequence++, portfolioId, generation, enqueuedAt: now() };
  };
  const drain = () => {
    if (disposed) return;
    while (active.size < maxConcurrency) {
      let job = nextQueued();
      if (job) queued.delete(job.id);
      else job = requestIdleCandidate();
      if (!job) break;
      if (job.priority === PRIORITY.idle && !canTakeIdle()) break;
      active.set(job.id, job);
      Promise.resolve(processJob(job)).catch(() => {}).finally(() => { if (active.get(job.id) === job) active.delete(job.id); drain(); });
    }
  };
  const armIdle = () => { clearTimer(idleTimer); idleTimer = setTimer(() => { idleTimer = null; drain(); }, idleDelayMs); };
  const updatePriority = (value = {}) => {
    if (!contextMatches(value)) return false;
    lastActivityAt = now();
    const wanted = new Set();
    for (const [reason, priority] of [['selected',0],['visible',1],['ahead',2],['behind',3]]) for (const item of value[reason] || []) { const job = normalizedJob(item, reason); if (!job) continue; wanted.add(job.id); upsert(job, priority, reason); }
    for (const [id, job] of queued) if (job.priority < PRIORITY.idle && !wanted.has(id)) queued.delete(id);
    armIdle(); drain(); return true;
  };
  const setIdleProvider = (provider) => { idleProvider = typeof provider === 'function' ? provider : null; armIdle(); };
  const invalidate = (id, version) => { const job = queued.get(String(id)); if (job && (version === undefined || job.version !== Number(version))) queued.delete(String(id)); };
  const stats = () => ({ queued: queued.size, active: active.size, activeInteractive: [...active.values()].filter((job) => job.priority < PRIORITY.idle).length, activeBackground: activeBackground(), portfolioId, generation });
  const dispose = () => { disposed = true; clearTimer(idleTimer); queued.clear(); idleProvider = null; };
  return { setContext, updatePriority, setIdleProvider, invalidate, drain, stats, dispose, priorities: PRIORITY };
}

module.exports = { createThumbnailScheduler, PRIORITY };
