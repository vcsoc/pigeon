const test = require('node:test');
const assert = require('node:assert/strict');
const { FILE_TYPE_GROUPS, DEFAULT_INDEX_CATEGORIES, IMAGE_EXTENSIONS, DOCUMENT_EXTENSIONS, normalizedCustomExtensions, shouldIndexFile, dialogExtensions, indexingPolicySignature } = require('../electron/file-types');

test('focused indexing defaults cover common media, documents, presentations, and design files', () => {
  for (const file of ['photo.jpg','camera.cr3','animation.gif','clip.mp4','movie.mkv','sound.flac','notes.md','manual.pdf','brief.docx','slides.pptx','sheet.xlsx','design.afdesign','capture.snagx','font.woff2','scene.glb']) {
    assert.equal(shouldIndexFile(file), true, `${file} should be indexed by default`);
  }
  for (const file of ['archive.zip','installer.exe','binary.dll','README']) assert.equal(shouldIndexFile(file), false, `${file} should be excluded by default`);
  assert.deepEqual(DEFAULT_INDEX_CATEGORIES, Object.keys(FILE_TYPE_GROUPS));
  assert.equal(indexingPolicySignature({}), indexingPolicySignature({ indexAllFiles:false, indexFileCategories:[...DEFAULT_INDEX_CATEGORIES], indexCustomExtensions:'' }));
  assert(IMAGE_EXTENSIONS.has('.heic'));
  assert(DOCUMENT_EXTENSIONS.has('.md'));
  assert(DOCUMENT_EXTENSIONS.has('.pptx'));
});

test('indexing categories and custom extensions are configurable', () => {
  const documentsOnly = { indexFileCategories: ['documents'], indexCustomExtensions: 'comic; custom, .MUSE' };
  assert.equal(shouldIndexFile('readme.md', documentsOnly), true);
  assert.equal(shouldIndexFile('photo.jpg', documentsOnly), false);
  assert.equal(shouldIndexFile('issue.comic', documentsOnly), true);
  assert.equal(shouldIndexFile('project.MUSE', documentsOnly), true);
  assert.deepEqual(normalizedCustomExtensions('comic; custom, .MUSE'), ['.comic','.custom','.muse']);
  assert(dialogExtensions(documentsOnly).includes('md'));
});

test('include all files overrides the focused extension policy', () => {
  assert.equal(shouldIndexFile('archive.zip', { indexAllFiles: true, indexFileCategories: [] }), true);
  assert.equal(shouldIndexFile('extensionless', { indexAllFiles: true, indexFileCategories: [] }), true);
  assert.equal(shouldIndexFile('archive.zip', { indexAllFiles: false, indexFileCategories: [] }), false);
});
