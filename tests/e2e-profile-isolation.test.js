const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { launch } = require("../scripts/e2e/driver.cjs");

test("E2E driver refuses an ordinary profile before launching Electron", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "pigeon-profile-safety-"),
  );
  try {
    await fs.writeFile(
      path.join(root, "library.json"),
      "user data must remain untouched",
    );
    await assert.rejects(launch(root, root), /ENOENT/);
    assert.equal(
      await fs.readFile(path.join(root, "library.json"), "utf8"),
      "user data must remain untouched",
    );
    assert.deepEqual(await fs.readdir(root), ["library.json"]);
    await fs.writeFile(
      path.join(root, ".pigeon-e2e-profile"),
      "not a test profile",
    );
    await assert.rejects(launch(root, root), /Not an isolated E2E profile/);
    assert.equal((await fs.readdir(root)).includes("electron.log"), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
