const path = require('node:path');

function normalizeSubfolder(value = '') {
  return String(value).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function isPathInside(root, candidate) {
  let resolvedRoot = path.resolve(root), resolvedCandidate = path.resolve(candidate);
  const windowsStyle = /(?:^|[\\/])[a-z]:[\\/]/i.test(String(root)) || /(?:^|[\\/])[a-z]:[\\/]/i.test(String(candidate));
  if (process.platform === 'win32' || process.platform === 'darwin' || windowsStyle) {
    resolvedRoot = resolvedRoot.toLowerCase();
    resolvedCandidate = resolvedCandidate.toLowerCase();
  }
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function matchingFolderLockRules(asset, rules = [], locations = []) {
  if (!asset?.path) return [];
  return rules.filter((rule) => {
    const location = locations.find((item) => item.id === rule.locationId);
    if (!location || location.type !== 'folder') return false;
    return isPathInside(path.resolve(location.path, normalizeSubfolder(rule.subfolder)), asset.path);
  });
}

module.exports = { isPathInside, matchingFolderLockRules };
