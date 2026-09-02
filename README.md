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
