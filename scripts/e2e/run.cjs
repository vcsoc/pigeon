const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { createFixtures } = require("./fixtures.cjs");
const { launch, sleep } = require("./driver.cjs");
if (process.argv.includes("--headless")) process.env.PIGEON_E2E_HEADLESS = "1";
if (process.env.PIGEON_E2E_HEADLESS === "1" && process.platform !== "linux")
  throw Error(
    "Ozone headless mode is Linux-only; use test:e2e on this platform",
  );
const budgets = {
  cachedStartupMs: 3000,
  searchMs: 500,
  tagReplacementFeedbackMs: 150,
  tagReplacementMs: 2000,
  selectionMs: 150,
  menuMs: 150,
  scanFeedbackMs: 250,
  firstColdThumbnailMs: 1000,
  coldCompletionMs: 15000,
  magnifierMs: 700,
  scrollP95Ms: 34,
  scrollWorstMs: 150,
};
const visibleImages = `(()=>{const v=document.querySelector('#grid-wrap').getBoundingClientRect(),cards=[...document.querySelectorAll('.asset-card')].filter(c=>{const r=c.getBoundingClientRect();return r.bottom>v.top&&r.top<v.bottom&&r.right>v.left&&r.left<v.right;});return {cards:cards.length,loaded:cards.filter(c=>{const i=c.querySelector('.asset-preview>img.thumbnail-loaded');return i?.complete&&i.naturalWidth>0;}).length};})()`;
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pigeon-e2e-")),
    reportDir = path.join(root, "report");
  await fs.mkdir(reportDir);
  let app;
  const count = Math.max(
      1000,
      Math.min(50000, Number(process.env.PIGEON_E2E_ASSETS) || 10000),
    ),
    report = {
      status: "running",
      startedAt: new Date().toISOString(),
      root,
      budgets,
      environment: {
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        cpus: os.cpus().length,
        memory: os.totalmem(),
        loadAverage: os.loadavg(),
        startupProfiling: process.argv.includes("--profile-startup"),
        electron: require("electron/package.json").version,
        displayBackend:
          process.env.PIGEON_E2E_HEADLESS === "1"
            ? "Ozone headless (not a Wayland test)"
            : "desktop",
      },
      sourceHashes: {},
      cases: [],
      uncovered: [
        "Real SMB/USB latency and disconnects",
        "macOS/Windows packaging and native dialogs",
        "Archive import/export and malicious archive fixtures (unit suite only)",
        "Permissions/Polkit and locked/encrypted portfolios",
        "Similarity accuracy and large similarity searches",
        "Firefox capture workflows",
        "External editors, AI plugins, printing and updates",
        "Thousands-tag catalogs and autocomplete under large catalogs",
        "Organizing groups, generated tag-rule editor, Smart Folder live reconciliation",
        "Physical move/rename conflicts and native file drags",
        "Every customized shortcut and typography combination",
      ],
    };
  for (const file of [
    "electron/main.js",
    "electron/scan-worker.js",
    "electron/thumbnail-worker.js",
    "src/renderer.js",
    "src/styles.css",
    "src/progressive-preview.js",
    "src/asset-indexes.js",
    "electron/incremental-work-queue.js",
    "electron/thumbnail-scheduler.js",
    "scripts/e2e/run.cjs",
    "scripts/e2e/driver.cjs",
    "scripts/e2e/fixtures.cjs",
    "scripts/e2e/bootstrap.cjs",
  ])
    report.sourceHashes[file] = crypto
      .createHash("sha256")
      .update(await fs.readFile(path.join(__dirname, "../..", file)))
      .digest("hex");
  const save = () =>
    fs.writeFile(
      path.join(reportDir, "results.json"),
      JSON.stringify(report, null, 2),
    );
  await save();
  console.log(`REPORT ${reportDir}`);
  let currentCase;
  const measure = (values) =>
    Object.assign((currentCase.measurements ||= {}), values);
  async function scenario(name, fn) {
    const entry = {
      name,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    currentCase = entry;
    report.cases.push(entry);
    await save();
    try {
      const result = await fn();
      entry.measurements = { ...entry.measurements, ...result };
      entry.status = "passed";
      console.log("PASS", name, JSON.stringify(entry.measurements));
    } catch (error) {
      entry.status = "failed";
      entry.error = error.stack;
      console.error("FAIL", name, error.message);
      if (app)
        try {
          const snapshot = await app.evaluate(
            `({text:document.body.innerText.slice(0,8000),location:state.locationId,view:state.view,selection:[...state.selectedIds],active:document.activeElement?.outerHTML.slice(0,1500),viewer:document.querySelector('#media-viewer')?.className,sidebar:[...document.querySelectorAll('.location-root-button')].map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON(),display:getComputedStyle(e).display})),videos:[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc,time:v.currentTime,paused:v.paused,ready:v.readyState,error:v.error?.message,frames:v.getVideoPlaybackQuality().totalVideoFrames})),tasks:[...backgroundTasks.values()]})`,
          );
          await fs.writeFile(
            path.join(reportDir, `failure-${report.cases.length}.json`),
            JSON.stringify(snapshot, null, 2),
          );
          await app.screenshot(`failure-${report.cases.length}`);
        } catch (captureError) {
          entry.captureError = captureError.message;
        }
    }
    entry.finishedAt = new Date().toISOString();
    await save();
  }
  try {
    const fixture = await createFixtures(root, { count });
    report.fixture = {
      ...fixture,
      imageEncoding:
        "1280–1392px patterned JPEGs, eight distinct contents, real files and cached JPEGs",
      cachedSourceHierarchy: "100 directories",
      coldCache: "empty",
      isolated: true,
    };
    await save();
    app = await launch(fixture.profile, reportDir);
    if (report.environment.startupProfiling) {
      await app.send("Profiler.enable");
      await app.send("Profiler.start");
    }
    async function persistedRatings(ids, rating) {
      const { DatabaseSync } = require("node:sqlite");
      for (let i = 0; i < 80; i++) {
        const db = new DatabaseSync(path.join(fixture.profile, "library.db"), {
          readOnly: true,
        });
        let ok;
        try {
          ok = ids.every(
            (id) =>
              JSON.parse(
                db.prepare("SELECT payload FROM assets WHERE id=?").get(id)
                  .payload,
              ).rating === rating,
          );
        } finally {
          db.close();
        }
        if (ok) return true;
        await sleep(50);
      }
      throw Error(`Rating ${rating} not persisted for both selected assets`);
    }
    const env = JSON.parse(
      await fs.readFile(
        path.join(fixture.profile, "e2e-environment.json"),
        "utf8",
      ),
    );
    assert.equal(env.userData, fixture.profile);
    await scenario(
      "populated startup and decoded cached viewport",
      async () => {
        await app.wait(
          `typeof state!=='undefined'&&!state.library.loading&&!state.library.assetStreamPending&&state.library.assets.length===${fixture.total}`,
          15000,
        );
        await app.wait(
          `(()=>{const x=${visibleImages};return x.cards>=8&&x.loaded===x.cards&&document.querySelector('#startup-splash').classList.contains('hidden');})()`,
          10000,
        );
        const ms = Date.now() - app.started,
          view = await app.evaluate(visibleImages);
        measure({
          ms,
          ...view,
          total: fixture.total,
          viewport: await app.evaluate(
            "({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})",
          ),
        });
        assert.ok(
          ms <= budgets.cachedStartupMs,
          `Cached startup ${ms}ms exceeds ${budgets.cachedStartupMs}ms`,
        );
        return { ms, ...view, total: fixture.total };
      },
    );
    if (report.environment.startupProfiling) {
      const { profile } = await app.send("Profiler.stop");
      await fs.writeFile(
        path.join(reportDir, "startup.cpuprofile"),
        JSON.stringify(profile),
      );
    }
    await app.evaluate(
      `window.__e2eLongTasks=[];new PerformanceObserver(l=>window.__e2eLongTasks.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:false});`,
    );
    await scenario(
      "scroll rendering, bounded DOM and decoded thumbnails",
      async () => {
        await app.evaluate(
          `window.__e2eFrames=[];window.__e2eFrameStop=false;let last=performance.now();requestAnimationFrame(function sample(now){window.__e2eFrames.push(now-last);last=now;if(!window.__e2eFrameStop)requestAnimationFrame(sample);});`,
        );
        const p = await app.move("#grid-wrap");
        for (let i = 0; i < 8; i++) {
          await app.send("Input.dispatchMouseEvent", {
            type: "mouseWheel",
            ...p,
            deltaX: 0,
            deltaY: 250,
          });
          await sleep(60);
        }
        await sleep(200);
        const result = await app.evaluate(
          `(()=>{window.__e2eFrameStop=true;return{frames:window.__e2eFrames,cards:document.querySelectorAll('.asset-card').length,top:document.querySelector('#grid-wrap').scrollTop};})()`,
        );
        assert.ok(result.top > 0, "Wheel did not scroll");
        assert.ok(result.frames.length >= 10, "Insufficient frame samples");
        result.frames.sort((a, b) => a - b);
        const p95 = result.frames[Math.floor(result.frames.length * 0.95)],
          worst = result.frames.at(-1);
        measure({
          p95,
          worst,
          cards: result.cards,
          samples: result.frames.length,
        });
        assert.ok(result.cards <= 600, `Unbounded card DOM: ${result.cards}`);
        assert.ok(p95 <= budgets.scrollP95Ms, `p95 frame ${p95.toFixed(1)}ms`);
        assert.ok(
          worst <= budgets.scrollWorstMs,
          `Worst frame ${worst.toFixed(1)}ms`,
        );
        await app.wait(
          `(()=>{const x=${visibleImages};return x.cards>0&&x.loaded===x.cards;})()`,
        );
        return {
          p95,
          worst,
          cards: result.cards,
          samples: result.frames.length,
        };
      },
    );
    await scenario(
      "search through the real input in a populated library",
      async () => {
        const start = Date.now();
        await app.fill("#search-input", "reference-00123");
        await app.wait(
          `document.querySelectorAll('.asset-card').length===1&&document.querySelector('.asset-card .card-name')?.textContent.includes('reference-00123')`,
          5000,
        );
        const ms = Date.now() - app.lastActionAt;
        measure({ ms });
        assert.ok(
          ms <= budgets.searchMs,
          `Search ${ms}ms exceeds ${budgets.searchMs}ms`,
        );
        return { ms };
      },
    );
    await scenario(
      "single-image Enter opens once and Escape closes it",
      async () => {
        await app.click(".asset-card");
        await app.key("Enter");
        await app.wait(
          `!document.querySelector('#media-viewer').classList.contains('hidden')&&document.querySelector('#viewer-image').naturalWidth>0`,
        );
        await sleep(100);
        assert.equal(
          await app.evaluate(
            `document.querySelector('#media-viewer').classList.contains('hidden')`,
          ),
          false,
          "Opening Enter also closed the viewer",
        );
        await app.key("Escape");
        await app.wait(
          `document.querySelector('#media-viewer').classList.contains('hidden')`,
        );
        return { opened: true, closed: true };
      },
    );
    await app.fill("#search-input", "");
    await app.wait(`document.querySelectorAll('.asset-card').length>=2`);
    await scenario(
      "selection, batch rating reset and persistent metadata",
      async () => {
        const ids = await app.evaluate(
          `[...document.querySelectorAll('.asset-card')].slice(0,2).map(c=>c.dataset.assetId)`,
        );
        const start = Date.now();
        await app.click(`[data-asset-id="${ids[0]}"]`);
        await app.wait(`state.selectedId===${JSON.stringify(ids[0])}`);
        const selectionMs = Date.now() - app.lastActionAt;
        measure({ selectionMs });
        assert.ok(
          selectionMs <= budgets.selectionMs,
          `Selection ${selectionMs}ms`,
        );
        await app.click(`[data-asset-id="${ids[1]}"]`, {
          modifiers: process.platform === "darwin" ? 4 : 2,
        });
        await app.wait("state.selectedIds.size===2");
        await app.click('#rating-row [data-rating="5"]');
        await app.wait(
          `${JSON.stringify(ids)}.every(id=>state.library.assets.find(a=>a.id===id)?.rating===5)`,
        );
        await persistedRatings(ids, 5);
        await app.key("0", "Digit0", process.platform === "darwin" ? 4 : 2);
        assert.equal(
          await app.evaluate(
            `${JSON.stringify(ids)}.every(id=>state.library.assets.find(a=>a.id===id)?.rating===5)`,
          ),
          true,
          "Ctrl/Cmd+0 reset ratings",
        );
        await app.click("#search-input");
        await app.key("0");
        assert.equal(
          await app.evaluate(
            `${JSON.stringify(ids)}.every(id=>state.library.assets.find(a=>a.id===id)?.rating===5)`,
          ),
          true,
          "Typing 0 reset ratings",
        );
        await app.fill("#search-input", "");
        await app.wait(
          `${JSON.stringify(ids)}.every(id=>document.querySelector('[data-asset-id="'+id+'"]'))`,
        );
        await app.click(`[data-asset-id="${ids[0]}"]`);
        await app.click(`[data-asset-id="${ids[1]}"]`, {
          modifiers: process.platform === "darwin" ? 4 : 2,
        });
        await app.evaluate(
          `window.__e2eRatingImages=${JSON.stringify(ids)}.map(id=>document.querySelector('[data-asset-id="'+id+'"] img.thumbnail-loaded'));`,
        );
        await app.key("0");
        await app.wait(
          `${JSON.stringify(ids)}.every(id=>state.library.assets.find(a=>a.id===id)?.rating===0)`,
        );
        assert.equal(
          await app.evaluate(
            `${JSON.stringify(ids)}.every((id,i)=>window.__e2eRatingImages[i]&&window.__e2eRatingImages[i]===document.querySelector('[data-asset-id="'+id+'"] img.thumbnail-loaded'))`,
          ),
          true,
          "Rating reset replaced loaded images",
        );
        await persistedRatings(ids, 0);
        return { selectionMs, count: 2, persisted: true };
      },
    );
    await scenario(
      "two-video playback renders changing frames and preserves manual mute state",
      async () => {
        await app.click(
          '[data-location-id="media-root"] .location-root-button',
        );
        await app.wait(`document.querySelectorAll('.asset-card').length===2`);
        const ids = await app.evaluate(
          `[...document.querySelectorAll('.asset-card')].map(c=>c.dataset.assetId)`,
        );
        await app.click(`[data-asset-id="${ids[0]}"]`);
        await app.click(`[data-asset-id="${ids[1]}"]`, {
          modifiers: process.platform === "darwin" ? 4 : 2,
        });
        await app.key("Enter");
        await app.wait(
          `document.querySelectorAll('#viewer-multi-grid video').length===2&&[...document.querySelectorAll('#viewer-multi-grid video')].every(v=>v.readyState>=2&&v.currentTime>.5&&v.getVideoPlaybackQuality().totalVideoFrames>2)`,
        );
        const clip = await app.evaluate(
          `(()=>{const r=document.querySelector('#viewer-multi-grid video').getBoundingClientRect();return{x:r.x+r.width*.25,y:r.y+r.height*.25,width:r.width*.5,height:r.height*.4,scale:1};})()`,
        );
        const capture = async () => {
          const r = await app.send("Page.captureScreenshot", {
            format: "png",
            clip,
          });
          return sharp(Buffer.from(r.data, "base64"))
            .removeAlpha()
            .raw()
            .toBuffer();
        };
        const a = await capture();
        await sleep(500);
        const b = await capture();
        let changed = 0;
        for (let i = 0; i < a.length; i++)
          if (Math.abs(a[i] - b[i]) > 15) changed++;
        const changedFraction = changed / a.length;
        assert.ok(
          changedFraction > 0.01,
          "Video clock advanced without changing rendered pixels",
        );
        await app.evaluate(
          `document.querySelector('#viewer-multi-grid video').muted=false`,
        );
        await app.key(" ", "Space");
        await app.wait(
          `[...document.querySelectorAll('#viewer-multi-grid video')].every(v=>v.paused)`,
        );
        await app.key("Enter");
        await app.wait(
          `[...document.querySelectorAll('#viewer-multi-grid video')].every(v=>!v.paused)`,
        );
        assert.equal(
          await app.evaluate(
            `document.querySelector('#viewer-multi-grid video').muted`,
          ),
          false,
        );
        await app.key("Escape");
        await app.wait(
          `document.querySelector('#media-viewer').classList.contains('hidden')`,
        );
        return { videos: 2, changedFraction, manualMutePreserved: true };
      },
    );
    await scenario(
      "cold nested rescan produces visible thumbnails before indexing finishes",
      async () => {
        if (
          await app.evaluate(
            `!document.querySelector('#media-viewer').classList.contains('hidden')`,
          )
        )
          await app.key("Escape");
        await app.click('[data-location-id="cold-root"] .location-root-button');
        if (!(await app.evaluate("state.includeSubfolderContent")))
          await app.click("#subfolder-content-toggle");
        await app.click(
          '[data-location-id="cold-root"] .location-root-button',
          { button: "right" },
        );
        const group = await app.evaluate(
          `(()=>{const a=[...document.querySelectorAll('.context-action-group>button')];const i=a.findIndex(b=>b.textContent.includes('Edit & maintain'));return i;})()`,
        );
        assert.ok(group >= 0, "Maintenance submenu missing");
        await app.move(
          `.context-action-group:nth-of-type(${group + 1})>button`,
        );
        await app.wait(
          `(()=>{const b=document.querySelector('[data-location-action="rescan"]');return b&&b.getBoundingClientRect().width>0;})()`,
        );
        await app.click('[data-location-action="rescan"]');
        const start = app.lastActionAt;
        report.coldRequested = true;
        report.coldStartedAt = start;
        await app.wait(
          `[...backgroundTasks.values()].some(t=>t.id==='default:scan:cold-root'&&!t.done)`,
          2000,
        );
        const feedbackMs = Date.now() - start;
        assert.ok(
          feedbackMs <= budgets.scanFeedbackMs,
          `Scan feedback ${feedbackMs}ms`,
        );
        const first = await app.wait(
          `(()=>{const cards=[...document.querySelectorAll('.asset-card')],card=cards.find(c=>{const i=c.querySelector('img.thumbnail-loaded');return i?.naturalWidth>0&&state.library.assets.find(a=>a.id===c.dataset.assetId)?.locationId==='cold-root';});if(!card)return false;const task=[...backgroundTasks.values()].find(t=>t.id==='default:scan:cold-root');return{id:card.dataset.assetId,magnifier:!!card.querySelector('.thumbnail-fit-preview'),task:task?{completed:task.completed,total:task.total,done:task.done}:null};})()`,
          15000,
        );
        const firstVisibleMs = Date.now() - start;
        measure({ feedbackMs, firstVisibleMs, ...first.value });
        assert.ok(
          first.value.task &&
            !first.value.task.done &&
            first.value.task.completed < first.value.task.total,
          "First visible thumbnail arrived only after indexing finished",
        );
        assert.ok(
          firstVisibleMs <= budgets.firstColdThumbnailMs,
          `Cold thumbnail ${firstVisibleMs}ms`,
        );
        assert.ok(first.value.magnifier, "New thumbnail has no magnifier");
        assert.equal(
          await app.evaluate(
            `state.library.assets.some(a=>a.locationId==='outside-root')`,
          ),
          false,
          "Rescan escaped selected scope",
        );
        report.coldFirstId = first.value.id;
        return { feedbackMs, firstVisibleMs, ...first.value };
      },
    );
    await scenario("magnifier displays and dismisses correctly", async () => {
      const id =
        report.coldFirstId ||
        (await app.evaluate(
          `document.querySelector('.asset-card:has(img.thumbnail-loaded)')?.dataset.assetId`,
        ));
      assert.ok(id, "No decoded thumbnail available to test");
      const selector = `[data-asset-id="${id}"] .thumbnail-fit-preview`;
      await app.point(selector);
      assert.equal(
        await app.evaluate(
          `document.querySelector('#hover-fit-preview').classList.contains('hidden')`,
        ),
        true,
        "Magnifier was already open before measurement",
      );
      const rect = await app.evaluate(
        `(()=>{const r=document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect();return r?{x:r.right-7,y:r.bottom-7}:null;})()`,
      );
      assert.ok(rect, "Missing magnifier control");
      const start = Date.now();
      await app.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        ...rect,
      });
      await app.wait(
        `!document.querySelector('#hover-fit-preview').classList.contains('hidden')&&document.querySelector('#hover-fit-preview img').naturalWidth>0`,
        2000,
      );
      const ms = Date.now() - start;
      assert.ok(ms <= budgets.magnifierMs, `Magnifier ${ms}ms`);
      await app.move("#grid-wrap");
      await app.send("Input.dispatchMouseEvent", {
        type: "mouseWheel",
        ...(await app.move("#grid-wrap")),
        deltaX: 0,
        deltaY: 100,
      });
      await app.wait(
        `document.querySelector('#hover-fit-preview').classList.contains('hidden')`,
        500,
      );
      return { ms };
    });
    await scenario(
      "cached interaction stays responsive while new previews advance",
      async () => {
        const countPreviews = `state.library.assets.filter(a=>a.locationId==='cold-root'&&a.thumbnailPath).length`;
        const before = await app.evaluate(countPreviews);
        assert.ok(
          before > 0 && before < fixture.coldCount,
          "No active cold workload; this case is untested",
        );
        await app.click('.library-nav [data-view="all"]');
        await app.fill("#search-input", "reference-00123");
        await app.wait(
          `document.querySelectorAll('.asset-card').length===1&&document.querySelector('.card-name')?.textContent.includes('reference-00123')`,
        );
        const searchMs = Date.now() - app.lastActionAt;
        assert.ok(
          searchMs <= budgets.searchMs,
          `Search during previews: ${searchMs}ms`,
        );
        await app.wait(
          `(()=>{const x=${visibleImages};return x.cards===1&&x.loaded===1;})()`,
        );
        await app.evaluate(
          `window.__e2eCachedCard=document.querySelector('.asset-card');window.__e2eCachedImage=window.__e2eCachedCard.querySelector('img.thumbnail-loaded')`,
        );
        await app.wait(`${countPreviews}>${before}`, 5000);
        assert.equal(
          await app.evaluate(
            `document.querySelector('.asset-card')===window.__e2eCachedCard&&document.querySelector('.asset-card img.thumbnail-loaded')===window.__e2eCachedImage`,
          ),
          true,
          "Background arrivals replaced the unaffected cached card/image",
        );
        return { searchMs, before, after: await app.evaluate(countPreviews) };
      },
    );
    await scenario(
      "preview task pauses and resumes real processing",
      async () => {
        const id = "default:scan-previews:cold-root";
        assert.equal(
          await app.evaluate(
            `!!backgroundTasks.get(${JSON.stringify(id)})&&!backgroundTasks.get(${JSON.stringify(id)}).done`,
          ),
          true,
          "Preview work already finished; pause is untested",
        );
        await app.click("#right-panel-threads-tab");
        const button = `[data-thread-id="${id}"] [data-thread-toggle]`;
        await app.click(button);
        await app.wait(`backgroundTasks.get(${JSON.stringify(id)})?.paused`);
        await sleep(500); // Allow the two already-running local jobs to settle.
        const before = await app.evaluate(
          `backgroundTasks.get(${JSON.stringify(id)}).completed`,
        );
        await sleep(350);
        assert.equal(
          await app.evaluate(
            `backgroundTasks.get(${JSON.stringify(id)}).completed`,
          ),
          before,
          "Paused task kept starting previews",
        );
        await app.click(button);
        await app.wait(
          `!backgroundTasks.get(${JSON.stringify(id)})?.paused&&backgroundTasks.get(${JSON.stringify(id)})?.completed>${before}`,
        );
        return {
          pausedCompleted: before,
          resumedCompleted: await app.evaluate(
            `backgroundTasks.get(${JSON.stringify(id)}).completed`,
          ),
        };
      },
    );
    await scenario(
      "cold scan completes, previews are persisted, and scope is preserved",
      async () => {
        assert.ok(
          report.coldRequested,
          "Cold scan did not start; completion is untested",
        );
        await app.wait(
          `state.library.locations.find(l=>l.id==='cold-root')?.scanProgress?.done&&state.library.assets.filter(a=>a.locationId==='cold-root').length===${fixture.coldCount}`,
          90000,
        );
        await app.wait(
          `state.library.assets.filter(a=>a.locationId==='cold-root'&&a.thumbnailPath&&!a.thumbnailFailedAt).length===${fixture.coldCount}`,
          90000,
        );
        assert.equal(
          await app.evaluate(
            `state.library.assets.some(a=>a.locationId==='outside-root')`,
          ),
          false,
        );
        const ms = Date.now() - report.coldStartedAt;
        measure({ ms });
        const { DatabaseSync } = require("node:sqlite");
        let persisted = [];
        for (let i = 0; i < 80; i++) {
          const db = new DatabaseSync(
            path.join(fixture.profile, "library.db"),
            { readOnly: true },
          );
          try {
            persisted = db
              .prepare("SELECT payload FROM assets")
              .all()
              .map((row) => JSON.parse(row.payload))
              .filter((a) => a.locationId === "cold-root");
          } finally {
            db.close();
          }
          if (
            persisted.length === fixture.coldCount &&
            persisted.every((a) => a.thumbnailPath)
          )
            break;
          await sleep(50);
        }
        assert.equal(persisted.length, fixture.coldCount);
        assert.ok(
          persisted.every((a) => a.thumbnailPath),
          "Preview paths were not persisted",
        );
        for (let i = 0; i < persisted.length; i += 8)
          await Promise.all(
            persisted.slice(i, i + 8).map(async (asset) => {
              const stats = await sharp(asset.thumbnailPath, {
                limitInputPixels: 16000000,
              }).stats();
              assert.ok(
                stats.entropy > 1,
                "Blank or corrupt generated preview: " + asset.id,
              );
            }),
          );
        assert.ok(
          ms <= budgets.coldCompletionMs,
          `Cold completion ${ms}ms exceeds ${budgets.coldCompletionMs}ms`,
        );
        return {
          ms,
          indexed: fixture.coldCount,
          previewed: fixture.coldCount,
          persistedAndDecoded: persisted.length,
        };
      },
    );
    await scenario(
      "All Tags Alt+U replaces large asset sets without rebuilding unaffected rows",
      async () => {
        await app.fill("#search-input", "");
        await app.click('.library-nav [data-view="tags"]');
        await app.wait(
          `document.querySelectorAll('.tag-manager-item').length>=200`,
        );
        const sources = ["group-0", "group-1"],
          replacement = "group-merged-e2e",
          expected =
            Math.ceil(fixture.count / 31) + Math.ceil((fixture.count - 1) / 31);
        assert.equal(
          await app.evaluate(
            `state.library.assets.filter(a=>(a.tags||[]).some(t=>${JSON.stringify(sources)}.includes(t))).length`,
          ),
          expected,
        );
        await app.click('.tag-manager-item[data-tag="group-0"]');
        await app.click('.tag-manager-item[data-tag="group-1"]', {
          modifiers: process.platform === "darwin" ? 4 : 2,
        });
        await app.wait(
          `document.querySelectorAll('.tag-manager-item.selected').length===2`,
        );
        await app.evaluate(
          `window.__e2eUnaffectedTag=document.querySelector('.tag-manager-item[data-tag="group-2"]')`,
        );
        await app.key("u", "KeyU", 1);
        await app.wait(`document.querySelector('#text-entry-dialog').open`);
        await app.fill("#text-entry-input", replacement);
        await app.click(
          `#tag-autocomplete [data-tag-suggestion="${replacement}"]`,
        );
        await app.click("#confirm-text-entry");
        const start = app.lastActionAt;
        await app.wait(
          `document.querySelector('.tag-manager-item[data-tag="${replacement}"].selected')`,
        );
        const feedbackMs = Date.now() - start;
        measure({ feedbackMs, affected: expected });
        assert.ok(
          feedbackMs <= budgets.tagReplacementFeedbackMs,
          `Tag feedback ${feedbackMs}ms`,
        );
        await app.wait(
          `!pendingTagReplacement&&document.querySelector('.tag-manager-item[data-tag="${replacement}"] .tag-manager-count')?.textContent==='${expected}'`,
          10000,
        );
        const ms = Date.now() - start;
        measure({ ms });
        assert.ok(ms <= budgets.tagReplacementMs, `Tag replacement ${ms}ms`);
        assert.equal(
          await app.evaluate(
            `window.__e2eUnaffectedTag===document.querySelector('.tag-manager-item[data-tag="group-2"]')`,
          ),
          true,
        );
        assert.equal(
          await app.evaluate(
            `state.library.assets.every(a=>!(a.tags||[]).some(t=>${JSON.stringify(sources)}.includes(t)))`,
          ),
          true,
        );
        const { DatabaseSync } = require("node:sqlite");
        let persisted = 0,
          remaining = -1;
        for (let i = 0; i < 40; i++) {
          const db = new DatabaseSync(
            path.join(fixture.profile, "library.db"),
            { readOnly: true },
          );
          try {
            persisted = db
              .prepare(
                "SELECT COUNT(*) AS n FROM assets,json_each(json_extract(payload,'$.tags')) WHERE value=?",
              )
              .get(replacement).n;
            remaining = db
              .prepare(
                "SELECT COUNT(*) AS n FROM assets,json_each(json_extract(payload,'$.tags')) WHERE value IN (?,?)",
              )
              .get(...sources).n;
          } finally {
            db.close();
          }
          if (persisted === expected && remaining === 0) break;
          await sleep(50);
        }
        assert.equal(persisted, expected);
        assert.equal(remaining, 0);
        return { feedbackMs, ms, affected: expected, persisted };
      },
    );
    await scenario("no unexpected application errors", async () => {
      assert.deepEqual(app.errors, []);
      const entries = (
        await fs.readFile(
          path.join(fixture.profile, "diagnostics.jsonl"),
          "utf8",
        )
      )
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(JSON.parse)
        .filter((e) => e.level === "error");
      report.knownWarnings = entries.filter((e) =>
        /^\(node:\d+\) \[DEP0160\] DeprecationWarning: The multipleResolves event has been deprecated\.$/.test(
          e.message,
        ),
      );
      const unexpected = entries.filter(
        (e) => !report.knownWarnings.includes(e),
      );
      assert.deepEqual(unexpected, []);
      return {
        exceptions: 0,
        knownDeprecationWarnings: report.knownWarnings.length,
      };
    });
  } catch (error) {
    report.infrastructureError = error.stack;
    console.error(error);
  } finally {
    if (app) await app.close();
    report.finishedAt = new Date().toISOString();
    report.status =
      !report.infrastructureError &&
      report.cases.length > 0 &&
      report.cases.every((c) => c.status === "passed")
        ? "passed"
        : "failed";
    await save();
    console.log(
      `RESULT ${report.status}: ${path.join(reportDir, "results.json")}`,
    );
    process.exitCode = report.status === "passed" ? 0 : 1;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
