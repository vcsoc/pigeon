
# Feature: Pigeon Collection Export/Import (`.pigeon`)

> Implementation note: the canonical, normative v1 format is documented in [`pigeon-collection-format.md`](pigeon-collection-format.md). This document remains the product and UX brief.

Implement a new **Pigeon Collection** feature that allows users to select multiple files inside the Pigeon application and export them into a single portable archive using the custom `.pigeon` file extension.

The feature should behave similarly to a ZIP archive internally, while presenting itself to users as a native Pigeon file type.

## Objective

Users must be able to:

1. Select one or more files in Pigeon.
2. Export those files into a single `.pigeon` collection.
3. Choose the collection name and save location.
4. Share or move the `.pigeon` file like any normal file.
5. Double-click a `.pigeon` file from the operating system and have it open in Pigeon.
6. Preview the contents of the collection before importing/extracting them.
7. Import selected or all files from a `.pigeon` collection back into Pigeon.

Example:

```text
Family Holiday.pigeon
Project Assets.pigeon
Website Mockups.pigeon
```

---

# File Format

A `.pigeon` file must internally be a standard ZIP-compatible archive.

Use a structure similar to:

```text
Family Holiday.pigeon
│
├── manifest.json
├── files/
│   ├── DSC_0012.jpg
│   ├── DSC_0013.jpg
│   ├── notes.txt
│   └── itinerary.pdf
│
└── thumbnails/
    ├── DSC_0012.webp
    └── DSC_0013.webp
```

Do not rely solely on the `.pigeon` extension to identify a valid collection.

Every collection must contain a valid `manifest.json`.

---

# Manifest

Design the manifest as a versioned format so it can evolve without breaking older collections.

Minimum example:

```json
{
  "format": "pigeon-collection",
  "formatVersion": 1,
  "name": "Family Holiday",
  "id": "UUID",
  "createdAt": "2026-09-02T12:44:00-04:00",
  "createdBy": {
    "application": "Pigeon",
    "version": "APPLICATION_VERSION"
  },
  "files": [
    {
      "id": "UUID",
      "path": "files/DSC_0012.jpg",
      "originalName": "DSC_0012.jpg",
      "mimeType": "image/jpeg",
      "size": 4837292,
      "sha256": "HASH",
      "thumbnail": "thumbnails/DSC_0012.webp"
    }
  ]
}
```

Use UUIDs rather than array indexes or filenames as persistent identifiers.

---

# Integrity

Calculate a SHA-256 hash for every exported file and store it in the manifest.

When opening/importing a `.pigeon` file:

* validate the manifest;
* validate supported format version;
* validate expected archive paths;
* verify file sizes where available;
* verify SHA-256 hashes;
* clearly report corrupted or missing entries.

A single corrupt file should not necessarily make the entire collection unusable.

Allow the user to import valid files while clearly identifying invalid entries.

---

# Security

Treat every `.pigeon` file as untrusted input.

The archive extraction implementation must protect against:

* Zip Slip/path traversal;
* `../` paths;
* absolute paths;
* symbolic-link attacks;
* decompression bombs;
* unreasonable file counts;
* unreasonable uncompressed sizes;
* duplicate/conflicting archive paths;
* malformed manifests;
* unsupported future manifest versions.

Never directly extract archive paths supplied by the ZIP without validating and normalizing them first.

Set sensible configurable limits for:

* maximum number of files;
* maximum individual file size;
* maximum total uncompressed size;
* maximum compression ratio.

Never execute anything contained in a `.pigeon` archive.

---

# Export UX

Add an action such as:

```text
Export as Pigeon Collection…
```

The action should be available when one or more files are selected.

Provide an export dialog containing:

* collection name;
* destination;
* number of selected files;
* estimated original size;
* resulting filename.

Example:

```text
Collection name:
Family Holiday

Files:
38

Original size:
684 MB

Save as:
Family Holiday.pigeon
```

The `.pigeon` extension should automatically be appended if the user does not provide it.

Do not allow accidental `.pigeon.pigeon` filenames.

---

# Export Process

The export pipeline should roughly be:

```text
Selected files
      ↓
Validate files
      ↓
Generate collection UUID
      ↓
Collect metadata
      ↓
Generate optional thumbnails
      ↓
Calculate SHA-256 hashes
      ↓
Generate manifest.json
      ↓
Create ZIP archive
      ↓
Save with .pigeon extension
      ↓
Verify archive
      ↓
Report success
```

Exports should be written atomically.

Create the archive as a temporary file first and only rename/move it to the final `.pigeon` filename after successful completion.

If export fails, avoid leaving incomplete `.pigeon` files behind.

---

# Progress

Large collections may take time to package.

Provide export progress such as:

```text
Creating Family Holiday.pigeon

Processing 17 of 38 files
DSC_0184.jpg

████████████░░░░░░ 62%
```

Support cancellation where practical.

Cancellation should clean up temporary files.

---

# Import/Open UX

Opening a `.pigeon` file should display a collection viewer before importing anything.

Example:

```text
Family Holiday

38 files
684 MB
Created September 2, 2026

[ Select All ]

☑ DSC_0012.jpg
☑ DSC_0013.jpg
☑ DSC_0014.jpg
☐ itinerary.pdf
☑ notes.txt

[ Import Selected ]
```

Show useful metadata where appropriate:

* filename;
* type;
* file size;
* thumbnail/preview;
* date;
* integrity status.

Do not silently extract files merely because the `.pigeon` file was double-clicked.

---

# Import Behaviour

Allow:

```text
Import All
```

and:

```text
Import Selected
```

Preserve original filenames where possible.

If a filename conflicts with an existing file, follow Pigeon's normal duplicate/conflict policy rather than overwriting silently.

---

# Drag and Drop

Support dragging a `.pigeon` file into the Pigeon application.

This should behave identically to opening the file from the operating system.

If appropriate to the existing UX architecture, also support dragging selected files out/exporting them as a Pigeon Collection later, but this is not required for the initial implementation.

---

# Operating System Registration

Register `.pigeon` as a native Pigeon-associated file type.

## Windows

Register:

```text
.pigeon
```

with an application-specific ProgID similar to:

```text
Pigeon.Collection
```

Opening a `.pigeon` file should launch:

```text
Pigeon.exe "<path-to-file>.pigeon"
```

Provide a meaningful file description:

```text
Pigeon Collection
```

Associate an appropriate Pigeon collection icon.

Use the application's existing installer/package mechanism rather than modifying registry entries ad hoc at runtime where possible.

---

## macOS

Declare `.pigeon` as a supported document type through the application's bundle configuration.

Use a content type/UTType representing:

```text
Pigeon Collection
```

Opening the document through Finder must forward it to the running Pigeon instance or launch Pigeon and open the collection.

---

## Linux

Provide the appropriate MIME registration and `.desktop` file association.

Prefer:

```text
application/x-pigeon
```

unless the project already has an established MIME naming convention.

Associate:

```text
*.pigeon
```

with Pigeon.

Opening the file through the desktop environment should launch Pigeon with the `.pigeon` path.

---

# MIME Type

Internally define the collection MIME/content type as:

```text
application/x-pigeon
```

Keep this definition centralized rather than duplicating the string throughout the codebase.

---

# Application Startup

Update Pigeon's startup argument handling so that:

```text
pigeon example.pigeon
```

opens the collection viewer.

Handle:

* paths containing spaces;
* Unicode filenames;
* relative paths;
* absolute paths;
* multiple launches;
* operating-system open-file events;
* a `.pigeon` file being opened while Pigeon is already running.

Follow the application's existing single-instance architecture if one exists.

---

# Internal Architecture

Do not place ZIP/archive logic directly inside UI components.

Create a dedicated domain/service layer.

A possible structure is:

```text
PigeonCollectionService
├── createCollection()
├── openCollection()
├── validateCollection()
├── inspectCollection()
├── importCollection()
└── verifyCollection()
```

Supporting components may include:

```text
PigeonCollectionManifest
PigeonCollectionReader
PigeonCollectionWriter
PigeonCollectionValidator
PigeonCollectionHasher
PigeonCollectionThumbnailService
```

Names should be adapted to the existing architecture and conventions of the repository.

---

# API Design

Prefer clear domain models rather than loosely typed maps/objects.

Example conceptual API:

```text
createCollection({
    name,
    files,
    destination
})

inspectCollection(path)

validateCollection(path)

importCollection({
    collection,
    selectedFiles,
    destination
})
```

Separate:

```text
inspect
validate
import
```

so opening a collection never implicitly modifies the user's library.

---

# Versioning

The format must be explicitly versioned from day one.

Current version:

```text
formatVersion: 1
```

Design the parser so future versions can be handled using version-specific logic.

For unsupported newer versions, show a message such as:

```text
This Pigeon Collection was created using a newer version of Pigeon and cannot be opened by this version.
```

Do not attempt to guess how an unknown future format works.

---

# Forward Compatibility

The manifest parser should tolerate unknown optional properties.

This allows future versions to add metadata without immediately breaking older clients.

Required properties, however, must still be validated.

---

# ZIP Compatibility

Although `.pigeon` is internally ZIP-based, the UI should always refer to it as a:

```text
Pigeon Collection
```

Do not expose implementation terminology such as "ZIP archive" in normal user-facing UI unless needed for troubleshooting or technical documentation.

Advanced users should technically be able to rename:

```text
Example.pigeon
```

to:

```text
Example.zip
```

and inspect the container.

This is intentional.

---

# Nested Collections

For v1, decide explicitly how `.pigeon` files contained inside another `.pigeon` collection are treated.

Version 1 decision:

Allow them as ordinary files, but do not recursively unpack them automatically.

This prevents unexpected recursive extraction behaviour.

---

# Tests

Add comprehensive automated tests.

At minimum test:

### Creation

* single-file collection;
* multi-file collection;
* empty selection rejected;
* Unicode filenames;
* duplicate filenames;
* very long filenames;
* files with spaces;
* nested directories if supported;
* binary files;
* zero-byte files.

### Manifest

* valid v1 manifest;
* missing manifest;
* malformed JSON;
* missing required fields;
* unknown optional fields;
* unsupported version;
* invalid hashes.

### Security

Test malicious archives containing:

```text
../outside.txt
../../etc/example
/absolute/path
C:\absolute\path
```

Ensure no file can escape the intended extraction/import directory.

Also test:

* decompression limits;
* excessive number of files;
* invalid compression metadata;
* corrupted ZIP;
* duplicate archive paths.

### Integrity

Modify an archived file after manifest creation and confirm that SHA-256 validation detects the change.

### OS Launch

Where testable, confirm:

```text
pigeon example.pigeon
```

correctly routes to the collection viewer.

---

# Documentation

Add developer documentation describing the `.pigeon` specification.

Suggested:

```text
docs/pigeon-collection-format.md
```

Document:

* purpose;
* archive structure;
* manifest schema;
* versioning;
* hashing;
* MIME type;
* security requirements;
* import/export behaviour;
* backward/forward compatibility.

Treat this document as the canonical specification for the file format.

---

# Future Compatibility

Design the format so these capabilities could later be added without redesigning the entire container:

* collection descriptions;
* tags;
* folder structures;
* comments;
* favourites;
* ratings;
* EXIF metadata;
* collection cover images;
* richer previews;
* optional encryption;
* password protection;
* digital signatures;
* collection author information;
* application metadata;
* cloud sharing;
* incremental collections;
* import history.

Do NOT implement these unless they already naturally fit the current scope.

Avoid speculative complexity.

---

# Definition of Done

The feature is complete when:

1. A user can select files and export a `.pigeon` collection.
2. The resulting archive contains a valid versioned manifest.
3. The original files can be recovered without corruption.
4. SHA-256 integrity validation works.
5. A `.pigeon` collection can be opened safely without automatically importing its contents.
6. Users can preview and selectively import files.
7. Malicious archive paths cannot escape the intended destination.
8. Large/corrupt archives are handled safely.
9. `.pigeon` is associated with Pigeon on all operating systems currently supported by the application.
10. Double-clicking a `.pigeon` file launches/activates Pigeon and opens the collection viewer.
11. Automated tests cover the core format, security boundaries, export and import behaviour.
12. The collection format is documented.

---

# Engineering Instructions

Before implementation:

1. Inspect the repository architecture.
2. Identify the application framework, desktop packaging system, storage model, file abstraction, UI patterns and existing OS integration.
3. Reuse existing abstractions rather than creating parallel systems.
4. Identify how Pigeon currently handles file selection, file metadata, thumbnails, dialogs and application startup arguments.
5. Produce a short implementation plan based on the actual repository before modifying code.

During implementation:

* follow existing coding conventions;
* maintain clear separation between UI, domain logic and archive/file-system operations;
* avoid introducing unnecessary dependencies;
* use established, well-maintained archive and cryptographic libraries rather than implementing ZIP or SHA-256 primitives manually;
* preserve backward compatibility;
* validate all untrusted paths and metadata;
* keep the format implementation cross-platform;
* ensure errors are useful to both users and developers.

After implementation:

1. Run formatting/linting.
2. Run existing tests.
3. Run the new collection tests.
4. Build the application.
5. Verify the feature manually where practical.
6. Review the implementation specifically for archive traversal and unsafe extraction vulnerabilities.
7. Report:

   * files changed;
   * architecture introduced;
   * tests added;
   * OS integration implemented;
   * any limitations;
   * recommended follow-up work.

Do not declare the feature complete if tests, builds, or security validation are failing.
