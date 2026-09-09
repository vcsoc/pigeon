# Local regression findings — 2026-09-08

The original measurements below use synthetic populated libraries. The follow-up section also records an actual SMB subtree run. Timing targets were not relaxed to obtain passing results.

## Confirmed fixes

- Grid Enter bubbled into the document's newly opened viewer controls, immediately pausing multi-playback or closing a single viewer. The grid now owns unmodified Enter; modified shortcuts and embedded controls retain their own handling.
- Scan previews were fed serially despite a two-worker pool. The producer now permits two jobs, serializes versions of the same asset, and waits for active jobs on close/cancellation.
- Duplicate membership maintenance revisited an entire hash group on every insertion/update. A renderer CPU profile attributed 4.86s to that path in the duplicate-heavy 40k fixture. Updates are now constant-time, including the singleton-to-duplicate transition. Deterministic operation-count and oracle tests cover this.

## Observed results

Latest 40,002-reference headless run: `/tmp/pigeon-e2e-C2TQRd/report/results.json`.

| Case | Observation | Result |
|---|---:|---|
| Populated startup | 5,946ms; previous equivalent fixture 10,701ms | **FAIL**, target 3,000ms |
| Scroll frames | p95 33.3ms; worst 116.7ms | Pass |
| Search | 195ms | Pass |
| Selection | 44ms | Pass |
| Single-image viewer | Native Enter opens; Escape closes | Pass |
| Multi-playback | Two decoded, visibly changing videos; mute retained | Pass |
| Cold rescan acknowledgement | 116ms | Pass |
| First visible cold thumbnail | 445ms, indexing still 49/240 | Pass |
| Magnifier | 334ms; scroll dismissal works | Pass |
| Search during preview generation | 227ms; cached card/image retained | Pass |
| Preview pause/resume | Settled pause, then processing advances | Pass |
| Cold completion | 13,948ms; all 240 previews persisted and decoded | Pass |
| Alt+U | 73ms feedback; 360ms completion; 2,582 changes verified in SQLite | Pass |

The error check also passed, retaining one known DEP0160 warning separately. The suite overall is **FAILED**, not green: 12 of 13 cases passed.

The latest 10,002-reference run (`/tmp/pigeon-e2e-vcIkil/report/results.json`) started in 2,680ms and persisted 646 Alt+U changes in 188ms, but **failed scrolling's p95 target at 49.9ms**. This variability is not being omitted or called fixed.

`npm run check` and all **510 component tests** passed. The ordinary startup smoke completed. The broader `smoke:seeded` suite remains failed: after fixing its premature-backup setup, it reported unresolved assertions involving folder behavior, drops/tagging, navigation/viewer details, collections, settings and other workflows. These must be distinguished from test sequencing assumptions and individually reproduced; they are not waived as unrelated flakiness.

## Follow-up before stopping

- Actual SMB `data-download-2`: **500/500** thumbnails persisted and independently decoded; first visible at **2,341ms**, with indexing at **55/500**. Completion **205,009ms**, observed throughput **2.44 previews/sec**, zero preview failures. Cached local startup with SMB configured: **1,483ms**. Source OS cache was uncontrolled. Report: `/tmp/pigeon-e2e-network-vB08JP/report/network-results.json`. This does not certify reconnect/cancellation or other network folders.
- Latest 40,002-reference run: `/tmp/pigeon-e2e-lUs4V2/report/results.json`. Startup **4,385ms — FAIL** against 3,000ms. Scroll p95 **16.7ms**, worst **16.8ms**, 120 mounted cards; a single passing run does not establish stability. All other cases passed. This run used experimental `PIGEON_ASSET_BATCH_SIZE=4000`; the source default remains 1000.
- **514/514 component tests passed**. Added coverage for serialized stream compatibility/backpressure, per-frame thumbnail geometry reads, and intentional empty folder-worker termination without hiding actual worker errors.
- Full temporary-filesystem inode exhaustion interrupted one run before application launch. Only generated cached fixtures/thumbnails from three marked old E2E profiles were removed; reports and databases were retained, with cleanup manifests.
- Broader seeded-smoke failures remain unresolved. Follow-up source changes are **not installed, version-bumped, committed, pushed, or released**.

## Installation and limits (earlier targeted installation)

The Linux AppImage built successfully; the four changed runtime files in its archive were compared byte-for-byte with tested source. The previous installed archive was also compared: only the targeted runtime changes above and the smoke backup prerequisite differed. Those changes were locally installed and Pigeon restarted normally; hardware acceleration remains disabled.

Rollback: `~/.local/opt/pigeon/.realistic-fixes-PvKDvY/previous`.

No version bump, commit, push or release publication was performed. The accumulated working tree's graph analysis reports CRITICAL risk across 61 processes; its stale/incomplete coverage is not a clean safety certificate. The SMB follow-up above verifies one subtree's completion/observed throughput; broad feature regressions, network recovery, and signed cross-platform builds remain unverified. See [suite coverage and commands](realistic-testing.md).
