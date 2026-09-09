const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { createLibraryStore } = require("../../electron/database");
const core = require("../../electron/library-core");
async function createFixtures(root, { count = 10000, coldCount = 240, networkRoot = null } = {}) {
  const profile = path.join(root, "profile"),
    cached = path.join(root, "cached"),
    cold = path.join(root, "cold"),
    outside = path.join(root, "outside"),
    thumbs = path.join(profile, "thumbnails");
  for (const p of [profile, cached, cold, outside, thumbs])
    await fs.mkdir(p, { recursive: true });
  await fs.writeFile(
    path.join(profile, ".pigeon-e2e-profile"),
    "pigeon-e2e-v1\n",
  );
  const originals = [],
    previews = [];
  for (let n = 0; n < 8; n++) {
    const width = 1280 + n * 16,
      height = 720 + n * 24,
      pixels = Buffer.alloc(width * height * 3);
    for (let i = 0; i < pixels.length; i += 3) {
      const x = (i / 3) % width,
        y = Math.floor(i / 3 / width);
      pixels[i] = (x * 3 + y + n * 31) % 256;
      pixels[i + 1] = (x + y * 2 + n * 17) % 256;
      pixels[i + 2] = (x ^ y ^ (n * 47)) % 256;
    }
    const original = path.join(root, `original-${n}.jpg`),
      preview = path.join(root, `preview-${n}.jpg`);
    await sharp(pixels, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 85 })
      .toFile(original);
    await sharp(original)
      .resize(256, 256, { fit: "inside" })
      .jpeg({ quality: 65 })
      .toFile(preview);
    const stat = await fs.stat(original);
    originals.push({
      path: original,
      width,
      height,
      size: stat.size,
      hash: crypto
        .createHash("sha256")
        .update(await fs.readFile(original))
        .digest("hex"),
    });
    previews.push(preview);
  }
  const library = core.migrateLibrary({
    settings: {
      autoTag: false,
      indexingPolicyVersion: 2,
      preferences: {
        hardwareAcceleration: false,
        autoTagEnabled: false,
        lowResourceMode: true,
      },
    },
  });
  library.locations = [
    {
      id: "cached-root",
      name: "Cached library",
      path: cached,
      type: "folder",
      online: true,
      assetCount: count,
    },
    {
      id: "cold-root",
      name: "Cold scan",
      path: cold,
      type: "folder",
      online: true,
      assetCount: 0,
    },
    {
      id: "outside-root",
      name: "Outside scan scope",
      path: outside,
      type: "folder",
      online: true,
      assetCount: 0,
    },
  ];
  for (let i = 0; i < count; i++) {
    const fixture = originals[i % 8],
      id = crypto
        .createHash("sha1")
        .update(`cached-${i}`)
        .digest("hex")
        .slice(0, 16),
      filename = `reference-${String(i).padStart(5, "0")}.jpg`,
      source = path.join(
        cached,
        `section-${i % 20}`,
        `branch-${Math.floor(i / 20) % 5}`,
        filename,
      ),
      thumbnail = path.join(thumbs, id + ".jpg");
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.link(fixture.path, source);
    await fs.link(previews[i % 8], thumbnail);
    const stat = await fs.stat(source);
    library.assets.push({
      id,
      path: source,
      name: path.parse(filename).name,
      filename,
      extension: "JPG",
      kind: "image",
      locationId: "cached-root",
      size: fixture.size,
      width: fixture.width,
      height: fixture.height,
      modified: stat.mtimeMs,
      indexedAt: 1700000000000 + i,
      thumbnailPath: thumbnail,
      dominantColor: "#6688aa",
      histogram: [1],
      palette: ["#6688aa"],
      perceptualHash: "0123456789abcdef",
      technicalMetadata: { format: "jpeg" },
      contentHash: fixture.hash,
      tags: [`tag-${i % 200}`, `group-${i % 31}`],
      collectionIds: [],
      rating: 0,
      note: `reference note ${i}`,
      favorite: false,
      sourceMissing: false,
      sourcePending: false,
    });
  }
  for (let i = 0; i < coldCount; i++) {
    const folder = path.join(cold, `branch-${i % 8}`, `nested-${i % 3}`);
    await fs.mkdir(folder, { recursive: true });
    await fs.link(
      originals[i % 8].path,
      path.join(folder, `cold-${String(i).padStart(4, "0")}.jpg`),
    );
  }
  await fs.link(
    originals[0].path,
    path.join(outside, "must-not-be-scanned.jpg"),
  );
  const group = core.createCollection(library, "Fixture collection");
  for (const asset of library.assets.slice(0, 20))
    asset.collectionIds = [group.id];
  core.createSmartFolder(library, "Fixture smart folder", { tags: ["tag-1"] });
  const media = path.join(root, "media");
  await fs.mkdir(media);
  const video = path.join(media, "video-a.mp4");
  require("node:child_process").execFileSync(
    require("ffmpeg-static"),
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=320x180:rate=12",
      "-t",
      "3",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-y",
      video,
    ],
    { timeout: 15000 },
  );
  await fs.link(video, path.join(media, "video-b.mp4"));
  library.locations.push({
    id: "media-root",
    name: "Media controls",
    path: media,
    type: "folder",
    online: true,
    assetCount: 2,
  });
  for (let n = 0; n < 2; n++) {
    const source = path.join(media, `video-${n ? "b" : "a"}.mp4`),
      stat = await fs.stat(source);
    library.assets.push({
      id: `video0000000000${n}`,
      path: source,
      name: `Video ${n}`,
      filename: path.basename(source),
      kind: "video",
      extension: "MP4",
      locationId: "media-root",
      width: 320,
      height: 180,
      duration: 3,
      size: stat.size,
      modified: stat.mtimeMs,
      indexedAt: 1700000100000 + n,
      thumbnailPath: previews[0],
      contentHash: "video-fixture",
      tags: [],
      collectionIds: [],
      sourceMissing: false,
      sourcePending: false,
    });
  }
  if(networkRoot)library.locations.push({id:'network-root',name:'SMB verification',path:path.resolve(networkRoot),type:'folder',online:true,assetCount:0});
  const store = createLibraryStore(path.join(profile, "library.db"));
  store.save(library);
  store.close();
  await fs.writeFile(
    path.join(profile, "runtime-preferences.json"),
    JSON.stringify({ hardwareAcceleration: false, autoImportEnabled: false }),
  );
  return {
    profile,
    cached,
    cold,
    outside,
    count,
    total: library.assets.length,
    coldCount,
    firstId: library.assets[0].id,
    collectionId: group.id,
  };
}
module.exports = { createFixtures };
