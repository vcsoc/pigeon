const { parentPort, workerData } = require('node:worker_threads');
const { performance } = require('node:perf_hooks');
const { createLibraryStore } = require('./database');
const { writeSemanticMetadata } = require('./semantic-metadata');

const store = createLibraryStore(workerData.databaseFile);
parentPort.on('message', ({ id, action, library, target }) => {
  const serializationStartedAt=performance.now();JSON.stringify(library??null);const serializationMs=performance.now()-serializationStartedAt,startedAt=performance.now();
  try {
    let changedRecords=0;
    if (action === 'save') {store.save(library);changedRecords=Array.isArray(library?.assets)?library.assets.length:0;}
    else if (action === 'save-batch') changedRecords=store.saveBatch(library);
    else if (action === 'upsert-assets') changedRecords=store.upsertAssets(library?.assets||library||[]);
    else if (action === 'delete-assets') changedRecords=store.deleteAssets(library?.ids||library||[]);
    else if (action === 'save-library-metadata') changedRecords=store.saveLibraryMetadata(library);
    else if (action === 'backup') store.backup(target);
    else if (action === 'checkpoint') store.database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const semantic=action==='upsert-assets'&&target?.semanticRecords?writeSemanticMetadata(workerData.databaseFile+'.semantic.sqlite3',target.semanticRecords):{updated:0};
    parentPort.postMessage({ id, ok: true, metrics:{action,changedRecords,semanticRecords:semantic.updated,semanticSyncError:semantic.error||'',serializationMs,transactionMs:performance.now()-startedAt} });
  } catch (error) { parentPort.postMessage({ id, ok: false, message: error.message }); }
});
parentPort.once('close', () => store.close());
