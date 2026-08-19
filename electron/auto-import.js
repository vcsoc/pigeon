'use strict';

const path = require('node:path');

function validPortfolioFolderName(name) {
  const value = String(name || '').trim();
  return Boolean(value && value !== '.' && value !== '..' && !/[<>:"/\\|?*\x00-\x1f]/.test(value) && !/[. ]$/.test(value));
}

function portfolioAutoImportPath(root, portfolioName) {
  const base = String(root || '').trim();
  if (!base || !validPortfolioFolderName(portfolioName)) return null;
  return path.join(path.resolve(base), String(portfolioName).trim());
}

function samePath(first, second) {
  return path.resolve(String(first || '')).toLowerCase() === path.resolve(String(second || '')).toLowerCase();
}

module.exports = { portfolioAutoImportPath, samePath, validPortfolioFolderName };
