# Populated Electron regression tests

Run the application, not a DOM mock or an empty-library smoke test:

```sh
# Desktop session; do not move the pointer over the test window while it runs.
npm run test:e2e > /tmp/pigeon-e2e.log 2>&1 &

# Linux: real Electron renderer/I/O, isolated Ozone headless display, 1440×1000.
# This is NOT a Wayland, native-dialog, packaging, or hardware-acceleration test.
npm run test:e2e:headless > /tmp/pigeon-e2e.log 2>&1 &

# Larger library (run separately, not alongside builds or other benchmarks).
PIGEON_E2E_ASSETS=40000 npm run test:e2e:headless > /tmp/pigeon-e2e-large.log 2>&1 &
```

Add `-- --profile-startup` to the npm command to save a renderer `startup.cpuprofile` for DevTools. Profiling is recorded in the environment metadata; do not treat profiled timings as an unprofiled benchmark.

Inspect these background jobs with short checks. `REPORT` prints the artifact directory. `results.json` contains status, per-case results/timings, fixed budgets, source hashes, environment and explicit uncovered areas. Failures retain a screenshot and DOM/media/task snapshot. An interrupted report remains **running**, not passed. Any failed case produces exit code 1. There are no whole-test retries or budget overrides.

## Isolation and fixture limits

Each run creates `/tmp/pigeon-e2e-*/` (the platform temporary directory elsewhere), an actual SQLite portfolio, and a marked test profile. The bootstrap refuses an unmarked profile before loading Pigeon. It changes only environment paths/window dimensions, not application business logic. It never points to an existing user portfolio. Electron and its session caches use that profile; shutdown terminates only the test process.

Default data: 10,000 cached image references in 100 directories, 240 initially unindexed JPEGs in nested directories, an independent out-of-scope file, two real H.264 videos, tags, a collection, and a Smart Folder. JPEGs have patterned 1280–1392px content; source files are hard links to eight distinct encodings. This exercises real decoding, disk I/O, duplicate-heavy metadata and rendering, **not a representative sample of every media format**. Fixture creation is excluded from startup timing. Retained fixtures/results can be large; delete the printed temporary directory when no longer needed.

Mouse/keyboard operations go through Chromium input dispatch, with visibility/hit-target checks. Read-only renderer observations do not call render/filter/selection functions to manufacture the expected state. The mute-persistence test sets the video element's mute property, then uses real playback shortcuts; `--mute-audio` suppresses speaker output. Video validation compares changing pixels in screenshots of the video interior, not just advancing clocks.

## Current coverage

- Full populated startup, dismissed splash and decoded cached viewport.
- Real wheel scrolling, frame times, bounded card DOM and loaded visible previews.
- Search input response; selection latency.
- Single-image Enter/Escape; multi-video Enter/Space/Escape, changing rendered frames, preserved mute choice.
- Batch rating through inspector controls; Ctrl/Cmd+0 and typing 0 do not reset ratings; plain 0 resets both assets without replacing loaded images. SQLite must contain 5 **before** resetting to 0, then contain 0 afterward.
- Native folder context-menu rescan; prompt feedback; new decoded thumbnails and magnifier controls while indexing is genuinely incomplete.
- Magnifier appearance and dismissal on scroll.
- Cached search/card identity while the cold preview count increases.
- Actual preview-task pause/resume, including a settled interval with no additional completed work.
- All Tags Alt+U through the real dialog/suggestion picker: 646 affected assets at 10k / 2,582 at 40k, prompt optimistic feedback, unchanged unaffected row identity, and verified SQLite replacement. This does not certify thousands-tag catalogs.
- Exact cold-scan count and subtree isolation; all 240 persisted previews are decoded and checked against blank/corrupt output.
- Unexpected renderer exceptions and main-process diagnostic errors. The specific existing DEP0160 deprecation is retained separately, not presented as an application error.

Current targets: populated startup ≤3s; selection ≤150ms; search ≤500ms; scan acknowledgement ≤250ms; first local cold thumbnail ≤1s; magnifier ≤700ms (includes deliberate hover delay); scroll p95 ≤34ms / worst ≤150ms; tag replacement feedback ≤150ms / completion ≤2s; 240 cold previews ≤15s, including the pause test. These are regression targets, **not universal speed guarantees**, and failures are not downgraded to warnings. Input response measurements begin at dispatched input, excluding automation's locator/stability work.

## Not a complete release certificate

`npm test` still supplies component/security/file-format coverage. `npm run smoke:seeded` still supplies broader legacy workflow checks. Neither is replaced or silently skipped by this suite. The broad smoke suite currently has unresolved failures; its backup setup now waits, with a deadline, for indexing instead of assuming backup is allowed during a scan.

Real SMB/USB throughput, disconnect/reconnect, partial scan recovery, permission authorization, locked/encrypted portfolios, archive UI, organizing-group drags, generated-tag editing, thousands-tag catalog/autocomplete performance, Smart Folder live reconciliation, similarity quality, native file moves/dialogs, extensions, editors/plugins, typography combinations and cross-platform packaged builds still need dedicated end-to-end cases. Some have meaningful component tests; that does not establish their full UI workflow.

The duplicate-heavy fixture exposed quadratic `attachContent` maintenance: profiling attributed 4.86s of a 40k startup to repeatedly adding every existing group member. The index now changes existing membership only on the 1→2 transition. `tests/duplicate-index-complexity.test.js` caps actual membership additions at linear work for 40k insertions and 40k metadata patches and checks changes/removals against an independent oracle. This is separate from the Electron timing assertions.

Do not call the application fully verified because this suite passes. Do not use a local patterned-JPEG result as proof of SMB speed. Do not compare timings collected concurrently with unrelated builds/test suites against isolated runs. Do not claim a fix is installed or released merely because a source run passed.
