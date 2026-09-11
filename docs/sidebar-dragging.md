# Moving sidebar items up the hierarchy

- Drop a Smart Folder, collection, or physical subfolder on its matching group heading to move it to the root.
- The insertion line aligns with sibling icons for before/after placement, and indents one tree level for an inside drop. After markers appear below expanded descendants, not through the middle of their branch. Root and left-gutter moves show the destination level.
- The destination label (for example, “Inside Pictures”) follows beneath the dragged source preview instead of covering the destination. Context menus and their submenus close at drag start.
- Previews follow existing operation semantics: cross-parent virtual drops and physical folder drops move inside, rather than promising a sibling reorder. Sorted destination branches determine the insertion position. Self/descendant targets are rejected; cancellation clears the preview.
- Drag left into the tree's left gutter (at least 24 pixels left from the drag start) and release inside the same group to move up exactly one level. A “Move up one level” hint identifies the target. Ordinary row drops retain their existing behavior.
- Sidebar navigation is single-selection across Smart Folders, collections, and physical folders. Ctrl/Cmd-click and Shift-click also replace the current sidebar selection. Grid image multi-selection is unchanged. Drag the selected sidebar item to its heading or left-gutter target.
- Selected descendants travel with their selected parent; they are not moved twice. Items already at the root stay there.
- Physical folders move on disk, using the existing guarded folder-move operation and confirmation preference. Their root is their own indexed folder, never the filesystem root. Each physical folder remains within its original indexed location.
- Escape/cancel or releasing outside a valid in-app target does not promote an item. Virtual collection/Smart Folder moves do not move files on disk.
