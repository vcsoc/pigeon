'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isMissingUpdateMetadataError } = require('../electron/update-support');

test('missing macOS update metadata is recognized as a recoverable release configuration error', () => {
  const error = new Error('Cannot find latest-mac.yml in the latest release artifacts (https://github.com/vcsoc/pigeon/releases/download/v0.1.67/latest-mac.yml): HttpError: 404');
  assert.equal(isMissingUpdateMetadataError(error), true);
});

test('nested metadata 404 errors are recognized', () => {
  const error = new Error('Update check failed', { cause: new Error('GET latest-mac.yml returned HTTP 404') });
  assert.equal(isMissingUpdateMetadataError(error), true);
});

test('unrelated updater and authentication errors still surface', () => {
  assert.equal(isMissingUpdateMetadataError(new Error('Request timed out')), false);
  assert.equal(isMissingUpdateMetadataError(new Error('GitHub API returned HTTP 404')), false);
  assert.equal(isMissingUpdateMetadataError(new Error('latest-mac.yml signature is invalid')), false);
});

test('the update IPC handler returns a nonfatal unavailable result for missing metadata', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');
  assert.match(main, /if\(!isMissingUpdateMetadataError\(error\)\)throw error/);
  assert.match(main, /status:'unavailable'.*reason:'missing-update-metadata'/);
});
