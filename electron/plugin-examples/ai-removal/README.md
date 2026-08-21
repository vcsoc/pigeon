# Pigeon AI Object Removal plugin

This plugin runs the **Simple LaMa ONNX** vision-inpainting model entirely on your computer. It is not an LLM. The model reconstructs the region painted in the Image Editor while Pigeon keeps the original source unchanged.

## Model

- Model: Simple LaMa ONNX (`lama_fp32.onnx`)
- Purpose: object removal and background reconstruction
- Download size: approximately 200 MB
- Runtime: ONNX Runtime on the CPU
- Source: Carve/LaMa-ONNX on Hugging Face, Apache-2.0
- Network behavior: only model setup downloads the model; image processing stays local

Plugin Manager shows whether the model is downloaded and ready.

## Install and enable

1. Open **Plugin Manager…** from Pigeon’s main menu.
2. Select **AI Object Removal** and choose **Download & install**.
3. Keep Python set to `auto`, or provide a Python 3.10/3.11 executable.
4. Choose **Set up dependencies and model**. Pigeon creates a private `.venv`, installs ONNX Runtime, downloads the model, and validates it.
5. Choose **Enable**. Pigeon starts and stops the loopback service automatically.

The service binds only to `127.0.0.1` and uses the configured port.

## Use

1. Choose **Edit image…**.
2. Select **AI remove**.
3. Hold the left mouse button and paint over the complete object.
4. Choose **Remove object**.
5. **Accept result**, **Retry**, or **Discard**.

Accepted results become Pigeon-managed PNG derivatives. LRPREV, SNAGX, PSD, Affinity, and other source containers remain untouched.

## Endpoint contract

Pigeon sends `POST /inpaint` with local `sourcePath`, `maskPath`, and `outputPath` fields. A successful plugin writes a PNG to `outputPath` and returns HTTP 200. Remote endpoints are rejected.
