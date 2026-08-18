'use strict';

function errorMessages(error) {
  const messages = [];
  const seen = new Set();
  let current = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current.message) messages.push(String(current.message));
    current = current.cause;
  }
  return messages.join('\n');
}

function isMissingUpdateMetadataError(error) {
  const message = errorMessages(error);
  const namesUpdateMetadata = /(?:latest|[a-z0-9_-]+)-(?:mac|linux)\.ya?ml|(?:^|\/)latest\.ya?ml/i.test(message);
  return namesUpdateMetadata && (/cannot find/i.test(message) || /(?:http|status)[^\n]*404|\b404\b/i.test(message));
}

function versionParts(value) {
  const match = String(value || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:[-+]([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return { numbers: match.slice(1, 4).map(Number), prerelease: match[4] ? match[4].split('.') : [] };
}

function compareVersions(first, second) {
  const a = versionParts(first), b = versionParts(second);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] > b.numbers[index] ? 1 : -1;
  if (!a.prerelease.length || !b.prerelease.length) return a.prerelease.length === b.prerelease.length ? 0 : a.prerelease.length ? -1 : 1;
  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index += 1) {
    if (a.prerelease[index] === undefined) return -1;
    if (b.prerelease[index] === undefined) return 1;
    if (a.prerelease[index] === b.prerelease[index]) continue;
    const aNumber = /^\d+$/.test(a.prerelease[index]), bNumber = /^\d+$/.test(b.prerelease[index]);
    if (aNumber && bNumber) return Number(a.prerelease[index]) > Number(b.prerelease[index]) ? 1 : -1;
    if (aNumber !== bNumber) return aNumber ? -1 : 1;
    return a.prerelease[index] > b.prerelease[index] ? 1 : -1;
  }
  return 0;
}

function isNewerVersion(candidate, current) { return compareVersions(candidate, current) === 1; }
function requiresForcedUpdate(policy, current) {
  return Boolean(policy?.force && versionParts(policy.minimumVersion) && compareVersions(current, policy.minimumVersion) === -1);
}

module.exports = { compareVersions, isMissingUpdateMetadataError, isNewerVersion, requiresForcedUpdate, versionParts };
