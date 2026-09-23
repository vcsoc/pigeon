# Blur and pixelate image regions

1. Right-click a thumbnail and choose **Edit image**, or press **F4**. Customize this under **Preferences → Shortcuts**. **F5** updates all selected thumbnails and is also configurable.
2. Choose **Blur region** or **Pixelate region**, then drag a rectangle over the image.
3. The new region is selected automatically. Drag it to move it, use its corner handle to resize it, or edit its X/Y/width/height fields.
4. Adjust **Effect strength** (1–100) under Selected layer. Each region has its own strength. Select an existing region with Select or the Layers list; Delete layer removes it before saving.
5. Add more regions of either type as needed. **Save** writes the pixels into the original PNG/JPEG/WebP file; **Save copy** exports a separate file; **Save draft** keeps the edited version inside Pigeon without changing the physical file. **Cancel** discards unsaved changes.

The panel places selected-layer controls immediately after the tools. Image adjustments follow the layer list; help and AI enlargement can be expanded when needed. Background library refreshes no longer dismiss your editor.

Live previews are scaled for responsiveness; saving uses full-resolution image pixels. Regions remain axis-aligned in source coordinates and follow whole-image rotation/flip/resize. Later overlapping regions take precedence; text and rectangle annotations appear above image effects. Up to 32 effect regions are supported, with an 80-megapixel input/combined-region-area limit. Excessive requests fail rather than silently dropping regions.

Saved effects are committed pixels, not individually adjustable saved filter layers. After Save or Save draft, their temporary layer controls are removed to avoid applying them twice when reopening. Restore original can discard a Pigeon draft, but cannot undo a physical file Save. Use Save copy when you need to keep the original intact.

**Blur and pixelation are visual effects, not guaranteed secure redaction.**
