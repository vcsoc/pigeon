# Combine Images

Select 2–64 images in the thumbnail grid, right-click, and choose **Combine Images…**.

- **Side by side / landscape:** one horizontal strip.
- **Stacked / portrait:** one vertical strip.
- **Mosaic / random:** shuffled images arranged in proportional, justified rows. Shuffle changes the arrangement.
- **Tiled — N images per row/column:** set N; pictures fit inside cells without cropping or stretching.
- Drag preview images to reorder them.
- Toggle filenames below each picture and choose a background color. Long filenames are abbreviated to fit.
- Set maximum width and/or height in pixels. All cells scale together proportionally. Zero uses an automatic 8,192px limit for that side. Absolute limits are 16,384px per side and 40 megapixels total; impossible tiny layouts are rejected.
- **Save combined PNG…** opens the native save dialog. Export creates a new file; it does not automatically import that file into the portfolio. Originals are not changed and selecting a source file as the destination is refused.

The exporter uses original or edited raster pixels, not thumbnail privacy effects. Supported formats are JPEG, PNG, WebP, TIFF, GIF and HEIF/AVIF supported by the installed decoder. Animated formats use the first frame. RAW images need a compatible raster proxy; vector originals are not supported.

Export runs in a worker with a 12-second processing deadline. Cancel terminates the job and removes its temporary output. Slow network sources or large selections may require fewer images or smaller output limits. The preview uses indexed dimensions; export uses decoded source dimensions. Selection and lock permissions are checked before and after processing.
