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

## Firefox package and installation

The Firefox build uses the same popup, drag-and-drop panel, right-click media/link actions, and YouTube format, quality, thumbnail, and chapter options as Chrome. It uses Firefox's Manifest V3 background scripts instead of a Chromium service worker.

`npm run extensions:build` also produces `release/browser-extensions/Pigeon-2.2.0-firefox-unsigned.xpi`, with `manifest.json` at the archive root.

For local testing:

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on** and select the XPI (or `release/browser-extensions/firefox/manifest.json`).
3. Allow the extension to run on the websites you want to capture. In Firefox versions that do not grant Manifest V3 host permissions during installation, enable site access from the extension's permissions/settings.
4. Keep Pigeon desktop running, reload the webpage, then drag media, use the right-click menu, or open the toolbar popup.

Temporary add-ons are removed when Firefox restarts. The unsigned XPI is **not** a permanently installable release: submit it to Mozilla Add-ons for signing (listed or unlisted distribution), then install the returned signed XPI through `about:addons` → gear menu → **Install Add-on From File**. No signing credentials are stored in this repository.

Firefox restricts content scripts on internal pages and protected Mozilla sites. Test on an ordinary HTTP(S) webpage. Captures send only the chosen URL, page title, and download options to the locally running Pigeon app; there is no extension telemetry.

## Supported page media

The drag capture recognizes `<img>`, `<picture>`, `<video>`, `<source>`, direct media links, and CSS background images that expose an HTTP(S) source. Browser-generated `blob:`, `data:`, DRM-protected, canvas-only, and authentication-isolated streams do not expose a reusable original URL and cannot be handed to the desktop app by a permission-minimal extension.
