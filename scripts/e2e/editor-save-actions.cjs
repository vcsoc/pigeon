'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');
const { createFixtures } = require('./fixtures.cjs');
const { launch } = require('./driver.cjs');
process.env.PIGEON_E2E_HEADLESS = '1';

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pigeon-save-actions-'));
  const fixture = await createFixtures(root, { count: 12, coldCount: 0 });
  const report = path.join(root, 'report');
  const copy = path.join(fixture.profile, 'saved-copy.png');
  await fs.mkdir(report);
  process.env.PIGEON_E2E_SAVE_TARGET = copy;
  let app;
  try {
    app = await launch(fixture.profile, report);
    await app.wait(`document.querySelector('#startup-splash').classList.contains('hidden') && !state.library.assetStreamPending`);
    const asset = await app.evaluate(`state.library.assets.find(a => a.kind === 'image' && a.thumbnailPath)`);
    let original = await fs.readFile(asset.path);
    const sourceDimensions = await sharp(asset.path).metadata();
    const open = async () => {
      await app.evaluate(`openAnnotationEditor(${JSON.stringify(asset.id)})`);
      await app.wait(`!elements.annotationView.classList.contains('editor-preparing') && !elements.annotationView.classList.contains('hidden')`);
    };
    const crop = async () => app.evaluate(`(()=>{state.workingEdits.crop={x:10,y:10,width:40,height:30};renderAnnotations();})()`);
    await open();
    assert.deepEqual(await app.evaluate(`[...document.querySelectorAll('.annotation-header-actions > button[id$="annotations"]')].map(button=>[button.id,button.textContent.trim(),Boolean(button.title)])`), [
      ['save-annotations','Save',true], ['export-annotations','Save copy',true], ['save-draft-annotations','Save draft',true], ['close-annotations','Cancel',true]
    ]);
    assert.equal(await app.evaluate(`document.querySelector('#editor-resize-toggle').getAttribute('aria-pressed')`), 'false');
    assert.equal(await app.evaluate(`document.querySelector('#editor-resize-controls').classList.contains('hidden')`), true);
    await app.evaluate(`(()=>{const input=document.querySelector('#edit-resize-width');input.value='12';input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    assert.equal(await app.evaluate(`state.workingEdits.resize`), null, 'Resize input must not work before selecting Resize');
    await app.click('#save-annotations');
    await app.wait(`elements.annotationView.classList.contains('hidden')`);
    assert.equal((await sharp(asset.path).metadata()).width, sourceDimensions.width, 'Save without Resize must retain source width');
    assert.equal((await sharp(asset.path).metadata()).height, sourceDimensions.height, 'Save without Resize must retain source height');
    original = await fs.readFile(asset.path);
    await open();
    await app.click('#editor-resize-toggle');
    assert.equal(await app.evaluate(`document.querySelector('#editor-resize-toggle').getAttribute('aria-pressed')`), 'true');
    assert.equal(await app.evaluate(`document.querySelector('#editor-resize-controls').classList.contains('hidden')`), false);
    await app.evaluate(`(()=>{const input=document.querySelector('#edit-resize-width');input.value='32';input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    assert.equal((await app.evaluate(`state.workingEdits.resize`)).width, 32);
    await app.click('#editor-resize-toggle');
    assert.equal(await app.evaluate(`state.workingEdits.resize`), null, 'Deselecting Resize cancels pending resize');
    await crop();
    await app.click('#close-annotations');
    assert.deepEqual(await fs.readFile(asset.path), original, 'Cancel must discard pending crop');
    assert.equal((await app.evaluate(`assetById(${JSON.stringify(asset.id)})`)).editedPath ?? null, null);
    await open();
    assert.equal(await app.evaluate(`document.querySelector('#editor-resize-toggle').getAttribute('aria-pressed')`), 'false', 'Resize must reset when reopening editor');
    await crop();
    await app.click('#save-draft-annotations');
    await app.wait(`elements.annotationView.classList.contains('hidden')`);
    let saved = await app.evaluate(`assetById(${JSON.stringify(asset.id)})`);
    assert.ok(saved.editedPath);
    assert.equal((await sharp(saved.editedPath).metadata()).width, 40);
    assert.deepEqual(await fs.readFile(asset.path), original, 'Draft must not touch the file');
    await open();
    await app.click('#export-annotations');
    await app.wait(`document.querySelector('#toast')?.textContent.includes('Saved copy')`);
    assert.equal((await sharp(copy).metadata()).width, 40);
    assert.deepEqual(await fs.readFile(asset.path), original, 'Copy must not touch the file');
    await app.click('#save-annotations');
    await app.wait(`elements.annotationView.classList.contains('hidden')`);
    saved = await app.evaluate(`assetById(${JSON.stringify(asset.id)})`);
    assert.equal(saved.editedPath, null);
    assert.equal((await sharp(asset.path).metadata()).width, 40, 'Save must overwrite physical file');
    assert.equal((await sharp(asset.path).metadata()).height, 30);
    assert.deepEqual(app.errors, []);
    console.log(JSON.stringify({ save: true, copy: true, draft: true, cancel: true }));
  } finally {
    if (app) await app.close();
    delete process.env.PIGEON_E2E_SAVE_TARGET;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
