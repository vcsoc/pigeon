# Pigeon

Pigeon is a cross-platform visual asset index with a fast, three-pane library interface. Unlike a conventional asset library, Pigeon never imports, copies, moves, or renames your source files. It stores only references and user-authored metadata.

For removable and external locations, Pigeon stores a small 256px JPEG thumbnail so an image remains identifiable while its source is offline. The full-resolution original always stays at its original path.

## Included

- Reference-only indexing for folders and individual files
- CPU-capped parallel background indexing with durable per-portfolio resume checkpoints
- Background watching and manual rescans
- Inline diagnostics and live thread/process telemetry for CPU, GPU, memory, file counts, and runtime
- Keyboard-accessible sidebar trees with vertical-only scrolling
- Recursive collection and smart-folder exports that preserve folder structure
- User-confirmed GitHub release update checks and automatic installation
- Offline/removable location detection on Windows, macOS, and Linux
- Persistent tiny thumbnail cache for removable-source images
- Masonry and compact list layouts
- Search across filenames, paths, notes, and tags
- Format filters, smart views, favorites, ratings, notes, and tags
- Inspector with image, video, and audio previews plus technical metadata and histograms
- Nested collections, multi-select batch actions, saved smart folders, reference trash, duplicates, and visual similarity
- Local automatic tags, URL/clipboard/screenshot capture, rotating backups, and folder-based metadata sync
- Image editor with Save to original PNG/JPEG/WebP, Save copy, and non-destructive Save draft
- Sandboxed local plugins and drag-to-capture extensions for Chrome, Edge, Firefox, Safari, Brave, Opera, and Vivaldi
- Native single- and multi-file drag-out to Explorer, Finder, and other desktop applications; unavailable cloud placeholders are safely skipped, while Shift-drag keeps Pigeon-only organization behavior
- Optional collision-safe naming for Pigeon-managed moves and exports, with an explicit Skip/Keep both choice for byte-identical files
- Packaging targets for Windows, macOS, and Linux

See [`docs/PIGEON_1_FEATURES.md`](docs/PIGEON_1_FEATURES.md) for the complete local-first feature contract and usage.

## Run

```sh
npm install
npm start
```

Build native packages and all browser-extension variants with:

```sh
npm run dist:win
npm run dist:mac
npm run dist:linux
npm run extensions:build
```

On any website, drag an image or video into the dimmed Pigeon drop panel to download it into the active portfolio’s temporary virtual **Downloads** collection. See [`browser-extension/README.md`](browser-extension/README.md) for per-browser loading and Safari signing instructions.

The workflow in `.github/workflows/build-desktop.yml` builds Windows x64, a universal macOS package, and Linux x64 on their native runners. A version tag such as `v0.1.0` also publishes the installers and update metadata to the corresponding GitHub Release.

macOS releases must be signed with a **Developer ID Application** certificate so Squirrel can validate automatic updates. Configure the `MACOS_CERTIFICATE_P12`, `MACOS_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` repository secrets before tagging a release. The workflow rejects unsigned or ad-hoc-signed macOS builds and does not publish a partial release when any platform build fails.

## License

Copyright © 2026 Chris Visser. Pigeon is source-available under the [PolyForm Shield License 1.0.0](LICENSE.md), which does not permit using this software to provide a competing product. See [`NOTICE.md`](NOTICE.md) for required notices, [`COMMERCIAL-LICENSE.md`](COMMERCIAL-LICENSE.md) for commercial and enterprise licensing, and [`TRADEMARKS.md`](TRADEMARKS.md) for branding rules.

Pigeon is not distributed under an OSI-approved open-source license. Third-party components remain under their own licenses.

## Local data

Pigeon stores each portfolio in an embedded SQLite database (`library.db`) using WAL mode, plus cached thumbnails in Electron's per-user application data directory. Existing `library.json` data is imported automatically once and archived as `library.json.migrated`. JSON remains available for portable backups and folder-based sync. Removing a location from Pigeon only removes its references from the index; the original files are never changed.

## Semantic search preview

Use the ✦ toolbar button or the right panel’s Semantic tab to search the active portfolio by description, a selected asset, or a dropped sample file. Search controls stay in the right panel; ranked results reuse a dedicated Semantic thumbnail tab, while the Files tab preserves normal navigation, selection and scroll position. Example-file search, result refinements and technical details are collapsible. Colored search progress reports stages, elapsed time and an estimated remaining comparison time when measurable. Matching video segments have temporary start/end markers; hovering between them loops only that segment. The camera button opens sample-file search directly. The local EmbeddingGemma 2 engine indexes images, text/code passages, PDF pages (including scanned pages), DOCX/XLSX contents, and 20-second video/audio segments. Other formats retain searchable filenames, notes, and tags and report content-extraction limitations. Video frames are sampled every five seconds, so very brief events can be missed. Results include passage snippets, PDF page numbers, or video/audio timestamps. Similarity is a ranking score, not a confidence percentage. Load more matches to browse beyond the initial result page.

Concurrent extraction batches share one model and one SQLite writer, with up to two file workers automatically and four for Analyze now. Available memory can reduce concurrency; batches rotate after two segments per file so long videos do not monopolize the queue. Embedding inference uses small memory-aware microbatches, and search can run between indexing batches.

The Resource limit slider defaults to 15% of system CPU and physical memory, is adjustable from 5–50%, and applies to automatic and manually started work. Automatic analysis waits for three low-load samples (below 35% system CPU). Analyze now waits when total CPU exceeds 70% and completes the current folder, collection or smart-folder scope before the remaining portfolio. A limit too small to hold the model stops analysis safely rather than exceeding the memory budget. Linux systemd user scopes enforce CPU quotas over 100 ms periods, MemoryMax, and zero worker swap, including FFmpeg children. CPU-only inference, limited model/decoder threads, low process priority, and an additional governor keep the UI responsive. Outside Linux/systemd, cooperative CPU and monitored memory limits are used; hard kernel limits are not provided. Percentages apply to the semantic engine, not unrelated applications or Pigeon's pre-existing workers.

Indexes are separate portfolio-sidecar SQLite databases (`<portfolio database>.semantic.sqlite3`), versioned and invalidated when file metadata, content hashes, notes, tags or preview sources change. Deleted, offline, encrypted and currently locked assets are excluded. Portfolio changes terminate the old worker; completed work resumes from stored segment cursors. Manual scan intent, scope priority, resource limits and pause state are saved per portfolio, so reopening Pigeon continues an unpaused scan even if automatic analysis is disabled. The overall scan bar displays completed files and a percentage. The index stores extracted snippets, so protect the portfolio data directory as you would its source documents. Disabling automatic analysis leaves search and Analyze now available.

The engine diagnoses its dependencies and cached model automatically before semantic operations. Missing components are prepared without a repair button, concurrent operations share one preparation job, and interrupted installs resume in the private environment. First preparation downloads a private Python runtime/dependencies and Google's Apache-2.0 EmbeddingGemma 2 weights; inference then runs offline. Install `uv` to allow setup to create its private Python environment. Runtime requirements are in `electron/semantic-requirements.txt`; CPU torch 2.14.1 and torchvision 0.29.1 come from the PyTorch CPU wheel index. This implementation uses Google's full multimodal model, not the Unsloth GGUF conversion.

For the local preview prepared on this machine, run `release/semantic-preview/launch-preview.sh`. It uses `.semantic-runtime` in this project and the already downloaded model cache. Close an existing Pigeon instance first.

Validation: `npm run check:semantic`, `npm run test:semantic`, and `node scripts/e2e/semantic-search.cjs`. The Electron test seeds an isolated portfolio, runs real multimodal inference, checks locked-file exclusions, search, pause/resume and Linux kernel limits.
