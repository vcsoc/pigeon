'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { rawCameraProxyRequired } = require('../electron/thumbnail-requirements');

const rawExtensions = new Set(['.cr2', '.nef']);

test('JPEG-content files with RAW extensions do not repeatedly require RAW proxies', () => {
  assert.equal(rawCameraProxyRequired({ technicalMetadata: { format: 'jpeg' } }, '.cr2', rawExtensions), false);
  assert.equal(rawCameraProxyRequired({ technicalMetadata: { format: 'png' } }, '.cr2', rawExtensions), false);
});

test('genuine and not-yet-inspected RAW files still require RAW proxies', () => {
  assert.equal(rawCameraProxyRequired({ technicalMetadata: { format: 'camera-raw' } }, '.cr2', rawExtensions), true);
  assert.equal(rawCameraProxyRequired({}, '.nef', rawExtensions), true);
  assert.equal(rawCameraProxyRequired({ technicalMetadata: { format: 'jpeg' } }, '.jpg', rawExtensions), false);
});
