function createIncrementalWorkQueue({
  processItem,
  isActive = () => true,
  onProgress = () => {},
  onError = () => {},
  maxConcurrency = 1,
}) {
  const concurrency = Math.max(
    1,
    Math.min(8, Math.trunc(Number(maxConcurrency)) || 1),
  );
  const seen = new Set(),
    completedKeys = new Set(),
    queue = [],
    activeIds = new Set();
  let cursor = 0,
    active = 0,
    closed = false,
    completed = 0,
    total = 0,
    resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  const report = () =>
    onProgress({
      completed,
      total,
      done: closed && !active && cursor >= queue.length,
    });

  async function work(item) {
    try {
      await processItem(item);
    } catch (error) {
      onError(error, item);
    } finally {
      completedKeys.add(item.id + ':' + item.version);
      activeIds.delete(item.id);
      active--;
      completed++;
      // A synchronous processor failure must not recursively drain a large queue.
      queueMicrotask(pump);
    }
  }
  function pump() {
    if (!isActive()) {
      while (cursor < queue.length) queue[cursor++] = null;
    }
    while (active < concurrency && isActive()) {
      let next = cursor;
      // Different versions of one asset must never write its cache concurrently.
      while (
        next < queue.length &&
        (!queue[next] || activeIds.has(queue[next].id))
      )
        next++;
      if (next >= queue.length) break;
      const item = queue[next];
      queue[next] = null;
      while (cursor < queue.length && !queue[cursor]) cursor++;
      active++;
      activeIds.add(item.id);
      void work(item);
    }
    report();
    if (closed && !active && cursor >= queue.length) resolveDone();
  }
  return {
    add(items, { retryCompleted = false } = {}) {
      if (closed || !isActive()) return;
      for (const item of items) {
        const key = item.id + ":" + item.version;
        if (seen.has(key) && (!retryCompleted || !completedKeys.has(key))) continue;
        completedKeys.delete(key);
        seen.add(key);
        total++;
        queue.push(item);
      }
      pump();
    },
    has(id, version) {
      return seen.has(id + ":" + version);
    },
    close() {
      closed = true;
      pump();
      return done;
    },
  };
}
module.exports = { createIncrementalWorkQueue };
