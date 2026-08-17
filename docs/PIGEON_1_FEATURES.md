# Pigeon 1 local-first feature contract

Pigeon keeps source files in place. Operations that would alter pixels always export a new derivative.

## Implemented subsystems

1. **Nested collections and drag/drop** — create a collection with `+`, select a parent before creating a child, drag assets into collections, and drag collections onto other collections. Collection deletion removes virtual memberships only.
2. **Multi-select and batch editing** — Ctrl/Cmd-click, Shift-click, keyboard navigation, and the batch bar support tags, collections, automatic tags, favorites, and reference trash.
3. **Media previews and file handoff** — the inspector plays local video and audio through a seekable custom protocol with byte-range responses. Thumbnail motion previews use a configurable hover delay (250 ms by default) and cancel before playback when the pointer leaves. Affinity `.af`, `.afdesign`, and `.afphoto` documents and Snagit `.snagx` archives expose their rendered embedded images safely for grid thumbnails, the inspector, and the internal viewer. Drag thumbnails directly into Finder, Explorer, Slack, Obsidian, Outlook, Word, Excel, PowerPoint, or any application that accepts operating-system file drops. The same native drag can target Pigeon collections and indexed folders; Shift-drag remains available as an internal-only fallback.
4. **Duplicates and similarity** — exact duplicates use SHA-256 content hashes; the Duplicates page groups perceptually similar images into horizontal rows, provides a persistent 35–100% accuracy slider, and supports source-based “Find similar” from the asset context menu.
5. **Smart folders** — current query, type, rating, tag, location, favorite, and collection constraints can be persisted and reopened.
6. **Capture and ingestion** — local managed imports accept HTTP(S) URLs, clipboard URLs, and OS screen captures. `browser-extension/` is an unpacked Manifest V3 Chrome/Edge extension that hands URLs to the registered `pigeon://` protocol.
7. **Metadata** — indexing stores SHA-256, dimensions, format/color-space details, dominant color, and a 32-bin luminance histogram.
8. **Commands and menus** — arrow/Home/End/Page navigation, application menus, quick actions, right-click asset actions, and filter popovers are available.
9. **Local automatic tags** — deterministic offline suggestions use filenames, media kind, orientation, and dominant color. Tags can be renamed or removed library-wide.
10. **Trash, backup, export, migration, and folder sync** — schema migrations are non-destructive, saves are atomic, rotating backups are retained, trash removes references only, and user-selected sync folders merge metadata by update timestamp.
11. **Annotations and derivative editing** — rectangle/text annotations, rotation, horizontal flip, and brightness adjustment export to a new PNG. Original files are never modified.
12. **Plugins and automation** — `.js` plugins in the local plugin directory run in a time-limited worker/VM with no `require`, `process`, filesystem, or network capability. The exposed API is read-only `pigeon.assets` plus `pigeon.emit({type:'tag', ids, tag})`.
13. **Guided tutorials** — Help → Tutorials opens a comic-style walkthrough that spotlights each application area while dimming the rest of the interface. Click anywhere or use Back/Next/End to navigate guidance for portfolios, views, filters, collections, indexed folders, password protection, blur/pixel privacy effects, hover motion previews, and temporary preview modifiers.
14. **Focused file indexing** — new discovery defaults to configurable media and content categories covering common images and RAW formats, video, audio, documents and Markdown, presentations, spreadsheets, design files, fonts, and 3D models. Preferences can enable or disable each category, add custom extensions, or index every file type.
15. **Selected-item portfolio transfers** — the thumbnail context menu and batch bar can copy selected files into another portfolio. Pigeon stages independent file copies in a managed transfer folder and groups them in a destination collection. Move mode performs the destination copy first, then moves the source portfolio references to Trash.
16. **Quick review and live developer telemetry** — configurable Quick Check shortcuts persist red-dot review marks and can restrict the grid to checked items. Privacy effects extend to inspector previews and can be globally toggled for temporary review. Ctrl+Alt+D opens a compact live overlay with Electron CPU, GPU, memory, worker, queue, operation, error, CPU-count, and uptime telemetry.

## Safety invariants

- Removing locations, collections, smart folders, tags, or trash entries never deletes original files.
- URL and screenshot sources are written only to Pigeon's managed imports directory.
- Sync is opt-in and writes only to a user-selected local folder.
- Editing always uses Save As and produces a derivative.
- Plugins cannot access Node or Electron APIs and are terminated after two seconds.
- Automatic tagging runs entirely offline.

## Browser extension installation

Open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select the packaged `browser-extension` directory. Pigeon registers the `pigeon://` protocol when launched.

## Verification

```sh
npm run verify
npm run dist:win
```

Pigeon’s Preferences window provides General, Sidebar, Controls, Preview, Screenshot, Shortcuts, Notifications, Password, Auto-Import, local AI Search/Models, local MCP, and Developer pages. Preferences remain local and optional integrations are disabled by default.

Video startup work extracts thumbnails only. FFmpeg proxies are generated only after native playback fails, run one at a time with one codec/filter thread at below-normal OS priority, and never execute synchronously on the renderer. Similarity grouping runs in a worker thread.

`npm test` covers migrations, nested collection invariants, batch/trash behavior, duplicate and similarity logic, saved filters, local tags, extension structure, media range support, and plugin sandbox behavior. The seeded Electron smoke test asserts selection, multi-selection, keyboard handling, facet menus, and the application menu.
