const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectCloudFiles, isCloudPlaceholderAttributes, isCloudStoragePath, parsePowerShellCloudInspection } = require('../electron/cloud-files');

test('Windows cloud placeholders are recognized from offline and recall attributes', () => {
  assert.equal(isCloudStoragePath('C:\\Users\\Person\\OneDrive\\Pictures\\remote.jpg'), process.platform === 'win32');
  assert.equal(isCloudPlaceholderAttributes('Archive, Offline, ReparsePoint, RecallOnDataAccess'), true);
  assert.equal(isCloudPlaceholderAttributes('Archive, ReparsePoint, RecallOnOpen'), true);
  assert.equal(isCloudPlaceholderAttributes('Archive, ReparsePoint, Pinned'), false);
});

test('PowerShell cloud inspection normalizes placeholder metadata without opening files', () => {
  const [item] = parsePowerShellCloudInspection(JSON.stringify({ path: 'C:\\OneDrive\\remote.jpg', exists: true, attributes: 'Archive, Offline, RecallOnDataAccess', length: 42, created: 10, modified: 20 }));
  assert.deepEqual(item, { path: 'C:\\OneDrive\\remote.jpg', exists: true, attributes: 'Archive, Offline, RecallOnDataAccess', placeholder: true, size: 42, created: 10, modified: 20 });
});

test('cloud inspection fails closed so an unavailable attribute probe cannot trigger a file read', async () => {
  if (process.platform !== 'win32') return;
  const target = 'C:\\Users\\Person\\OneDrive\\Pictures\\remote.jpg', states = await inspectCloudFiles([target], { runner: async () => { throw new Error('probe unavailable'); } });
  assert.deepEqual(states.get(target), { path: target, exists: false, placeholder: true, available: false, attributes: 'InspectionUnavailable', size: 0, created: 0, modified: 0 });
});

test('cloud inspection cancellation stops later chunks without marking them unavailable', async () => {
  if (process.platform !== 'win32') return;
  const controller = new AbortController(),paths=Array.from({length:24},(_,index)=>`C:\\Users\\Person\\OneDrive\\Pictures\\remote-${index}.jpg`);let calls=0;
  const states=await inspectCloudFiles(paths,{signal:controller.signal,runner:async(chunk,_timeout,signal)=>{calls+=1;assert.equal(signal,controller.signal);controller.abort();return chunk.map((filePath)=>({path:filePath,exists:true,placeholder:false}));}});
  assert.equal(calls,1);assert.equal(states.size,12);assert.equal(states.has(paths.at(-1)),false);
});
