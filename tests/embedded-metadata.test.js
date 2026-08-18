'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pngTextMetadata } = require('../electron/embedded-metadata');

function chunk(type, data) {
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  return Buffer.concat([size, Buffer.from(type), data, Buffer.alloc(4)]);
}

test('ComfyUI prompt and workflow JSON are extracted from PNG text chunks', async () => {
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pigeon-comfy-')), 'workflow.png');
  const prompt = JSON.stringify({ 3: { class_type: 'KSampler', inputs: { seed: 42 } } });
  const workflow = JSON.stringify({ nodes: [{ id: 3, type: 'KSampler' }], links: [] });
  fs.writeFileSync(target, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('tEXt', Buffer.from(`prompt\0${prompt}`)), chunk('tEXt', Buffer.from(`workflow\0${workflow}`)), chunk('IEND', Buffer.alloc(0))]));
  try {
    const metadata = await pngTextMetadata(target);
    assert.deepEqual(JSON.parse(metadata.prompt), JSON.parse(prompt));
    assert.deepEqual(JSON.parse(metadata.workflow), JSON.parse(workflow));
  } finally { fs.rmSync(path.dirname(target), { recursive: true, force: true }); }
});
