# Pigeon performance implementation report

Status: targeted first-grid/loading-gate replacement built and automated verification complete; manual large-library acceptance pending (2026-08-18)

## Manual rejection and targeted first-grid repair

The first startup-hang replacement was rejected by the representative 41,293-asset manual test because the application remained on “Still loading.” Its diagnostics proved the transport itself completed: worker transfer 2,588 ms, SQLite load/migrate 1,048 ms, first-batch frame acknowledgement 48.5 ms, all 83 batches streamed in 1,607 ms, and folder projection completed in 11 ms. No `first-grid-paint` or `first-usable-viewport` span was emitted.

The completion span contained 2,616 renderer assets because locked content is intentionally excluded from the renderer while the portfolio total remains 41,293. The permanent overlay was a renderer gate: it waited for 120 accessible assets, restored saved filtered navigation before committing the first grid, and only dismissed the splash for a nonempty filtered view. A legitimate empty or locked saved scope could therefore retain the splash after stream completion.

The targeted replacement now:

- commits the default grid from the first nonempty accessible metadata batch;
- defers saved navigation restoration until the background stream completes;
- dismisses the startup splash after the completion render even when the restored scope is legitimately empty or locked;
- retains generation rejection, full accessible-library in-memory state, global search, virtualization, and all CPU/memory safeguards.

The rejected run sent 12 accessible assets in its first source batch. It did not trigger its first renderer attempt until 532 ms after that batch was sent because the old 120-asset gate had to accumulate 277 accessible assets. The replacement requests a grid commit from those first 12 assets. This is a path-based inference, not a claimed replacement-build timing; the next manual run's persisted `first-grid-paint`, `first-usable-viewport`, and `renderer:long-task` spans are required for the authoritative measurement.

Replacement private Windows x64 portable: `release/Pigeon-First-Grid-Fix-Test-2026-08-18-x64-portable.exe` (132,120,919 bytes; SHA-256 `084A887E300F494C35CB1F41B1999B40ABBF0A7B0232B806E94BE0690B5BA103`). It is not an installer and was not published. Syntax checks, the focused 8-test startup gate, and the full 192-test suite pass; Electron Builder verified 10 critical packaged files.

## Delivered

- [x] Library shell is transported separately from assets. `library:changed` contains metadata and totals only.
- [x] Asset transport uses 500-source-record slices (configurable and bounded 500–4,000), renderer frame acknowledgement, explicit completion, and generation rejection. The former fixed 20 ms inter-batch delay and unbounded producer are gone.
- [x] The renderer paints the first usable chunk before stream completion and retains the complete asset array in memory.
- [x] Grid, list, and justified/masonry layouts share a bounded 480-card virtual DOM window; there is no pagination, result cap, page control, or reduced search scope.
- [x] Streamed additions, scans, patches, portfolio changes, selection, search, and scroll position update the same full-library state and derived indexes.
- [x] A testable thumbnail scheduler prioritizes selected, visible, ahead-of-scroll, and behind-scroll assets; deduplicates by asset/version; discards stale queued work; reserves interactive capacity; and lazily warms the full library only after idle time.
- [x] Active scrolling or selection suppresses additional idle warming. Existing CPU, memory, thread, PDF-worker, and scan guardrails remain in force.
- [x] Renderer thumbnail loading remains bounded at 16 concurrent image decodes. Main-to-renderer metadata patch bursts remain coalesced at no more than 250 records per 16 ms drain.
- [x] Normal persistence uses coalesced `upsert-assets`, `delete-assets`, and `save-library-metadata` actions. Full snapshots remain only for migration/import/recovery-style operations.
- [x] Search text, facet memberships, and sort values are maintained as derived in-memory indexes while the source asset array remains authoritative.
- [x] Structured, path-free timings cover SQLite open/load, worker transfer, first chunk, stream completion, first grid/usable paint, long tasks, scroll frames, thumbnail queue/generation/paint, database queue/serialization/transaction, and filter/sort cache behavior.
- [x] Startup sends a lightweight renderer projection for every asset while retaining filename, path, note, tags, collections, hashes, and other global search/grid fields. Large EXIF, technical metadata, histogram, and palette objects are fetched only for the selected inspector item and held in a 12-entry cache.
- [x] SQLite library reads iterate rows rather than retaining all JSON strings beside all parsed objects. The main process adopts the worker's migrated library without a second full migration/clone.
- [x] Sidebar totals, tag catalogs, collection counts, duplicate groups, and offline counts are maintained incrementally. Smart-folder counts, folder-tree projection, and collection auto-tag reconciliation run in bounded cooperative slices after the first usable viewport.

## Reopened startup-hang diagnosis

The reported portable build recorded the first unresponsive-window event about 62 seconds after startup diagnostics began and another about 16 seconds later. Older runs also recorded database-worker out-of-memory failures. The missing update metadata message was unrelated.

The root cause was cumulative JavaScript work and memory amplification, not thumbnail codec throughput alone:

- The worker parsed the full asset JSON, transferred the complete object graph, and main migrated/cloned it again.
- Main constructed complete visible-asset arrays and streamed without renderer acknowledgement.
- Every renderer chunk could restart rendering and rescan all assets for tags, sidebar counts, smart folders, duplicate groups, and folder/tag prewarming. This made startup effectively superlinear for a large library and prevented the window from servicing frames.
- Heavy EXIF, technical metadata, histogram, and palette data was duplicated into the renderer even though the grid and global search did not need it.

The representative read-only portfolio contains 41,293 assets (39,739 images), a 135.4 MiB database, and 81.6 MiB of aggregate asset JSON. The pre-fix store load/parse took 912 ms after a 312 ms open; an additional structured clone took 806 ms and the Node heap reached about 467 MiB. Those measurements explain why earlier compact synthetic benchmarks understated the real startup cost.

## Verification evidence

- Syntax gate: `npm run check` passes.
- Full automated suite: 191/191 tests pass in 2.06 seconds.
- Focused performance contracts: shell/transport separation, no fixed stream delay, stale-generation rejection, pre-completion rendering, full-library retention, virtual-window bounds at 6k/50k/100k, delta persistence, safe instrumentation, priority ordering, deduplication, reserved capacity, and interaction-paused idle warming all pass.
- The representative 41,293-asset startup projection/index test completed in 510.6 ms across 83 yielded 500-record batches. Its largest measured synchronous slice was 12.5 ms, below one 60 Hz frame budget on this machine.
- The regression contracts verify that intermediate stream chunks do not trigger repeated full renders, sidebar/tag work does not rescan the library, folder projection yields, batches are acknowledged after a renderer frame, and all global-search fields remain present in the lightweight projection.
- Private Windows x64 **portable** regression test build: `release/Pigeon-Startup-Hang-Fix-Test-2026-08-18-x64-portable.exe` (132,112,596 bytes; SHA-256 `0466B3242D540CB87A13A7F9E2ABF61650EDFBD6606F8FA05A1A46E207B4612F`). Electron Builder verified 10 critical packaged files. The artifact was not published and is not an installer.

## Interaction-stall acceptance

Idle thumbnail generation is intentionally limited to one background slot when two workers are available. A viewport/selection request can therefore start immediately in the reserved slot. New idle jobs cannot start until the configured idle interval has elapsed after the latest interaction. Expensive image decoding remains in worker threads; video/PDF work remains isolated in child/utility processes. The scheduler and source-level patch-burst contract are covered by automated tests.

The first large-library smoke attempt exposed recursive diagnostics during renderer teardown. Diagnostic IPC is now gated by renderer lifecycle and guarded against disposed frames. Follow-up GUI smoke attempts were stopped by this host's Electron GPU helper exiting with Windows status `0xc0000135`; the app did not reach the renderer smoke assertions. This is recorded as a host/runtime limitation rather than a passing smoke result. The full source-level interaction contracts and 191-test suite pass, but this new portable build still requires manual confirmation against the representative portfolio.

## Measurement limits

The pre-fix build did not persist its in-memory performance spans before the hang, so no defensible end-to-end before/after startup percentage is claimed. The new build persists path-free startup phase durations, batch acknowledgement waits, process memory, and recent spans with any future unresponsive-window event. DOM paint and real thumbnail-generation latency still depend on media mix, storage, codecs, and GPU/driver state; manual testing and the new diagnostics are the authoritative validation for the representative portfolio.

## Combined Smart Folder, thumbnail-order, and virtual-scroll regression release

The combined 2026-08-18 test build adds three user-visible correctness repairs without changing full-library or no-pagination behavior:

- Nested Smart Folders now evaluate the logical AND of every live ancestor predicate plus the child's local predicate. Only local rules are persisted or editable; inherited rules are displayed read-only. The same resolver drives direct filtering, cooperative filtering, counts, export, restoration, and live parent-edit invalidation. Missing parents retain the surviving local chain; cycles fail closed.
- Large-folder cooperative previews now use the exact globally sorted final prefix rather than a provisionally sorted source slice. Final completion reuses keyed cards from the preview, so unchanged visible asset IDs do not restart thumbnail decoding or visibly reorder.
- Virtual scrolling now uses a stable full-height surface with a translated bounded live-card window. The final aligned window always includes the last asset, and the extent does not collapse when moving bottom to top and back in grid, list, or justified layouts. Saved-position restoration is view/generation scoped, writes at most once, and is cancelled immediately by wheel, touch, pointer, or scrolling-key input. Thumbnail patches, final-sort completion, selection follow-up timers, and mutation completion cannot reapply a stale bottom position after the user scrolls upward.

Verification after these repairs: syntax checks pass; focused performance/feature checks pass 139/139; the full suite passes 208/208. The representative 41,293-asset projection benchmark processed 83 yielded batches and measured a 24.0 ms largest synchronous slice on this run. That benchmark is a contract/scheduling signal, not a substitute for manual acceptance on the user's media and hardware.

Main-project integration: the complete change set was three-way merged onto the newer 0.2.7 project while retaining its cooperative-task error isolation, priority scheduling, and yielded aggregate caches. The merged main tree passes syntax checks, the focused merged regression gate (141/141), and the full suite (210/210). Its representative 41,293-asset benchmark again used 83 yielded batches; the largest observed synchronous slice was 35.7 ms on that verification run.

## Smart Folder metadata deltas and result-scoped virtual geometry follow-up

The active Smart Folder metadata path now reconciles only changed asset IDs. Rating, tag, flag, and other rule-relevant patches are evaluated against the folder's complete effective inherited rule chain; changed assets enter, leave, update, or move to their sorted position without restarting the cooperative whole-view pipeline. Existing unaffected card and image elements are reused, so their DOM identity and decoded thumbnail state remain intact. Selection moves deterministically to the nearest surviving card without requesting a scroll, and effective Smart Folder counts are adjusted from each changed asset's before/after membership.

The blank-canvas and snap-back regression was caused by a virtual surface that could only grow. Late card measurements ratcheted `virtualExtentPx` to the previous/full-library surface even after navigation to a smaller filtered result set. Scroll-to-window mapping still used the filtered IDs, allowing the browser to hold a scroll offset beyond the last result and render an empty live-card window. Thumbnail decode callbacks also changed virtual card geometry after paint, making the stale tail intermittent.

The repair makes virtual geometry an exact function of the active view-generation identity, active ordered-result count, layout, and logical row size. It clamps both scroll position and window bounds to that result extent, guarantees a nonempty bounded window for nonempty results, and prevents late thumbnail dimensions from altering virtual row geometry. Direct user input cancels pending restoration and stale animation-frame work. Path-free diagnostics now attribute result count, window bounds, estimated and actual extent, scroll position, user-scroll epoch, pending restoration, live/decoded card counts, layout, and view identity.

Regression verification includes the screenshot-equivalent case: a 17,839-item library, a 5,198-result Smart Folder, and a stale mid-library scroll offset. The resulting window is nonempty, its bounds stay within 5,198 results, scroll height equals the Smart Folder's logical extent, and upward input is not overridden. Additional deterministic cases cover differently sized view transitions, rating-driven result shrink, bottom-to-top-to-bottom movement, late/out-of-order thumbnail dimensions, failed/late image completion, stable unaffected card identity, and inherited Smart Folder count changes.

Final main-project checks: `npm run check` passes; the focused gate passes 137/137; the complete suite passes 224/224 in 2.34 seconds on this run. The representative 41,293-asset projection test used 83 yielded batches and reported a 35.9 ms largest synchronous slice. These automated measurements establish the repair contracts but do not replace manual acceptance on the representative media library.
