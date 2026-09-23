'use strict';
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { createFixtures } = require('./fixtures.cjs');
const { launch } = require('./driver.cjs');
process.env.PIGEON_E2E_HEADLESS = '1';

(async () => {
  const mode = process.argv[2] || 'plain', root = await fs.mkdtemp(path.join(os.tmpdir(), 'pigeon-editor-crop-')), report = path.join(root, 'report');
  await fs.mkdir(report); console.log('REPORT', report);
  let app;
  const deadline = setTimeout(() => { app?.child.kill('SIGKILL'); process.exit(1); }, 12000);
  try {
    const fixture = await createFixtures(root, { count: 350, coldCount: 0 });
    app = await launch(fixture.profile, report);
    await app.wait(`document.querySelector('#startup-splash')?.classList.contains('hidden')&&!state.library.assetStreamPending`);
    const selector = '.asset-card[data-asset-kind="image"]';
    await app.click(selector);
    const asset = await app.evaluate('assetById(state.selectedId)'), hash = crypto.createHash('sha256').update(await fs.readFile(asset.path)).digest('hex');
    await app.click(selector, { button: 'right' });
    await app.move('.context-action-group:has([data-context-action="annotate"]) > button');
    await app.click('[data-context-action="annotate"]');
    await app.wait(`!elements.annotationView.classList.contains('hidden')&&elements.annotationStage.clientWidth>0`);
    if (mode === 'layer') await app.click('[data-tool="rect"]');
    await app.click('[data-tool="crop"]');
    assert.equal(await app.evaluate('state.annotationTool'), 'crop');
    const rect = await app.evaluate(`(()=>{const r=elements.annotationStage.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()`), start = mode === 'layer' ? .5 : .2;
    for (const [type, f, buttons] of [['mouseMoved', start, 0], ['mousePressed', start, 1], ['mouseMoved', .8, 1], ['mouseReleased', .8, 0]]) await app.send('Input.dispatchMouseEvent', { type, x: rect.x + rect.width * f, y: rect.y + rect.height * f, button: type === 'mouseMoved' ? 'none' : 'left', buttons, clickCount: 1 });
    const crop = await app.evaluate('state.workingEdits.crop');
    assert.ok(crop && crop.width > 10 && crop.height > 10);
    await app.click('#save-annotations');
    await app.wait(`elements.annotationView.classList.contains('hidden')`, 3500);
    const updated = await app.evaluate(`assetById(${JSON.stringify(asset.id)})`);
    assert.equal(updated.editedPath, null);
    const output = await sharp(asset.path).metadata();
    assert.equal(output.width, updated.width); assert.equal(output.height, updated.height);
    assert.ok(Math.abs(updated.width - Math.round(crop.width)) <= 1);
    assert.ok(Math.abs(updated.height - Math.round(crop.height)) <= 1);
    assert.notEqual(crypto.createHash('sha256').update(await fs.readFile(asset.path)).digest('hex'), hash);
    assert.deepEqual(app.errors, []);
    const result = { mode, crop, width: updated.width, height: updated.height, physicalFileUpdated: true, status: 'passed' };
    await fs.writeFile(path.join(report, 'result.json'), JSON.stringify(result)); console.log(JSON.stringify(result));
  } catch (error) { console.error(error); if (app) await app.screenshot('failure').catch(() => {}); process.exitCode = 1; }
  finally { if (app) await app.close(); clearTimeout(deadline); }
})();
