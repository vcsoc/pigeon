const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs/promises');
const path = require('node:path');
const canvasPath = require.resolve('@napi-rs/canvas', { paths: [path.dirname(require.resolve('pdfjs-dist/package.json'))] });
const { createCanvas, DOMMatrix, ImageData, Path2D } = require(canvasPath);
globalThis.DOMMatrix = DOMMatrix; globalThis.ImageData = ImageData; globalThis.Path2D = Path2D;

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = new Uint8Array(await fs.readFile(workerData.source));
  const standardFontDataUrl = require('node:url').pathToFileURL(path.join(require.resolve('pdfjs-dist/package.json'), '..', 'standard_fonts') + path.sep).href;
  const document = await pdfjs.getDocument({ data: bytes, disableFontFace: false, isEvalSupported: false, useSystemFonts: true, standardFontDataUrl }).promise;
  const page = await document.getPage(1), initial = page.getViewport({ scale: 1 }), scale = Math.min(2, 720 / Math.max(initial.width, initial.height)), viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height))), context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise; await fs.writeFile(workerData.target, await canvas.encode('jpeg', 82)); const pages = document.numPages; await page.cleanup();
  parentPort.postMessage({ ok: true, target: workerData.target, width: canvas.width, height: canvas.height, pages });
})().catch((error) => parentPort.postMessage({ ok: false, message: error.message, stack: error.stack }));
