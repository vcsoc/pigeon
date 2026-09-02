# Pigeon Collection format (`.pigeon`)

Status: canonical version 1 specification.

## Purpose and media type

A Pigeon Collection is a portable, non-executable collection of user files. Its filename extension is `.pigeon`, its MIME type is `application/x-pigeon`, and its container is a standard ZIP archive. Consumers must validate the contents and must not trust the extension alone.

## Archive layout

```text
manifest.json
files/<file UUID>/<original filename>
thumbnails/<file UUID>.<image extension>   (optional)
```

Payload paths use UUID directories so duplicate original filenames remain unambiguous. A v1 archive may contain another `.pigeon` file as an ordinary payload; readers must never recursively import it automatically.

## Manifest v1

`manifest.json` is UTF-8 JSON:

```json
{
  "format": "pigeon-collection",
  "formatVersion": 1,
  "name": "Family Holiday",
  "id": "UUID",
  "createdAt": "2026-09-02T16:44:00.000Z",
  "createdBy": { "application": "Pigeon", "version": "0.2.65" },
  "files": [{
    "id": "UUID",
    "path": "files/UUID/photo.jpg",
    "originalName": "photo.jpg",
    "mimeType": "image/jpeg",
    "size": 4837292,
    "sha256": "64 lowercase hexadecimal characters",
    "relativePath": "Day 1/Beach",
    "thumbnail": "thumbnails/UUID.jpg"
  }]
}
```

Unknown properties are optional and ignored. All shown top-level properties except optional `createdBy` are required. `relativePath` and `thumbnail` are optional file properties. Paths always use `/` separators and are relative to the archive root.

## Integrity

`size` is the uncompressed payload byte count. `sha256` is the SHA-256 digest of those exact bytes. Readers verify every payload independently. Missing, size-mismatched, and hash-mismatched files are reported individually; valid files remain importable.

Writers create an archive in the destination directory under a temporary name, close it successfully, and then rename it to the final `.pigeon` path.

## Security requirements

Readers treat archives and manifests as untrusted. Before exposing or extracting content they must reject:

- absolute, drive-qualified, empty-segment, `.` or `..` archive paths;
- duplicate paths, including case-only duplicates;
- symbolic links and encrypted entries;
- malformed or missing manifests;
- duplicate manifest IDs or payload paths;
- unsupported format versions;
- configured file-count, individual-size, total-size, preview-size, and compression-ratio limits.

Extraction must select payloads by validated manifest identity, choose its own private destination path, create regular files exclusively, and verify size and SHA-256 while writing. Archive paths are never joined directly to a user destination. Collection contents are never executed.

Current default safety limits are defined centrally in `electron/pigeon-collection.js` and can be tightened by callers.

## Open and import behavior

Opening only inspects and verifies. It does not extract or alter a portfolio. The viewer presents integrity status and lets the user import all or selected valid entries. Import uses Pigeon's managed local-import workflow and ordinary filename-conflict behavior.

## Versioning

Version 1 readers accept unknown optional properties but reject unknown future `formatVersion` values with a clear newer-version message. Any incompatible schema or path-semantics change requires a new format version. Additive optional metadata does not.
