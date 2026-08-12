const { parentPort, workerData } = require('node:worker_threads');
const { createLibraryStore, importLegacyJson } = require('./database');

try {
  const store = createLibraryStore(workerData.databaseFile);
  let library = store.load();
  if (!library) library = importLegacyJson(store, workerData.legacyJsonFile);
  store.close();
  parentPort.postMessage({ library });
} catch (error) {
  parentPort.postMessage({ error: { code: error.code, message: error.message, stack: error.stack } });
}
