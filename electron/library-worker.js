const { parentPort, workerData } = require('node:worker_threads');
const fsp = require('node:fs/promises');

(async () => {
  try {
    const contents = await fsp.readFile(workerData.dataFile, 'utf8');
    const library = JSON.parse(contents);
    parentPort.postMessage({ library });
  } catch (error) {
    parentPort.postMessage({ error: { code: error.code, message: error.message } });
  }
})();
