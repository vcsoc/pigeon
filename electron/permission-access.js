'use strict';

const path = require('node:path');
const { execFile } = require('node:child_process');

function isPermissionError(value) {
  const code = String(value?.code || value?.errorCode || '').toUpperCase();
  const message = String(value?.message || value?.error || value || '');
  return code === 'EACCES' || code === 'EPERM' || /\b(?:EACCES|EPERM)\b|permission denied|operation not permitted/i.test(message);
}

function pathIsInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function grantReadAccess(target, { platform = process.platform, uid = process.getuid?.(), run = execFile } = {}) {
  if (platform !== 'linux') return Promise.resolve({ ok: false, unsupported: true, message: 'System authorization is currently available on Linux only.' });
  if (!Number.isInteger(uid) || uid < 0) return Promise.resolve({ ok: false, unsupported: true, message: 'The current Linux user could not be identified.' });
  const resolved = path.resolve(target);
  return new Promise((resolve) => {
    run('/usr/bin/pkexec', ['/usr/bin/setfacl', '-R', '-m', `u:${uid}:rX`, '--', resolved], { windowsHide: true, timeout: 120000 }, (error, _stdout, stderr) => {
      if (!error) { resolve({ ok: true, target: resolved }); return; }
      const cancelled = error.code === 126 || error.code === 127 || /dismissed|cancel/i.test(String(stderr || error.message));
      resolve({ ok: false, cancelled, message: cancelled ? 'Authorization was cancelled.' : String(stderr || error.message || 'Access could not be granted.').trim() });
    });
  });
}

module.exports = { isPermissionError, pathIsInside, grantReadAccess };
