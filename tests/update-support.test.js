'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compareVersions, isMissingUpdateMetadataError, isNewerVersion, isTransientUpdateDownloadError, requiresForcedUpdate } = require('../electron/update-support');

test('semantic update comparisons reject older releases and handle multi-digit segments',()=>{
  assert.equal(compareVersions('0.1.100','0.1.101'),-1);
  assert.equal(compareVersions('0.2.1','0.1.101'),1);
  assert.equal(compareVersions('1.0.0','1.0.0'),0);
  assert.equal(compareVersions('1.0.0-beta.2','1.0.0-beta.10'),-1);
  assert.equal(isNewerVersion('0.1.100','0.1.101'),false);
  assert.equal(isNewerVersion('0.2.1','0.1.101'),true);
  assert.equal(isNewerVersion('not-a-version','0.1.101'),false);
});

test('forced update policies apply only below the configured minimum',()=>{
  const policy={minimumVersion:'0.2.1',force:true};
  assert.equal(requiresForcedUpdate(policy,'0.1.101'),true);
  assert.equal(requiresForcedUpdate(policy,'0.2.1'),false);
  assert.equal(requiresForcedUpdate(policy,'0.3.0'),false);
  assert.equal(requiresForcedUpdate({...policy,force:false},'0.1.101'),false);
});

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

test('only a release-asset 404 is treated as a temporary update delivery error', () => {
  assert.equal(isTransientUpdateDownloadError(new Error('Cannot download "https://github.com/vcsoc/pigeon/releases/download/v0.2.10/Pigeon-Setup-0.2.10-x64.exe", status 404')), true);
  assert.equal(isTransientUpdateDownloadError(new Error('Cannot find latest.yml, status 404')), false);
  assert.equal(isTransientUpdateDownloadError(new Error('latest.yml signature is invalid')), false);
  assert.equal(isTransientUpdateDownloadError(new Error('Cannot download release asset, status 500')), false);
});

test('the update IPC handler returns a nonfatal unavailable result for missing metadata', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');
  assert.match(main, /if\(!isMissingUpdateMetadataError\(error\)\)throw error/);
  assert.match(main, /status:'unavailable'.*reason:'missing-update-metadata'/);
  assert.match(main,/isNewerVersion\(version,currentVersion\)/);
  assert.match(main,/autoUpdater\.allowDowngrade = false/);
  assert.match(main,/UPDATE_DOWNLOAD_RETRY_DELAYS_MS/);
  assert.match(main,/isTransientUpdateDownloadError\(error\)/);
  assert.match(main,/Update asset not ready; retrying/);
});

test('failed or declined update installs restore an actionable update prompt', () => {
  const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
  assert.match(renderer, /result\?\.status!=='installing'/);
  assert.match(renderer, /showUpdateToast\(version,\{required,installable:result\?\.installable!==false/);
  assert.match(renderer, /macOS could not verify this update/);
  assert.match(renderer, /message:updateFailureMessage\(error\)/);
});

test('release publishing requires a signed macOS application build', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'build-desktop.yml'), 'utf8');
  assert.match(workflow, /CSC_LINK:.*MACOS_CERTIFICATE_P12/);
  assert.match(workflow, /codesign --verify --deep --strict/);
  assert.match(workflow, /Authority=Developer ID Application/);
  assert.match(workflow, /if:.*success\(\).*startsWith\(github\.ref/);
  assert.doesNotMatch(workflow, /always\(\).*startsWith\(github\.ref/);
});
