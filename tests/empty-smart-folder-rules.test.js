const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../electron/library-core');
const rules = require('../src/smart-folder-rules');

// Exercise the real renderer evaluator as well as the main-process evaluator.
const source = fs.readFileSync(path.join(__dirname, '../src/renderer.js'), 'utf8');
const context = { window: { PigeonSmartFolderRules: rules } };
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function matchesSmartRule('), source.indexOf('let duplicateRefreshGeneration=')), context);
const evaluators = [['main', core.matchesFilters], ['renderer', context.matchesSavedFilters]];
const asset = { filename: 'example.jpg', tags: ['family'], rating: 3, collectionIds: [] };
const placeholder = { field: 'tags', operator: 'contains', value: '', values: [] };

for (const [name, matches] of evaluators) {
  test(`${name}: empty saved All conditions are unrestricted in both match modes`, () => {
    for (const ruleMatch of ['all', 'any']) {
      for (const rule of [placeholder, { field: 'name', value: '  ' }, { field: 'rating', operator: 'greater-than', value: '' }]) {
        assert.equal(matches(asset, { ruleMatch, rules: [rule] }), true);
        assert.equal(matches({ ...asset, tags: [] }, { ruleMatch, rules: [rule] }), true);
      }
    }
  });

  test(`${name}: placeholders neither reject AND matches nor bypass real OR conditions`, () => {
    for (const ruleMatch of ['all', 'any']) {
      const filters = { ruleMatch, rules: [placeholder, { field: 'tags', operator: 'equals', values: ['family'] }] };
      assert.equal(matches(asset, filters), true);
      assert.equal(matches({ ...asset, tags: ['work'] }, filters), false);
    }
    assert.equal(matches(asset, { query: 'missing', rules: [placeholder] }), false);
    assert.equal(matches(asset, { tags: ['missing'], rules: [placeholder] }), false);
  });

  test(`${name}: valueless null operators and explicit zero/false values remain active`, () => {
    assert.equal(matches(asset, { rules: [{ field: 'tags', operator: 'null' }] }), false);
    assert.equal(matches({ ...asset, tags: [] }, { rules: [{ field: 'tags', operator: 'not-null' }] }), false);
    assert.equal(matches(asset, { rules: [{ field: 'rating', operator: 'equals', value: 0 }] }), false);
    assert.equal(matches(asset, { rules: [{ field: 'rating', operator: 'greater-than', value: 0 }] }), true);
    assert.equal(matches({ ...asset, favorite: true }, { rules: [{ field: 'favorite', operator: 'equals', value: false }] }), false);
    assert.equal(matches(asset, { rules: [{ field: 'name', operator: 'regex', value: '[' }] }), false);
  });
}
