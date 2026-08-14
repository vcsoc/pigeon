const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMacAvailableMemory } = require('../electron/system-resources');

test('parseMacAvailableMemory includes reclaimable macOS memory pages', () => {
  const output = `Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: 100.\nPages active: 500.\nPages inactive: 200.\nPages speculative: 25.\nPages wired down: 300.\nPages purgeable: 75.\n`;
  assert.equal(parseMacAvailableMemory(output), 400 * 16384);
});

test('parseMacAvailableMemory ignores active and wired pages', () => {
  const output = `Mach Virtual Memory Statistics: (page size of 4096 bytes)\nPages free: 2.\nPages active: 9000.\nPages wired down: 8000.\nPages inactive: 3.\n`;
  assert.equal(parseMacAvailableMemory(output), 5 * 4096);
});

test('parseMacAvailableMemory rejects malformed vm_stat output', () => {
  assert.equal(parseMacAvailableMemory('not vm_stat output'), null);
  assert.equal(parseMacAvailableMemory('page size of 4096 bytes\nPages active: 10.'), null);
});
