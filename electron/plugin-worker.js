const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const vm = require('node:vm');

try {
  const source = fs.readFileSync(workerData.file, 'utf8');
  const emitted = [];
  const api = Object.freeze({
    assets: Object.freeze((workerData.assets || []).map((asset) => Object.freeze({ id: asset.id, name: asset.name, kind: asset.kind, tags: [...(asset.tags || [])] }))),
    emit: (operation) => emitted.push(JSON.parse(JSON.stringify(operation)))
  });
  const context = vm.createContext({ pigeon: api, console: Object.freeze({ log: (...args) => parentPort.postMessage({ log: args.map(String).join(' ') }) }) }, { codeGeneration: { strings: false, wasm: false } });
  new vm.Script(`"use strict";\n${source}`, { filename: workerData.file }).runInContext(context, { timeout: 1000 });
  parentPort.postMessage({ done: true, operations: emitted });
} catch (error) {
  parentPort.postMessage({ done: true, error: error.message });
}
