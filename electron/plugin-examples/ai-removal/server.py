"""Pigeon AI Object Removal — loopback-only LaMa ONNX service."""
import os
import sys
import urllib.request
from pathlib import Path

import numpy as np
import onnxruntime as ort
from flask import Flask, jsonify, request
from PIL import Image

MODEL_URL = "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx"
MODEL_BYTES_LIMIT = 260 * 1024 * 1024
ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "lama_fp32.onnx"
MODEL_READY = ROOT / ".model-ready"
app = Flask(__name__)
session = None


def download_model():
    """Download the fixed 512px LaMa ONNX model without loading user images."""
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists() and 150 * 1024 * 1024 < MODEL_PATH.stat().st_size < MODEL_BYTES_LIMIT:
        return
    partial = MODEL_PATH.with_suffix(".partial")
    partial.unlink(missing_ok=True)
    request_headers = {"User-Agent": "Pigeon-AI-Removal/1.1"}
    with urllib.request.urlopen(urllib.request.Request(MODEL_URL, headers=request_headers), timeout=60) as response, partial.open("wb") as target:
        total = 0
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MODEL_BYTES_LIMIT:
                raise RuntimeError("Downloaded model exceeded the safety limit")
            target.write(chunk)
    if partial.stat().st_size < 150 * 1024 * 1024:
        partial.unlink(missing_ok=True)
        raise RuntimeError("The downloaded model is incomplete")
    partial.replace(MODEL_PATH)


def load_model():
    global session
    if session is None:
        if not MODEL_PATH.exists():
            raise RuntimeError("Simple LaMa model is not downloaded; run model setup in Pigeon Plugin Manager")
        session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    return session


def prepare_model():
    download_model()
    loaded = load_model()
    inputs = loaded.get_inputs()
    if len(inputs) < 2:
        raise RuntimeError("The downloaded LaMa model has an unexpected input contract")
    MODEL_READY.write_text(f"Simple LaMa ONNX ready: {MODEL_PATH.stat().st_size} bytes\n", encoding="utf-8")


def run_inpainting(image, mask):
    original_size = image.size
    model_image = image.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
    original_mask = mask.convert("L").resize(original_size, Image.Resampling.LANCZOS).point(lambda value: 255 if value > 16 else 0)
    model_mask = original_mask.resize((512, 512), Image.Resampling.NEAREST)
    image_tensor = np.asarray(model_image, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
    mask_tensor = (np.asarray(model_mask, dtype=np.float32)[None, None] > 16).astype(np.float32)
    loaded = load_model()
    inputs = loaded.get_inputs()
    feed = {item.name: (mask_tensor if "mask" in item.name.lower() else image_tensor) for item in inputs}
    result = loaded.run(None, feed)[0][0]
    result = np.clip(result.transpose(1, 2, 0), 0, 255).astype(np.uint8)
    generated = Image.fromarray(result, mode="RGB").resize(original_size, Image.Resampling.LANCZOS)
    return Image.composite(generated, image.convert("RGB"), original_mask)


@app.get("/health")
def health():
    return jsonify({"ok": True, "model": "Simple LaMa ONNX", "modelReady": MODEL_READY.exists() and MODEL_PATH.exists()})


@app.post("/inpaint")
def inpaint():
    try:
        payload = request.get_json(force=True, silent=False)
        source = Path(payload["sourcePath"]).resolve(strict=True)
        mask_path = Path(payload["maskPath"]).resolve(strict=True)
        output = Path(payload["outputPath"]).resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        image = Image.open(source).convert("RGB")
        mask = Image.open(mask_path).convert("L")
        result = run_inpainting(image, mask)
        result.save(output, format="PNG")
        return jsonify({"ok": True, "width": result.width, "height": result.height, "model": "Simple LaMa ONNX"})
    except Exception as error:
        app.logger.exception("Inpainting failed")
        return jsonify({"ok": False, "error": str(error)}), 500


if __name__ == "__main__":
    if "--prepare-model" in sys.argv:
        prepare_model()
        print(f"Simple LaMa ONNX model is ready at {MODEL_PATH}")
        raise SystemExit(0)
    # Load before reporting healthy so Pigeon never labels an unusable service as running.
    load_model()
    # Never expose the local editing model to the LAN.
    app.run(host="127.0.0.1", port=int(os.environ.get("PIGEON_AI_REMOVAL_PORT", "8765")), debug=False, threaded=False)
