# Thumbnail and scrolling responsiveness

Changes:

- Reconcile virtual windows by asset ID instead of replacing the grid HTML and detaching every retained image. Only outgoing and incoming cards change; metadata/navigation rebuilds still use the existing paths.
- Defer viewport measurements on virtual-window updates until the scheduled sweep. Avoid rewriting identical placement properties or rebuilding privacy-effect canvases on every scroll render.
- Share viewport rectangles between queueing, priority IPC, and thumbnail completions. Every scroll/resize/render sweep refreshes the geometry; disconnected cards and out-of-range requests remain cancelable.
- Raise the bounded preview loader from four to eight concurrent requests. Visible previews remain ahead of directional read-ahead and trailing previews. Retry limits, watchdog, missing-cache behavior, and thumbnail-generation resource controls remain unchanged.
- Use the main-process asset index for cached preview requests only when it belongs to the current library. Preserve the array fallback during loading, partial index construction, and library replacement; retain lock checks before file access.
- Reuse the semantic eligible-item count for up to one second between progress publications. Explicit status requests refresh it, loading returns zero, and portfolio changes invalidate it. Search and analysis still read fresh eligibility/fingerprints; no index, model, checkpoint, queue, or original files are removed.

## Measurements

`scripts/e2e/scroll-performance.cjs` creates an isolated 30,000-reference portfolio with local cached thumbnails and moves 6,000 pixels over 75 frame callbacks. Source compared against the existing packaged 0.3.18 implementation on this machine:

| Metric | 0.3.18 baseline (isolated repeat) | Optimized source |
| --- | ---: | ---: |
| Average synchronous grid render | 18.96 ms | 3.23 ms |
| P95 synchronous grid render | 25.20 ms | 5.60 ms |
| DOM child-list mutations | 7,230 | 480 |
| P95 frame interval | 116.7 ms | 100.0 ms |
| Final DOM cards / decoded previews | 120 / 120 | 120 / 120 |

The existing 350-fixture thumbnail-throughput scenario reloaded 24 visible previews in **127.8 ms before / 79.5 ms after** (four / eight requests). These are synthetic headless Electron measurements, not a guarantee of desktop frame rate. Other active workloads and ongoing disk/model work still affect responsiveness. The reduced synchronous work and DOM churn are distinct from overall frame interval.

Run with `node scripts/e2e/scroll-performance.cjs`. Use `PIGEON_E2E_APP_ROOT=/absolute/path/to/resources/app.asar` to test an existing package. Reports include timings, final scroll position/window, DOM mutations, decoded-card count, and a renderer CPU profile. All fixtures and reports are temporary and separate from the real user library.
