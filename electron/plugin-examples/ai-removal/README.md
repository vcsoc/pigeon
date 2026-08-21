# Pigeon AI Object Removal plugin

This optional plugin runs **Simple LaMa** entirely on your computer. Pigeon sends it a rendered source image and the mask painted in the Image Editor. The original file is never modified.

## Install and enable

1. Open **Plugin Manager…** from Pigeon’s main menu.
2. Select **AI Object Removal** and choose **Download & install**.
3. In Configuration, verify the Python executable and loopback endpoint.
4. Choose **Set up dependencies**. Pigeon creates a private `.venv` and installs the required local packages.
5. Choose **Enable**. Pigeon starts and stops the loopback service automatically.

The first service start may download the local LaMa model. The service binds only to `127.0.0.1` and uses the configured port.

## Use

1. In Pigeon, choose **Edit image…**.
2. Select **AI remove**.
3. Hold the left mouse button and paint over the object.
4. Choose **Remove object**.
5. **Accept result**, **Retry**, or **Discard**.

Accepted results become Pigeon-managed PNG derivatives. Container sources such as LRPREV, SNAGX, PSD, and Affinity documents remain untouched.

## Endpoint contract

Pigeon sends `POST /inpaint` with local `sourcePath`, `maskPath`, and `outputPath` fields. A successful plugin writes a PNG to `outputPath` and returns HTTP 200. Remote endpoints are rejected.
