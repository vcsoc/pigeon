const { execFile } = require('node:child_process');

const CLOUD_PATH_PATTERN = /[\\/](?:OneDrive(?:\s*-\s*[^\\/]+)?|Dropbox|Google Drive|GoogleDriveFS|iCloudDrive)[\\/]/i;
const PLACEHOLDER_ATTRIBUTES = new Set(['offline', 'recallondataaccess', 'recallonopen']);

function isCloudStoragePath(value) {
  return process.platform === 'win32' && CLOUD_PATH_PATTERN.test(String(value || '').replace(/\\/g, '/'));
}

function attributeNames(value) {
  return String(value || '').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
}

function isCloudPlaceholderAttributes(value) {
  return attributeNames(value).some((name) => PLACEHOLDER_ATTRIBUTES.has(name));
}

function parsePowerShellCloudInspection(stdout) {
  if (!String(stdout || '').trim()) return [];
  const parsed = JSON.parse(stdout);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((item) => ({
    path: String(item.path || ''),
    exists: item.exists !== false,
    attributes: String(item.attributes || ''),
    placeholder: item.exists !== false && isCloudPlaceholderAttributes(item.attributes),
    size: Number(item.length) || 0,
    created: Number(item.created) || 0,
    modified: Number(item.modified) || 0
  }));
}

function cloudInspectionAbortError() {
  const error = new Error('Cloud file inspection cancelled');
  error.code = 'ABORT_ERR';
  return error;
}

function runPowerShellInspection(paths, timeout = 5000, signal = null) {
  if (signal?.aborted) return Promise.reject(cloudInspectionAbortError());
  const encoded = Buffer.from(JSON.stringify(paths), 'utf8').toString('base64');
  const script = `$paths=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))|ConvertFrom-Json;$result=foreach($p in @($paths)){try{$item=Get-Item -LiteralPath ([string]$p) -Force -ErrorAction Stop;[pscustomobject]@{path=[string]$p;exists=$true;attributes=[string]$item.Attributes;length=if($item.PSIsContainer){0}else{[long]$item.Length};created=[long]([DateTimeOffset]$item.CreationTimeUtc).ToUnixTimeMilliseconds();modified=[long]([DateTimeOffset]$item.LastWriteTimeUtc).ToUnixTimeMilliseconds()}}catch{[pscustomobject]@{path=[string]$p;exists=$false;attributes='';length=0;created=0;modified=0}}};@($result)|ConvertTo-Json -Compress`;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(value); };
    const child = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout, maxBuffer: 1024 * 1024 }, (error, stdout) => finish(error, error ? null : parsePowerShellCloudInspection(stdout)));
    const abort = () => { child.kill(); finish(cloudInspectionAbortError()); };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

async function inspectCloudFiles(paths, { timeout = 5000, runner = runPowerShellInspection, signal = null } = {}) {
  const candidates = [...new Set((paths || []).map(String).filter(isCloudStoragePath))];
  const states = new Map();
  if (!candidates.length) return states;
  for (let index = 0; index < candidates.length; index += 12) {
    if (signal?.aborted) break;
    const chunk = candidates.slice(index, index + 12);
    try {
      for (const item of await runner(chunk, timeout, signal)) states.set(item.path, { ...item, available: item.exists && !item.placeholder });
    } catch {
      if (signal?.aborted) break;
      for (const filePath of chunk) states.set(filePath, { path: filePath, exists: false, placeholder: true, available: false, attributes: 'InspectionUnavailable', size: 0, created: 0, modified: 0 });
    }
  }
  return states;
}

module.exports = { attributeNames, inspectCloudFiles, isCloudPlaceholderAttributes, isCloudStoragePath, parsePowerShellCloudInspection };
