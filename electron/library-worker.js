const { parentPort, workerData } = require('node:worker_threads');
const { performance } = require('node:perf_hooks');
const { createLibraryStore, importLegacyJson } = require('./database');

try {
  const spans=[],openStarted=performance.now(),store = createLibraryStore(workerData.databaseFile);spans.push({name:'sqlite-open',durationMs:performance.now()-openStarted});
  const loadStarted=performance.now();
  let library = store.load({onSpan:(span)=>spans.push(span)});
  if (!library) library = importLegacyJson(store, workerData.legacyJsonFile);
  spans.push({name:'sqlite-load-and-migrate',durationMs:performance.now()-loadStarted});
  const memory=process.memoryUsage();spans.push({name:'library-worker-loaded',durationMs:0,size:library?.assets?.length||0,heapUsedMb:memory.heapUsed/1024/1024,rssMb:memory.rss/1024/1024});
  store.close();
  parentPort.postMessage({ library,performance:spans });
} catch (error) {
  parentPort.postMessage({ error: { code: error.code, message: error.message, stack: error.stack } });
}
