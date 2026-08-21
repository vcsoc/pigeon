# Pigeon AI Removal plugin

This optional plugin runs the **Simple LaMa** image-inpainting model entirely on your computer. Pigeon sends it a rendered source image and the mask painted in the Image Editor. The original file is never modified.

## Install

1. Install Python 3.10 or 3.11.
2. Open a terminal in this folder.
3. Create an isolated environment:

   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

4. Start the plugin whenever you want to use AI Removal:

   ```powershell
   .venv\Scripts\python.exe server.py
   ```

The first run downloads the local LaMa model. The service binds only to `127.0.0.1:8765`.

## Use

1. In Pigeon, choose **Edit image…**.
2. Select **AI remove**.
3. Paint over the object and choose **Remove object**.
4. **Accept result**, **Retry**, or **Discard**.

Accepted results become Pigeon-managed PNG derivatives. Container sources such as LRPREV, SNAGX, PSD, and Affinity documents remain untouched.

## Endpoint contract

Pigeon sends `POST /inpaint` with local `sourcePath`, `maskPath`, and `outputPath` fields. A successful plugin writes a PNG to `outputPath` and returns HTTP 200. This makes it possible to replace Simple LaMa with another local inpainting model while retaining the same UI workflow.
