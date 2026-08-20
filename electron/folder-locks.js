const path = require('node:path');

function normalizeSubfolder(value = '') {
  return String(value).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function isPathInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
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
