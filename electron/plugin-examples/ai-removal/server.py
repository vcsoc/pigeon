"""Pigeon local AI Removal plugin.

Runs a loopback-only HTTP service backed by Simple LaMa. The model is loaded once
and all image paths are supplied by the local Pigeon desktop process.
"""
from pathlib import Path
from flask import Flask, jsonify, request
from PIL import Image
from simple_lama_inpainting import SimpleLama

app = Flask(__name__)
model = SimpleLama()


@app.post("/inpaint")
def inpaint():
    payload = request.get_json(force=True, silent=False)
    source = Path(payload["sourcePath"]).resolve(strict=True)
    mask_path = Path(payload["maskPath"]).resolve(strict=True)
    output = Path(payload["outputPath"]).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    image = Image.open(source).convert("RGB")
    mask = Image.open(mask_path).convert("L").resize(image.size, Image.Resampling.LANCZOS)
    # Pigeon paints selected pixels white; LaMa expects a binary white mask.
    mask = mask.point(lambda value: 255 if value > 16 else 0)
    result = model(image, mask)
    result.save(output, format="PNG")
    return jsonify({"ok": True, "width": result.width, "height": result.height})


if __name__ == "__main__":
    # Never expose a local editing model to the LAN.
    app.run(host="127.0.0.1", port=8765, debug=False)
