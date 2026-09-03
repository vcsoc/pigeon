const { parentPort, workerData } = require('node:worker_threads');
const { similarImageGroups } = require('./library-core');

try {
  const groups = similarImageGroups(workerData.assets || [], workerData.accuracy, workerData.sourceId, { onProgress: (completed, total) => parentPort.postMessage({ progress: { completed, total } }) }).map((group) => group.map((asset) => asset.id));
  parentPort.postMessage({ groups });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
