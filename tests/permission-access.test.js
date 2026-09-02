'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { isPermissionError, pathIsInside, grantReadAccess } = require('../electron/permission-access');

test('permission failures are recognized by code and decoder messages', () => {
  assert.equal(isPermissionError({ code: 'EACCES', message: 'open failed' }), true);
  assert.equal(isPermissionError({ errorCode: 'EPERM', error: 'stat failed' }), true);
  assert.equal(isPermissionError('Permission denied while opening image'), true);
  assert.equal(isPermissionError(new Error('unsupported image format')), false);
});

test('permission targets remain within their indexed folder', () => {
  const root = path.resolve('/tmp/pigeon-library');
  assert.equal(pathIsInside(root, path.join(root, 'nested', 'image.jpg')), true);
  assert.equal(pathIsInside(root, path.resolve(root, '..', 'outside.jpg')), false);
});

test('Linux access uses Polkit and ACLs without receiving or storing passwords', async () => {
  let invocation;
  const result = await grantReadAccess('/tmp/pigeon library', { platform: 'linux', uid: 1000, run: (file, args, options, callback) => { invocation = { file, args, options }; callback(null, '', ''); } });
  assert.equal(result.ok, true);
  assert.equal(invocation.file, '/usr/bin/pkexec');
  assert.deepEqual(invocation.args.slice(0, 5), ['/usr/bin/setfacl', '-R', '-m', 'u:1000:rX', '--']);
  assert.equal(invocation.args.at(-1), path.resolve('/tmp/pigeon library'));
  assert.equal(invocation.args.some((argument) => /password/i.test(argument)), false);
});

test('cancelled system authorization remains a nonfatal skip', async () => {
  const error = Object.assign(new Error('dismissed'), { code: 126 });
  const result = await grantReadAccess('/tmp/library', { platform: 'linux', uid: 1000, run: (_file, _args, _options, callback) => callback(error, '', 'dismissed') });
  assert.deepEqual({ ok: result.ok, cancelled: result.cancelled }, { ok: false, cancelled: true });
});
