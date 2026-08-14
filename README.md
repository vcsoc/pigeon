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
- Non-destructive annotations and derivative image edits
- Sandboxed local plugins and a Chrome/Edge capture extension
- Packaging targets for Windows, macOS, and Linux

See [`docs/PIGEON_1_FEATURES.md`](docs/PIGEON_1_FEATURES.md) for the complete local-first feature contract and usage.

## Run

```sh
npm install
npm start
```

Build native packages with:

```sh
npm run dist:win
npm run dist:mac
npm run dist:linux
```

The workflow in `.github/workflows/build-desktop.yml` builds Windows x64, a universal macOS package, and Linux x64 on their native runners. A version tag such as `v0.1.0` also publishes the installers and update metadata to the corresponding GitHub Release.

## License

Copyright © 2026 Chris Visser. Pigeon is source-available under the [PolyForm Shield License 1.0.0](LICENSE.md), which does not permit using this software to provide a competing product. See [`NOTICE.md`](NOTICE.md) for required notices, [`COMMERCIAL-LICENSE.md`](COMMERCIAL-LICENSE.md) for commercial and enterprise licensing, and [`TRADEMARKS.md`](TRADEMARKS.md) for branding rules.

Pigeon is not distributed under an OSI-approved open-source license. Third-party components remain under their own licenses.

## Local data

Pigeon stores each portfolio in an embedded SQLite database (`library.db`) using WAL mode, plus cached thumbnails in Electron's per-user application data directory. Existing `library.json` data is imported automatically once and archived as `library.json.migrated`. JSON remains available for portable backups and folder-based sync. Removing a location from Pigeon only removes its references from the index; the original files are never changed.
