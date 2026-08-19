'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { portfolioAutoImportPath, samePath, validPortfolioFolderName } = require('../electron/auto-import');

test('auto-import resolves one exact portfolio-named child below the configured root', () => {
  const root=path.resolve('C:\\Dropbox\\Pigeon');
  assert.equal(portfolioAutoImportPath(root,'Client XYZ'),path.join(root,'Client XYZ'));
  assert.equal(samePath(portfolioAutoImportPath(root,'Client XYZ'),path.join(root,'Client XYZ')),true);
});

test('invalid portfolio folder names fail safely instead of escaping the auto-import root', () => {
  for(const name of ['', '.', '..', '../Other', 'Bad/Name', 'Bad*Name', 'Trailing.'])assert.equal(validPortfolioFolderName(name),false);
  assert.equal(portfolioAutoImportPath('C:\\Dropbox\\Pigeon','../Other'),null);
});
