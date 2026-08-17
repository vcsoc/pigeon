import { parentPort, workerData, Worker as ThreadWorker } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

class WebWorkerAdapter {
  constructor(moduleUrl, options = {}) {
    this.onmessage = null;
    this.onerror = null;
    this.thread = new ThreadWorker(new URL(import.meta.url), {
      workerData: { moduleUrl: String(moduleUrl), name: options.name || '' },
      type: 'module'
    });
    this.thread.on('message', (data) => this.onmessage?.({ data }));
    this.thread.on('error', (error) => this.onerror?.(error));
  }
  postMessage(value, transfer = []) { this.thread.postMessage(value, transfer); }
  terminate() { return this.thread.terminate(); }
}

export function installNodeWebWorker() {
  if (typeof globalThis.Worker === 'undefined') globalThis.Worker = WebWorkerAdapter;
}

if (workerData?.moduleUrl) {
  globalThis.self = globalThis;
  globalThis.name = workerData.name || '';
  globalThis.postMessage = (value, transfer = []) => parentPort.postMessage(value, transfer);
  globalThis.close = () => process.exit(0);
  const nativeFetch=globalThis.fetch;
  globalThis.fetch=async(resource,options)=>{const url=resource instanceof URL?resource:new URL(String(resource));if(url.protocol!=='file:')return nativeFetch(resource,options);return new Response(await readFile(fileURLToPath(url)),{status:200,headers:{'Content-Type':url.pathname.endsWith('.wasm')?'application/wasm':'application/javascript'}});};
  installNodeWebWorker();
  const queued=[];parentPort.on('message',(data)=>{if(globalThis.onmessage)globalThis.onmessage({data});else queued.push(data);});
  await import(workerData.moduleUrl);
  for(const data of queued.splice(0))globalThis.onmessage?.({data});
}
