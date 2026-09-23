const { parentPort, workerData } = require('node:worker_threads');
const { similarImageGroups } = require('./library-core');
const { createBackgroundCpuLimiter } = require('./background-cpu-limiter');

try {
  const checkpoint=createBackgroundCpuLimiter({dutyCycle:workerData.dutyCycle||0.08,...(Number.isFinite(workerData.startedAt)?{startedAt:workerData.startedAt,now:Date.now,initialUsage:{user:0,system:0}}:{}),cancelled:()=>Boolean(workerData.cancelFlag&&Atomics.load(new Int32Array(workerData.cancelFlag),0))});
  const groups = similarImageGroups(workerData.assets || [], workerData.accuracy, workerData.sourceId, { checkpoint,onProgress: (completed, total) => parentPort.postMessage({ progress: { completed, total } }) }).map((group) => group.map((asset) => asset.id));
  const usage=typeof process.threadCpuUsage==='function'?process.threadCpuUsage():process.cpuUsage();parentPort.postMessage({ groups,...(Number.isFinite(workerData.startedAt)?{cpuMs:(usage.user+usage.system)/1000,wallMs:Date.now()-workerData.startedAt}:{}) });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
