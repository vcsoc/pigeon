const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer.js'), 'utf8');
const tabs = fs.readFileSync(path.join(__dirname, '../src/semantic-search.js'), 'utf8');
const source = renderer.slice(renderer.indexOf('function revealCurrentSidebarItem('), renderer.indexOf('function renderNavigationDestination('));

function fixture(state) {
  const keys = [], sections = [], scroll = { scrollTop: 100, getBoundingClientRect: () => ({ top: 10, height: 400 }) };
  const target = { hidden: false, getBoundingClientRect: () => ({ top: 510, height: 20 }) };
  const content = { classList: { contains: name => name === 'collapsed' } };
  const shell = { classList: { contains: () => false } };
  const context = {
    state, keys, sections, CSS: { escape: value => value },
    $: selector => selector === '#sidebar-tree-scroll' ? scroll : selector === '.app-shell' ? shell : content,
    document: { querySelector: () => target }, elements: { locationList: { querySelector: () => ({ querySelector: () => target }) } },
    collectionCollapseKey: id => `collection:${id}`, smartFolderCollapseKey: id => `smart:${id}`,
    locationCollapseKey: (id, folder = '') => `location:${id}:${folder}`,
    setFolderCollapseStates: values => keys.push(...values), setSidebarSectionExpanded: name => sections.push(name), renderSidebar: () => {},
  };
  vm.runInNewContext(source + '\nrevealCurrentSidebarItem();', context);
  return { keys, sections, scroll };
}

test('tab reveal opens collection and smart-folder ancestors and centers the row', () => {
  for (const smart of [false, true]) {
    const items = [{ id: 'parent', parentId: null }, { id: 'child', parentId: 'parent' }];
    const result = fixture({ collectionId: smart ? null : 'child', smartFolderId: smart ? 'child' : null, library: { collections: items, smartFolders: items } });
    assert.deepEqual(result.keys, [smart ? 'smart:parent' : 'collection:parent']);
    assert.deepEqual(result.sections, [smart ? 'smart-folders' : 'collections']);
    assert.equal(result.scroll.scrollTop, 410);
  }
});

test('tab reveal expands only physical ancestors', () => {
  const result = fixture({ locationId: 'loc', locationSubfolder: 'a/b/c', library: {} });
  assert.deepEqual(result.keys, ['location:loc:', 'location:loc:a', 'location:loc:a/b']);
  assert.deepEqual(result.sections, ['indexed-locations']);
});

test('only files tab clicks request sidebar reveal', () => {
  assert.match(tabs, /showTab\(button\.dataset\.thumbnailTab\);if\(button\.dataset\.thumbnailTab==='files'\)revealCurrentSidebarItem\(\)/);
});
