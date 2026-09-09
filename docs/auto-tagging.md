# Automatic tag generation

Pigeon generates tags locally from metadata, not image-recognition AI.

## When it runs

- During indexing: previously untagged items receive generated tags when the library's automatic-tagging setting is enabled and the item is not awaiting organization.
- After preview generation: the same rules run with newly available dimensions and dominant color. New tags are added without removing existing tags.
- Editing rules does not retroactively rewrite the portfolio. Save preferences, then run rules manually for existing items.
- Manual jobs use the existing background tagging queue and appear in Threads. Processing remains subject to its pause/cancel controls.

## Preferences → Auto-tagging

**Generate tags automatically** controls metadata-based generation at indexing/preview time. Explicit manual runs remain available when it is off. The legacy library-wide `settings.autoTag` gate is also respected by automatic runs.

Choose any built-in sources: filename words, media type, orientation, and nearest dominant color. Filename words and dominant color are off by default; explicitly saved choices are preserved. Custom rules can be enabled separately, match **all** or **any** conditions, and add multiple comma-separated tags.

Conditions support filename/name/path, media kind, extension, rating, width, height, existing tags, and collection IDs. Text comparisons are case-insensitive; numeric comparisons use “at least”/“at most”. Empty rules do not match. No JavaScript or regular expressions are evaluated.

Tag templates:

- `{name}` — asset name
- `{folder}` — immediate parent folder
- `{extension}` — extension in lowercase
- `{kind}` — media kind
- `{year}` — modification year

Example: path **contains** `/Travel/` AND kind **equals** `image`; add `travel, {folder}, trip-{year}`.

Custom rules run in order and evaluate the item's existing metadata. Generated output is deduplicated case-insensitively, capped at 64 tags per run, and never removes tags. Up to 100 rules and 20 conditions per rule are supported. Built-in sources retain the previous 12-tag limit.

## Run manually

- Thumbnails → **Tags & organize → Generate local tags** applies saved generation settings to the selected thumbnails.
- Folder, collection, or Smart Folder → **Tags & organize → Run tag rules now…** previews the item count and asks for confirmation. Physical folders include descendants; collections include nested collections; Smart Folders use their current matching membership. Locked and trashed items are excluded from scoped runs.
- **Manage generation rules…** opens the preferences page.

## Fixed folder/collection tags are separate

Existing **Set/Edit Auto-Tag…** actions assign fixed tags to a physical folder subtree or collection. They are not generated metadata rules and remain enabled independently. Existing tag rename/replacement operations continue to manage those assignments. They do not rewrite literal values in custom generation-rule conditions or templates.

## Context menus

Thumbnail and folder menus group existing commands into **Open & navigate**, **Tags & organize**, **Edit & maintain**, **Find & export**, and **Privacy & security**. Destructive commands remain directly accessible at the bottom. Hover or click a group to open it; Right Arrow enters, Left Arrow leaves. Existing per-command shortcut labels remain attached to their actions.
