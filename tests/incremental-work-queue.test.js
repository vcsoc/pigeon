const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createIncrementalWorkQueue,
} = require("../electron/incremental-work-queue");
test("starts previews before discovery closes and accepts later batches with one worker", async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve)),
    started = [],
    progress = [];
  const queue = createIncrementalWorkQueue({
    processItem: async (item) => {
      started.push(item.id);
      if (item.id === "a") await gate;
    },
    onProgress: (p) => progress.push(p),
  });
  queue.add([{ id: "a", version: 1 }]);
  assert.deepEqual(started, ["a"]);
  queue.add([
    { id: "b", version: 1 },
    { id: "a", version: 1 },
  ]);
  assert.deepEqual(started, ["a"]);
  const done = queue.close();
  release();
  await done;
  assert.deepEqual(started, ["a", "b"]);
  assert.deepEqual(progress.at(-1), { completed: 2, total: 2, done: true });
  assert.equal(queue.has("a", 1), true);
});
test("cancellation skips pending work and closes cleanly", async () => {
  let active = true,
    release;
  const gate = new Promise((resolve) => (release = resolve)),
    started = [];
  const queue = createIncrementalWorkQueue({
    isActive: () => active,
    processItem: async (item) => {
      started.push(item.id);
      await gate;
    },
  });
  queue.add([
    { id: "a", version: 1 },
    { id: "b", version: 1 },
  ]);
  active = false;
  const done = queue.close();
  release();
  await done;
  assert.deepEqual(started, ["a"]);
});
test("individual failures do not block subsequent previews", async () => {
  const errors = [],
    started = [];
  const queue = createIncrementalWorkQueue({
    processItem: async (item) => {
      started.push(item.id);
      if (item.id === "a") throw Error("unreadable");
    },
    onError: (error) => errors.push(error.message),
  });
  queue.add([
    { id: "a", version: 1 },
    { id: "b", version: 1 },
  ]);
  await queue.close();
  assert.deepEqual(started, ["a", "b"]);
  assert.deepEqual(errors, ["unreadable"]);
});
test("two bounded workers overlap and close waits for both", async () => {
  const releases = new Map(),
    started = [];
  let active = 0,
    peak = 0;
  const queue = createIncrementalWorkQueue({
    maxConcurrency: 2,
    processItem: async (item) => {
      started.push(item.id);
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => releases.set(item.id, resolve));
      active--;
    },
  });
  queue.add(["a", "b", "c"].map((id) => ({ id, version: 1 })));
  assert.deepEqual(started, ["a", "b"]);
  let closed = false;
  const done = queue.close().then(() => (closed = true));
  releases.get("a")();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ["a", "b", "c"]);
  releases.get("c")();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(closed, false);
  releases.get("b")();
  await done;
  assert.equal(peak, 2);
});
test("versions of the same asset serialize while other assets can proceed", async () => {
  let release;
  const started = [],
    gate = new Promise((resolve) => (release = resolve));
  const queue = createIncrementalWorkQueue({
    maxConcurrency: 2,
    processItem: async (item) => {
      started.push(item.id + item.version);
      if (item.id === "a" && item.version === 1) await gate;
    },
  });
  queue.add([
    { id: "a", version: 1 },
    { id: "a", version: 2 },
    { id: "b", version: 1 },
    { id: "a", version: 2 },
  ]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ["a1", "b1"]);
  release();
  await queue.close();
  assert.deepEqual(started, ["a1", "b1", "a2"]);
});
test("parallel cancellation drains in-flight work without starting pending jobs", async () => {
  let active = true,
    release;
  const gate = new Promise((resolve) => (release = resolve)),
    started = [];
  const queue = createIncrementalWorkQueue({
    maxConcurrency: 2,
    isActive: () => active,
    processItem: async (item) => {
      started.push(item.id);
      await gate;
    },
  });
  queue.add(["a", "b", "c", "d"].map((id) => ({ id, version: 1 })));
  active = false;
  const done = queue.close();
  release();
  await done;
  assert.deepEqual(started, ["a", "b"]);
});
test("synchronous processor failures cannot recurse or strand close", async () => {
  let errors = 0;
  const queue = createIncrementalWorkQueue({
    maxConcurrency: 2,
    processItem: () => {
      throw Error("failure");
    },
    onError: () => errors++,
  });
  queue.add(Array.from({ length: 2000 }, (_, id) => ({ id, version: 1 })));
  await queue.close();
  assert.equal(errors, 2000);
});
test("scan waves feed the preview queue without awaiting generation", () => {
  const fs = require("node:fs"),
    path = require("node:path"),
    main = fs.readFileSync(path.join(__dirname, "../electron/main.js"), "utf8");
  assert.match(
    main,
    /broadcastScanAssets\(location,waveAssets\);previewQueue.add\(waveAssets\)/,
  );
  assert.match(main, /!previewQueue.has\(asset\)/);
  assert.match(main, /progressId:job.progressId\|\|/);
});
