# Pigeon AI Object Removal plugin

This plugin runs the **Simple LaMa ONNX** vision-inpainting model entirely on your computer. It is a vision model, **not an LLM**, so it does not need an account, API key, prompt, or cloud provider.

## Managed model

- Model: Simple LaMa ONNX (`lama_fp32.onnx`)
- Purpose: object removal and background reconstruction
- Download size: 198 MB (208,044,816 bytes)
- Runtime: ONNX Runtime on the CPU
- Source: Carve/LaMa-ONNX on Hugging Face
- License: Apache-2.0
- Network behavior: setup downloads dependencies and the model; source images and masks stay local

Plugin Manager manages the model, private Python environment, setup progress, partial-download resume, validation, service health, configuration, repair, local ONNX import, model removal, and uninstall.

## Install and enable

1. Open **Plugin Manager…** and select **AI Object Removal**.
2. Choose **Install & set up automatically**.
3. Pigeon finds Python 3.10/3.11 or installs managed Python 3.11 with `uv`, creates a private environment, installs dependencies, downloads the model, and validates it. Your default/system Python is not replaced.
4. Choose **Enable**. Pigeon waits for the model service to become healthy before reporting it as running.

Keep Python set to `auto` unless you deliberately want a specific executable. Setup checks the Windows Python launcher, `uv` (including common user-install locations), and compatible interpreters. If `uv` is missing, Pigeon can install it into private managed storage using an existing Python with pip. If neither is available, setup gives an actionable error rather than modifying system packages. Explicit incompatible executable overrides are not silently ignored. If a download is interrupted, choose **Resume setup**. You may also choose **Import ONNX…** and select an existing `lama_fp32.onnx`, then validate it.

Use **Test service**, **Repair runtime & model**, **Remove model**, **Open managed files**, and the setup/service log to diagnose and manage the installation. Legacy `AI Removal` plugin directories are migrated to managed storage without deleting the old directory.

## Use in the Image Editor

1. Open a supported image in **Edit image…**.
2. Select **AI remove**. The editor reports whether the local model is ready.
3. Hold the left mouse button and paint over the entire object.
4. Choose **Remove object**. First use automatically prepares the runtime and 198 MB model, then enables the local service. Setup progress is shown in the editor; open Plugin Manager to cancel it. Setup may continue if you close the editor, but its result cannot reopen or overwrite another editing session.
5. Choose **Accept result**, **Retry**, or **Discard**.

Pigeon automatically restarts an enabled service if it stopped, repairs missing dependencies/private runtimes, and retries a corrupt model once after preserving a backup. Incompatible environments are retained as `.venv.repair-*` backups. The model uses at most four CPU threads; first startup still takes several seconds. Accepted results become Pigeon-managed PNG derivatives. The source file and source containers such as LRPREV, SNAGX, PSD, and Affinity remain unchanged.

## Remove Background

Use the green **Remove Background** icon in the image editor. No painted mask is needed. This operates on the saved image/derivative: save any staged adjustments first. Review the transparent checkerboard preview, then **Accept result**, **Retry**, or **Discard**. Source files remain unchanged.

First use downloads the 4.5 MB **U2Net-P** foreground segmentation model (U²-Net/rembg distribution, Apache-2.0) over HTTPS. Its pinned SHA-256 is `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`. Downloads are size-limited, time-bounded, checked before atomic replacement, and retried on the next request after failure. Existing transparent/soft-alpha pixels are multiplied by the predicted mask; RGB channels remain unchanged. The maximum output is 80 megapixels. This lightweight model works best with a clear foreground subject; review fine edges before accepting.

## Endpoint contract

The managed service binds only to `127.0.0.1`. Pigeon sends `POST /inpaint` with local `sourcePath`, `maskPath`, and `outputPath` fields. Requests must use `application/json` without an `Origin` header; browser-originated requests are rejected before any filesystem access. A successful plugin writes a PNG to `outputPath` and returns HTTP 200. Remote endpoints are rejected.

## AI enlargement

**AI Image Enlarger** is also listed in Plugin Manager. It is bundled with Pigeon, needs no Python or separate installation, and runs a fresh CPU worker for each operation. **Test engine** performs a real small ONNX inference. Use the AI enlargement disclosure in the image editor for 2×/3× enlargement. Transparent images keep their alpha channel, including soft edges and whole-image rotation. The edited master is PNG; gallery thumbnails are only previews; new transparent thumbnails and edited previews preserve alpha. Missing or damaged bundled application files require repair/reinstallation of Pigeon, not a Python download.
