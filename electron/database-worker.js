const { parentPort, workerData } = require('node:worker_threads');
const { createLibraryStore } = require('./database');

const store = createLibraryStore(workerData.databaseFile);
parentPort.on('message', ({ id, action, library, target }) => {
  try {
    if (action === 'save') store.save(library);
    else if (action === 'save-batch') store.saveBatch(library);
    else if (action === 'backup') store.backup(target);
    else if (action === 'checkpoint') store.database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    parentPort.postMessage({ id, ok: true });
  } catch (error) { parentPort.postMessage({ id, ok: false, message: error.message }); }
});
parentPort.once('close', () => store.close());
