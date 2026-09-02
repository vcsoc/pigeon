'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

const MODEL_SCALE = 3;
const TILE_SIZE = 224;
const TILE_CONTEXT = 8;
const TILE_CORE = TILE_SIZE - TILE_CONTEXT * 2;
const MAX_OUTPUT_PIXELS = 80 * 1024 * 1024;

function normalizedAiScale(value) {
  const scale = Math.round(Number(value));
  return scale === 3 ? 3 : 2;
}

function modelPath() {
  const bundled = path.join(__dirname, 'ai-models', 'super-resolution-10.onnx');
  const unpacked = bundled.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
  return fs.existsSync(unpacked) ? unpacked : bundled;
}

function clampByte(value) { return Math.max(0, Math.min(255, Math.round(value))); }
function luminance(r, g, b) { return .299 * r + .587 * g + .114 * b; }

function sampleModel(data, x, y) {
  const boundedX = Math.max(0, Math.min(TILE_SIZE * MODEL_SCALE - 1, x));
  const boundedY = Math.max(0, Math.min(TILE_SIZE * MODEL_SCALE - 1, y));
  const left = Math.floor(boundedX), top = Math.floor(boundedY);
  const right = Math.min(TILE_SIZE * MODEL_SCALE - 1, left + 1), bottom = Math.min(TILE_SIZE * MODEL_SCALE - 1, top + 1);
  const fx = boundedX - left, fy = boundedY - top, width = TILE_SIZE * MODEL_SCALE;
  const upper = data[top * width + left] * (1 - fx) + data[top * width + right] * fx;
  const lower = data[bottom * width + left] * (1 - fx) + data[bottom * width + right] * fx;
  return upper * (1 - fy) + lower * fy;
}

async function enlargeInWorker({ source, target, previewTarget = null, scale: requestedScale, rotation: requestedRotation = 0 }) {
  const sharp = require('sharp');
  const ort = require('onnxruntime-web');
  const scale = normalizedAiScale(requestedScale), rotation = [0, 90, 180, 270].includes(Number(requestedRotation)) ? Number(requestedRotation) : 0;
  const decoded = await sharp(source, { limitInputPixels: 100 * 1024 * 1024, animated: false })
    .rotate().rotate(rotation).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = decoded.info;
  const outputWidth = width * scale, outputHeight = height * scale;
  if (!width || !height || outputWidth > 32768 || outputHeight > 32768 || outputWidth * outputHeight > MAX_OUTPUT_PIXELS) {
    throw new Error('AI enlargement would exceed the safe 80 megapixel output limit');
  }

  ort.env.logLevel = 'error';ort.env.wasm.numThreads = 1;
  const session = await ort.InferenceSession.create(fs.readFileSync(modelPath()), { executionProviders: ['wasm'], logSeverityLevel: 4 });
  const baseline = await sharp(decoded.data, { raw: { width, height, channels } })
    .resize(outputWidth, outputHeight, { fit: 'fill', kernel: 'cubic' }).removeAlpha().raw().toBuffer();
  const columns = Math.ceil(width / TILE_CORE), rows = Math.ceil(height / TILE_CORE), total = columns * rows;
  let completed = 0;

  for (let coreY = 0; coreY < height; coreY += TILE_CORE) {
    const coreHeight = Math.min(TILE_CORE, height - coreY);
    for (let coreX = 0; coreX < width; coreX += TILE_CORE) {
      const coreWidth = Math.min(TILE_CORE, width - coreX), input = new Float32Array(TILE_SIZE * TILE_SIZE);
      for (let tileY = 0; tileY < TILE_SIZE; tileY += 1) {
        const sourceY = Math.max(0, Math.min(height - 1, coreY + tileY - TILE_CONTEXT));
        for (let tileX = 0; tileX < TILE_SIZE; tileX += 1) {
          const sourceX = Math.max(0, Math.min(width - 1, coreX + tileX - TILE_CONTEXT));
          const offset = (sourceY * width + sourceX) * channels;
          input[tileY * TILE_SIZE + tileX] = luminance(decoded.data[offset], decoded.data[offset + 1], decoded.data[offset + 2]) / 255;
        }
      }
      const output = (await session.run({ input: new ort.Tensor('float32', input, [1, 1, TILE_SIZE, TILE_SIZE]) })).output.data;
      const startX = coreX * scale, startY = coreY * scale, endX = (coreX + coreWidth) * scale, endY = (coreY + coreHeight) * scale;
      for (let y = startY; y < endY; y += 1) for (let x = startX; x < endX; x += 1) {
        const localX = (x / scale - coreX + TILE_CONTEXT) * MODEL_SCALE;
        const localY = (y / scale - coreY + TILE_CONTEXT) * MODEL_SCALE;
        const aiY = Math.max(0, Math.min(1, sampleModel(output, localX, localY))) * 255;
        const offset = (y * outputWidth + x) * 3;
        const baseY = luminance(baseline[offset], baseline[offset + 1], baseline[offset + 2]), delta = aiY - baseY;
        baseline[offset] = clampByte(baseline[offset] + delta);
        baseline[offset + 1] = clampByte(baseline[offset + 1] + delta);
        baseline[offset + 2] = clampByte(baseline[offset + 2] + delta);
      }
      completed += 1;
      parentPort?.postMessage({ type: 'progress', completed, total });
    }
  }

  const output=sharp(baseline,{raw:{width:outputWidth,height:outputHeight,channels:3}});
  if(previewTarget)await output.clone().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).jpeg({quality:84,mozjpeg:true}).toFile(previewTarget);
  const info=await output.png().toFile(target);
  return { target, previewTarget, width: info.width, height: info.height, size: info.size, scale, model: 'ONNX Super Resolution CNN' };
}

function enlargeImageWithAi(source, target, options = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { source, target, previewTarget: options.previewTarget || null, scale: normalizedAiScale(options.scale), rotation: Number(options.rotation) || 0 } });
    let settled = false;
    const finish = (error, result) => { if (settled) return; settled = true; clearTimeout(timer); worker.terminate().catch(()=>{}); error ? reject(error) : resolve(result); };
    const timer = setTimeout(() => { worker.terminate(); finish(new Error('AI enlargement timed out')); }, 10 * 60 * 1000);
    timer.unref?.();
    worker.on('message', (message) => { if (message.type === 'progress') options.onProgress?.(message); else if (message.type === 'done') finish(null, message.result); else if (message.type === 'error') finish(new Error(message.error)); });
    worker.once('error', (error) => finish(error));
    worker.once('exit', (code) => { if (code && !settled) finish(new Error(`AI enlargement worker stopped with code ${code}`)); });
  });
}

if (!isMainThread) enlargeInWorker(workerData).then((result) => parentPort.postMessage({ type: 'done', result })).catch((error) => parentPort.postMessage({ type: 'error', error: error.message }));

module.exports = { MAX_OUTPUT_PIXELS, normalizedAiScale, enlargeImageWithAi };
