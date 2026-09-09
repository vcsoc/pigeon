const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../src/asset-indexes");

test("40k duplicate-heavy insertions and metadata patches use linear membership work", () => {
  const indexes = create(),
    count = 40000,
    duplicateIds = indexes.snapshot().duplicateIds;
  const originalAdd = duplicateIds.add;
  let additions = 0;
  duplicateIds.add = function (id) {
    assert.ok(
      ++additions <= count * 2,
      "Duplicate membership maintenance became superlinear",
    );
    return originalAdd.call(this, id);
  };
  for (let i = 0; i < count; i++)
    indexes.upsert({
      id: String(i),
      contentHash: `hash-${i % 8}`,
      tags: ["before"],
    });
  assert.equal(duplicateIds.size, count);
  assert.equal(additions, count);
  for (let i = 0; i < count; i++)
    indexes.upsert({
      id: String(i),
      contentHash: `hash-${i % 8}`,
      tags: ["after"],
    });
  assert.equal(additions, count * 2);
  assert.equal(duplicateIds.size, count);
  assert.equal(indexes.duplicateGroups().length, 8);
  for (let i = 0; i < count; i++) indexes.remove(String(i));
  assert.equal(duplicateIds.size, 0);
  assert.equal(indexes.snapshot().duplicateHashes.size, 0);
});

test("duplicate memberships match a recomputed oracle across inserts, edits and removals", () => {
  const indexes = create(),
    records = new Map();
  let seed = 913;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  for (let step = 0; step < 1000; step++) {
    const id = String(random() % 70);
    if (random() % 5 === 0) {
      indexes.remove(id);
      records.delete(id);
    } else {
      const asset = {
        id,
        contentHash: random() % 7 ? `hash-${random() % 8}` : "",
        tags: [String(step)],
      };
      records.set(id, asset);
      indexes.upsert(asset);
    }
    const groups = new Map();
    for (const asset of records.values())
      if (asset.contentHash) {
        if (!groups.has(asset.contentHash)) groups.set(asset.contentHash, []);
        groups.get(asset.contentHash).push(asset.id);
      }
    const expected = new Set(
      [...groups.values()].filter((ids) => ids.length > 1).flat(),
    );
    assert.deepEqual(new Set(indexes.snapshot().duplicateIds), expected);
    assert.deepEqual(
      new Set(indexes.snapshot().duplicateHashes),
      new Set(
        [...groups].filter(([, ids]) => ids.length > 1).map(([hash]) => hash),
      ),
    );
  }
});
