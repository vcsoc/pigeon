const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require.resolve("../src/renderer.js"), "utf8");
function setup({ permissionDenied = false } = {}) {
  let handler;
  const opened = [],
    retried = [];
  vm.runInNewContext(
    source
      .split("\n")
      .find((line) =>
        line.startsWith("elements.grid.addEventListener('keydown'"),
      ),
    {
      elements: { grid: { addEventListener: (_name, fn) => (handler = fn) } },
      assetById: () => ({ id: "asset", permissionDenied }),
      openInternalViewer: (id) => opened.push(id),
      rebuildThumbnailsWithPermission: async (ids) => {
        retried.push(...ids);
        return {};
      },
      showToast: () => {},
    },
  );
  return { handler, opened, retried };
}
function event(extra = {}) {
  return {
    key: "Enter",
    target: {
      closest: (selector) =>
        selector === ".asset-card" ? { dataset: { assetId: "asset" } } : null,
    },
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
    ...extra,
  };
}
test("grid Enter opens once and cannot bubble into the new viewer controls", () => {
  const app = setup(),
    e = event();
  app.handler(e);
  assert.deepEqual(app.opened, ["asset"]);
  assert.equal(e.prevented, true);
  assert.equal(e.stopped, true);
});
test("modified Enter remains available to external open/reveal shortcuts", () => {
  for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) {
    const app = setup(),
      e = event({ [modifier]: true });
    app.handler(e);
    assert.deepEqual(app.opened, []);
    assert.equal(e.stopped, undefined);
  }
});
test("buttons inside cards retain their own Enter activation", () => {
  const app = setup(),
    e = event({
      target: {
        closest: (selector) =>
          selector === ".asset-card" ? { dataset: { assetId: "asset" } } : {},
      },
    });
  app.handler(e);
  assert.deepEqual(app.opened, []);
});
test("permission retry owns Enter without opening before authorization completes", async () => {
  const app = setup({ permissionDenied: true }),
    e = event();
  app.handler(e);
  assert.equal(e.stopped, true);
  assert.deepEqual(app.retried, ["asset"]);
  assert.deepEqual(app.opened, []);
  await Promise.resolve();
  assert.deepEqual(app.opened, ["asset"]);
});
