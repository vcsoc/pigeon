'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { createFixtures } = require('./fixtures.cjs');
const { launch } = require('./driver.cjs');
process.env.PIGEON_E2E_HEADLESS = '1';

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pigeon-first-thumbnails-'));
  const fixture = await createFixtures(root, { count: 16, coldCount: 0 });
  const report = path.join(root, 'report');
  await fs.mkdir(report);
  let app;
  try {
    app = await launch(fixture.profile, report);
    await app.wait(`document.querySelector('#startup-splash').classList.contains('hidden') && !state.library.assetStreamPending`);
    await app.evaluate(`selectLocation('cold-root')`);
    await app.wait(`state.locationId==='cold-root' && !state.library.locations.find(l=>l.id==='cold-root').scanning`);
    const cases = [['wide', 960, 240], ['portrait', 240, 960], ['square', 640, 640]];
    for (const [name, width, height] of cases) {
      await sharp({ create: { width, height, channels: 3, background: '#bc7432' } }).png().toFile(path.join(fixture.cold, `${name}.png`));
    }
    await app.evaluate(`window.pigeon.rescan('cold-root')`);
    await app.wait(`(()=>{const images=state.library.assets.filter(a=>a.locationId==='cold-root');return images.length===3&&images.every(a=>a.width&&a.height&&a.thumbnailPath&&elements.grid.querySelector('[data-asset-id="'+a.id+'"] img')?.naturalWidth>0);})()`, 6500);
    await app.wait(`!state.library.locations.find(l=>l.id==='cold-root').scanning`, 4500);
    const measure = async () => app.evaluate(`(()=>{const rowHeight=Math.max(52,Math.min(320,Number(document.querySelector('#zoom-slider').value)*.58));return [...elements.grid.querySelectorAll('.asset-card')].map(card=>{const asset=assetById(card.dataset.assetId),preview=card.querySelector('.asset-preview'),image=preview.querySelector('img');return{name:asset.filename,width:asset.width,height:asset.height,rowHeight,basis:parseFloat(card.style.getPropertyValue('--justified-basis')),ratio:parseFloat(card.style.getPropertyValue('--asset-ratio')),previewRatio:parseFloat(preview.style.getPropertyValue('--preview-ratio')),imageRatio:image.naturalWidth/image.naturalHeight};});})()`);
    const first = await measure();
    await app.evaluate(`selectView('all','All')`);
    await app.wait(`state.view==='all' && state.locationId===null && elements.grid.querySelectorAll('.asset-card').length>3`);
    await app.evaluate(`selectLocation('cold-root')`);
    await app.wait(`state.locationId==='cold-root' && elements.grid.querySelectorAll('.asset-card').length===3`);
    const revisit = await measure();
    await fs.writeFile(path.join(report, 'result.json'), JSON.stringify({ first, revisit }, null, 2));
    assert.equal(first.length, 3);
    for (const card of first) {
      const expected = Math.round(card.rowHeight * Math.max(.35, Math.min(3.5, card.width / card.height)));
      assert.equal(card.basis, expected, `${card.name} must use its real dimensions without leaving the folder`);
      assert.equal(card.ratio, Math.max(.35, Math.min(3.5, card.width / card.height)), `${card.name} must not keep the initial generic ratio`);
    }
    assert.deepEqual(app.errors, []);
    console.log(report);
  } catch (error) {
    if (app) await app.screenshot('failure').catch(() => {});
    console.error(report);
    throw error;
  } finally { if (app) await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
