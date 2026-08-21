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
3. Pigeon finds Python 3.10/3.11, creates a private environment, installs dependencies, downloads the model, and validates it.
4. Choose **Enable**. Pigeon waits for the model service to become healthy before reporting it as running.

Keep Python set to `auto` unless automatic discovery fails. Setup can use the Windows Python launcher, `uv`, or a configured Python 3.10/3.11 executable. If a download is interrupted, choose **Resume setup**. You may also choose **Import ONNX…** and select an existing `lama_fp32.onnx`, then validate it.

Use **Test service**, **Repair runtime & model**, **Remove model**, **Open managed files**, and the setup/service log to diagnose and manage the installation. Legacy `AI Removal` plugin directories are migrated to managed storage without deleting the old directory.

## Use in the Image Editor

1. Open a supported image in **Edit image…**.
2. Select **AI remove**. The editor reports whether the local model is ready.
3. Hold the left mouse button and paint over the entire object.
4. Choose **Remove object**.
5. Choose **Accept result**, **Retry**, or **Discard**.

Pigeon automatically restarts an enabled service if it stopped. Accepted results become Pigeon-managed PNG derivatives. The source file and source containers such as LRPREV, SNAGX, PSD, and Affinity remain unchanged.

## Endpoint contract

The managed service binds only to `127.0.0.1`. Pigeon sends `POST /inpaint` with local `sourcePath`, `maskPath`, and `outputPath` fields. A successful plugin writes a PNG to `outputPath` and returns HTTP 200. Remote endpoints are rejected.
