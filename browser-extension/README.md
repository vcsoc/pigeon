# Pigeon browser extension

Drag an HTTP(S) image or video on a webpage and Pigeon displays a dimmed drop panel. Dropping posts the media URL directly to Pigeon’s loopback-only capture endpoint and downloads the original into the active portfolio’s managed imports directory, with its reference placed in the virtual **Downloads** collection. Pigeon must already be running; the extension never launches an external-protocol prompt.

No cloud service, account, native-messaging permission, browsing-history permission, or remote Pigeon server is used.

## Build all browser packages

```sh
npm run extensions:build
```

This creates ready-to-load packages under `release/browser-extensions/` for:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Apple Safari
- Brave
- Opera
- Vivaldi

Chrome, Edge, Brave, Opera, and Vivaldi share the Chromium Manifest V3 package. Firefox receives its compatible background-script manifest. Safari receives WebExtension sources and requires Apple’s wrapper/signing step on macOS:

```sh
xcrun safari-web-extension-converter release/browser-extensions/safari
```

## Load for development

- **Chrome:** `chrome://extensions` → Developer mode → Load unpacked → `release/browser-extensions/chrome`
- **Edge:** `edge://extensions` → Developer mode → Load unpacked → `release/browser-extensions/edge`
- **Brave:** `brave://extensions` → Developer mode → Load unpacked → `release/browser-extensions/brave`
- **Opera:** `opera://extensions` → Developer mode → Load unpacked → `release/browser-extensions/opera`
- **Vivaldi:** `vivaldi://extensions` → Developer mode → Load unpacked → `release/browser-extensions/vivaldi`
- **Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → choose the Firefox `manifest.json`
- **Safari:** convert the Safari package with Xcode, select the generated app and extension targets, set a signing team, then enable it in Safari → Settings → Extensions.

```
c:\.vcsoc\projects\pigeon\release\browser-extensions\
```

Pigeon desktop must be open while capturing. Communication stays on `127.0.0.1`; when Pigeon is closed, the extension reports that it could not connect rather than showing a browser external-application prompt.

## Supported page media

The drag capture recognizes `<img>`, `<picture>`, `<video>`, `<source>`, direct media links, and CSS background images that expose an HTTP(S) source. Browser-generated `blob:`, `data:`, DRM-protected, canvas-only, and authentication-isolated streams do not expose a reusable original URL and cannot be handed to the desktop app by a permission-minimal extension.
