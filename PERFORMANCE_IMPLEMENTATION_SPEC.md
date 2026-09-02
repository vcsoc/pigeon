# Pigeon: Extreme Loading, Scrolling, and Thumbnail Performance

## Purpose

Make Pigeon feel immediate on large portfolios while preserving these product rules:

- The complete portfolio remains available in memory after it is loaded.
- No pagination, page controls, or reduced-result model.
- Search, filters, sort, duplicate views, and selection operate across the complete portfolio.
- The grid virtualizes rendered cards, not the data set.
- Original files remain untouched and Pigeon's reference-only library model remains unchanged.

This specification is limited to metadata loading, renderer delivery, grid scrolling, and thumbnail scheduling. It does not require a Rust or Go rewrite.

## Current state

### Already present

- Electron main process, renderer, and worker threads are separated.
- SQLite runs in a database worker; thumbnails use worker threads and native Sharp; video uses FFmpeg.
- The renderer retains the complete asset array and maintains an ID-to-index map.
- Large grids are virtualized. The renderer uses a 480-asset window and updates it from the scroll position.
- Thumbnail image loading is viewport-aware: it has a directional read-ahead range, cancels out-of-range loads, and caps concurrent image loads at 16.
- Cooperative filtering and sorting prevents long renderer blocking tasks.
- Scan persistence can write changed batches to SQLite.

### Problems to eliminate

1. `broadcast()` sends the complete visible library in batches of 500 with a 20 ms delay. A 500,000 asset library therefore has an approximately 20-second artificial stream floor before completion.
2. The renderer clears its asset array and waits for the final stream batch before its normal complete render. The first useful grid must not wait for that.
3. The library is repeatedly copied and serialized across the library worker, main process, database worker, and renderer. Normal edits commonly trigger a whole-library save.
4. `warmThumbnailCache()` queues every missing thumbnail. It does not prioritize visible assets or the user’s likely scroll direction.
5. Filter/sort recomputes from the complete array. It is responsive, but lacks reusable indexes for common lookups.

## Product outcomes

### User-visible behavior

- Opening an existing portfolio shows its shell and first viewport as soon as the first asset metadata chunk is available.
- The first visible assets receive thumbnail-generation priority. Assets just ahead of the user’s scroll direction are next. The remaining library is generated only while idle.
- Fast scrolling never causes unbounded thumbnail requests or DOM growth.
- Search and filters are global from the moment their necessary metadata is present; UI must clearly indicate if a startup stream is still completing.
- A metadata edit to one asset must persist and update the renderer without reserializing, sending, or saving unrelated assets.
- The app remains responsive while thumbnails, hashes, or scans run in the background.

### Performance targets

Targets are measured on release builds, with a warm OS cache and separately with a cold cache. Record the machine, storage type, portfolio size, asset mix, and RAM.

| Scenario | Target |
|---|---:|
| Existing 10k-asset portfolio: shell visible | <= 500 ms |
| Existing 10k-asset portfolio: first usable grid | <= 1 s |
| Existing 50k-asset portfolio: first usable grid | <= 2 s |
| Existing 100k-asset portfolio: first usable grid | <= 3 s |
| Continuous scrolling on 100k assets | no long task over 50 ms; sustained 55+ FPS on target hardware |
| Visible thumbnail request after scroll settles | begins within 100 ms |
| Single metadata edit: renderer patch and queued persistence | <= 100 ms before storage latency |
| Full stream completion | no intentional fixed per-batch delay |

These are acceptance targets, not a reason to fake completion. Record measured results and explain any missed target.

## Design

### 1. Split the library model from asset transport

`library:changed` must carry only the small library shell: portfolio ID, locations, collections, smart folders, settings, totals, stream state, and a generation ID. It must not include an `assets` array.

Deliver asset metadata through a dedicated transport that:

- starts immediately after the shell event;
- uses compact public asset records only;
- has no fixed `setTimeout` throttle between batches;
- yields using backpressure, `setImmediate`, or a renderer acknowledgement when needed;
- permits the renderer to render its first viewport after the first useful chunk;
- emits an explicit completion event;
- rejects stale generations after a portfolio change.

Keep asset batch size configurable and benchmark it. Start with 1,000 to 2,000 records; do not hard-code a result without measurement.

The renderer must append each chunk to `state.library.assets` and maintain `rendererAssetIndexes` incrementally. It must not reset the grid after each chunk. The first render should happen after a small initial threshold sufficient to fill the viewport, then update using idle/rAF scheduling as chunks arrive.

### 2. Preserve full-library semantics without pagination

The renderer may hold all asset metadata after streaming completes. It must continue to use the existing virtual grid so the DOM contains only a bounded window of cards.

- Retain the complete data array and ID map.
- Retain virtual windowing for normal grid, masonry, and list modes.
- Keep the selected asset and scroll anchor stable during virtual-window swaps.
- Do not add page controls, cursors, result caps, or a reduced global search scope.
- Do not load original media files during metadata startup.

### 3. Make thumbnail generation viewport-priority driven

Separate **thumbnail generation** from the existing **thumbnail image loading** behavior.

The renderer already knows the visible asset IDs and scroll direction. Add a narrowly scoped, debounced IPC request that sends a priority list of asset IDs:

1. currently visible cards;
2. cards within the current directional read-ahead range;
3. cards shortly behind the viewport;
4. selected asset, inspector asset, and viewer neighbors as explicit high priorities.

Main-process requirements:

- Deduplicate jobs by asset ID and source version (`modified`).
- Cancel or demote queued jobs that leave the priority range; do not cancel an already-running Sharp or FFmpeg job unless the implementation can do so safely.
- Reserve at least one worker slot for interactive priority work whenever background warming is active.
- Keep background full-library warming, but run it only after the priority queue is empty and the user has been idle for a short, configurable period.
- Preserve existing CPU, memory, timeout, retry, and telemetry safety limits.
- Patch only the changed asset when a thumbnail is ready.

The scheduling policy should live in one testable module, not be distributed across renderer event handlers and `warmThumbnailCache()`.

### 4. Replace full-library saves for normal asset edits

Introduce explicit database-worker commands for changed rows:

- `upsert-assets` for one or many changed assets;
- `delete-assets` where appropriate;
- `save-library-metadata` for settings/collections/smart folders/locations;
- retain full snapshot save only for migration, import, recovery, or an intentionally requested complete rewrite.

Normal edit flows—tagging, rating, favorites, notes, annotations, rotation, thumbnail completion, and asset patches—must enqueue changed assets only. Coalesce repeated edits to the same asset before writing.

Maintain transactional SQLite writes and WAL behavior. The main process remains the source of truth while writes are pending. Failed writes must surface a diagnostic and preserve retry-safe state.

### 5. Add reusable in-memory indexes

Do not replace the full asset array. Add derived, rebuildable indexes alongside it:

- lowercase normalized filename/path token index for text search;
- sets or maps for kind, location ID, collection ID, tag, rating, favorite, deleted state, and source state;
- precomputed sortable keys for common orders;
- a cache keyed by complete view/filter/sort state, invalidated only by relevant changes.

Build or update indexes cooperatively, in a worker when measurement proves the renderer path is costly. Preserve correct results while an index is building: either use the current cooperative fallback or display a truthful short indexing state.

Do not attempt native Rust/Go search indexing in this phase.

### 6. Instrument before and after

Add structured spans and expose them through the existing diagnostics/telemetry surface:

- SQLite open/load;
- library worker read and migration;
- worker-to-main transfer;
- first metadata chunk sent/received;
- first grid render and first painted card;
- stream completion;
- renderer long tasks and frame timing while scrolling;
- thumbnail queue wait, generation duration, and ready-to-paint duration;
- database queue wait, changed-record count, serialization time, and transaction duration;
- filter/sort time and cache hit/miss.

Every span needs portfolio size and a non-sensitive aggregate asset mix, not file paths.

## Implementation plan

1. Add benchmark fixtures and instrumentation first. Establish baseline reports for 10k, 50k, and 100k synthetic libraries, plus one real representative library if available.
2. Refactor library shell and asset stream transport. Remove the fixed 20 ms stream delay; support first-viewport render before stream completion; preserve generation cancellation.
3. Verify virtual grid stability under streamed additions, filter changes, selection, grid/list/masonry layouts, and rapid scrolling.
4. Add the thumbnail priority scheduler and route viewport/selection signals into it. Convert full-cache warming into an idle fallback.
5. Add delta database operations and migrate ordinary edit and thumbnail-completion paths away from full snapshot saves.
6. Add and use derived indexes only where telemetry identifies filter/sort cost.
7. Measure again, tune batch size, worker allocation, read-ahead distance, and idle policy. Do not change the no-pagination requirement.

## Files expected to change

- `electron/main.js`: library shell/asset stream, thumbnail scheduling, database dispatch, telemetry hooks.
- `electron/preload.js`: narrowly scoped APIs/events for stream status and thumbnail-priority requests.
- `electron/database-worker.js` and `electron/database.js`: delta write commands and transactional persistence.
- `electron/library-worker.js`: compact or staged loading support if required by benchmarks.
- `electron/thumbnail-worker.js`: only if job priority or job-result payload requires it.
- `src/renderer.js`: incremental stream rendering, virtual-grid stability, viewport priority messages, indexes, and instrumentation.
- New focused modules/tests are preferred for scheduling and asset indexes.

## Tests and verification

Automated tests must cover:

- stale stream generations cannot alter the active portfolio;
- the first asset chunk can render a usable grid before final stream completion;
- no fixed time-based gap is required between asset batches;
- renderer asset IDs and indexes remain correct after chunked startup, scan additions, and patches;
- virtual grid keeps its bounded-card behavior at 6k, 50k, and 100k fixtures;
- thumbnail priority order favors visible, ahead, and selected assets over idle warming;
- queue deduplication and source-version invalidation work;
- normal single-asset edits issue delta persistence rather than full-library serialization;
- database failure handling retains in-memory correctness and produces a diagnostic;
- existing scan, thumbnail, portfolio switching, offline-source, and smoke behaviors remain intact.

Manual verification must include cold and warm startup, rapid mouse-wheel and trackpad scrolling, switching portfolios during a stream, searching while streaming, scrolling while thumbnails are generating, and a low-memory test.

## Non-goals

- Pagination or limiting the library to a subset of results.
- A full Rust or Go rewrite.
- Changing Pigeon into an asset-importing or source-file-mutating product.
- Removing CPU/memory guardrails just to inflate benchmark numbers.
- Replacing Sharp, FFmpeg, SQLite, or Node crypto without measured evidence.

## Conditional future native work

After this specification is complete and measured, consider a narrow Rust N-API addon only if exact all-library visual similarity remains a demonstrated hotspot. It must consume packed metadata, avoid unnecessary copying, and be compared against an optimized JavaScript candidate-reduction algorithm. Go is not recommended for that boundary.
