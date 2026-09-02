'use strict';

function createBackgroundThreadManager({ emit = () => {}, now = () => Date.now() } = {}) {
  const tasks = new Map(), globallyPaused = new Set(), pauseHandlers = new Map();
  let nextOrder = 0;

  function send(task) { emit({ ...task, waiters: undefined }); }
  function wake(task) { for (const resolve of task.waiters.splice(0)) resolve(true); }
  function report(id, portfolioId, update = {}) {
    const key = String(id || 'background-task'), previous = tasks.get(key), done = Boolean(update.done);
    const task = previous || { id: key, portfolioId, order: nextOrder++, paused: globallyPaused.has(portfolioId), started: !globallyPaused.has(portfolioId), waiters: [] };
    Object.assign(task, update, { id: key, portfolioId: portfolioId || task.portfolioId, updatedAt: now(), done, completed: Math.max(0, Number(update.completed ?? task.completed) || 0), total: Math.max(0, Number(update.total ?? task.total) || 0) });
    task.pauseSupported = update.pauseSupported ?? task.pauseSupported ?? true;
    if (done) { task.paused = false; task.started = true; pauseHandlers.delete(key); wake(task); }
    task.status = done ? (update.status || 'completed') : task.paused ? (task.started ? 'paused' : 'queued') : (update.status || 'running');
    tasks.set(key, task); send(task); return { ...task, waiters: undefined };
  }
  function setPaused(id, paused) {
    const task = tasks.get(String(id)); if (!task || task.done || !task.pauseSupported) return false;
    task.paused = Boolean(paused); if (!task.paused) { task.started = true; wake(task); }
    task.status = task.paused ? (task.started ? 'paused' : 'queued') : 'running'; task.updatedAt = now(); pauseHandlers.get(task.id)?.(task.paused); send(task); return true;
  }
  function setAllPaused(portfolioId, paused) {
    if (paused) globallyPaused.add(portfolioId); else globallyPaused.delete(portfolioId);
    let changed = 0; for (const task of tasks.values()) if ((!portfolioId || task.portfolioId === portfolioId) && !task.done && task.pauseSupported) { task.paused = Boolean(paused); if (!paused) { task.started = true; wake(task); } task.status = paused ? (task.started ? 'paused' : 'queued') : 'running'; task.updatedAt = now(); pauseHandlers.get(task.id)?.(task.paused); send(task); changed += 1; }
    return changed;
  }
  function reorder(ids = []) {
    const requested = ids.map(String), queued = requested.map((id) => tasks.get(id)).filter((task) => task && !task.done && !task.started);
    queued.forEach((task, index) => { task.order = index; task.updatedAt = now(); send(task); }); return queued.length;
  }
  async function wait(id) {
    const task = tasks.get(String(id)); if (!task || task.done || !task.pauseSupported) return true;
    while (task.paused && !task.done) await new Promise((resolve) => task.waiters.push(resolve));
    if (!task.done && !task.started) { task.started = true; task.status = 'running'; task.updatedAt = now(); send(task); }
    return !task.done;
  }
  function registerPauseHandler(id,handler){const key=String(id);if(typeof handler!=='function'){pauseHandlers.delete(key);return()=>{};}pauseHandlers.set(key,handler);return()=>pauseHandlers.delete(key);}
  function isPaused(id){return Boolean(tasks.get(String(id))?.paused);}
  function remove(id) { const key=String(id),task=tasks.get(key); if (!task || task.done || !task.paused) return false;task.done=true;task.paused=false;task.status='cancelled';task.updatedAt=now();pauseHandlers.get(key)?.(false,{cancelled:true});pauseHandlers.delete(key);wake(task);send(task);tasks.delete(key);return true; }
  function snapshot(portfolioId) { return [...tasks.values()].filter((task) => !portfolioId || task.portfolioId === portfolioId).map((task) => ({ ...task, waiters: undefined })); }
  return { report, setPaused, setAllPaused, reorder, wait, registerPauseHandler, isPaused, remove, snapshot };
}

module.exports = { createBackgroundThreadManager };
