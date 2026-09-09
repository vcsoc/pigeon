# Thumbnail captions and repeated scan feedback

- Grid/justified caption space now follows configured title-line count and app font size; those inputs invalidate cached geometry. Captions have larger text, higher contrast and explicit line height. List typography is unchanged.
- Threads labels/details/controls use readable minimum sizes and independent Details typography; long task text wraps instead of being ellipsized. Details labels have higher contrast.
- Existing sources display “Checking for changes in …”, rather than “Adding files from …”. Scoped tasks use the selected subfolder name.
- The filesystem watcher requests stats and skips known file notifications when path, size and modification time are unchanged. Missing/pending/permission placeholders, removals, new files and actual modifications still request scans. Scan starts record their reason for diagnosing remaining triggers.

The active portfolio's read-only database inspection showed `datadl` had a previous scan timestamp, a newer incomplete checkpoint and `rescanRequested: true`. That confirms repeat scheduling, not its exact historical trigger. Policy updates, reconnects and interrupted scans can still legitimately trigger checks. No live library data or running scan was modified.

Validation: 518 component tests passed. A bounded standalone Chromium CSS test checked 12 caption configurations (1–3 lines, font sizes 8/13/18/24): no vertical clipping or caption movement when an image was added. This is not full desktop/scroll or live SMB watcher validation. Run `timeout 14s node_modules/.bin/electron scripts/e2e/caption-geometry.cjs --no-sandbox`.

These changes are source-only; the installed application has not been replaced or restarted.
