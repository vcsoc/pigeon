# Moving sidebar items up the hierarchy

- Drop a Smart Folder, collection, or physical subfolder on its matching group heading to move it to the root.
- Drag left into the tree's left gutter (at least 24 pixels left from the drag start) and release inside the same group to move up exactly one level. A “Move up one level” hint identifies the target. Ordinary row drops retain their existing behavior.
- Ctrl/Cmd-click or Shift-click selects multiple collections or Smart Folders. Physical folders retain their existing multi-selection. Drag a selected row to move that selection to the heading or left-gutter target.
- Selected descendants travel with their selected parent; they are not moved twice. Items already at the root stay there.
- Physical folders move on disk, using the existing guarded folder-move operation and confirmation preference. Their root is their own indexed folder, never the filesystem root. Each physical folder remains within its original indexed location.
- Escape/cancel or releasing outside a valid in-app target does not promote an item. Virtual collection/Smart Folder moves do not move files on disk.
