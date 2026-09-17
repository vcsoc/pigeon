"""Local U2Net-P segmentation. Only model weights are downloaded, never images."""
import hashlib
import os
import tempfile
import time
import urllib.request
from pathlib import Path
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageChops

URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx'
SHA256 = '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8'
LIMIT = 8 * 1024 * 1024
_session = None

def model_path():
    target = Path(__file__).resolve().parent / 'models' / 'u2netp.onnx'
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and target.stat().st_size <= LIMIT and hashlib.sha256(target.read_bytes()).hexdigest() == SHA256:
        return target
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, prefix='u2netp-', suffix='.partial', delete=False) as output:
            temporary = Path(output.name)
            digest = hashlib.sha256()
            total = 0
            deadline = time.monotonic() + 60
            with urllib.request.urlopen(URL, timeout=20) as response:
                while True:
                    if time.monotonic() >= deadline:
                        raise TimeoutError('Background model download timed out; retry when the connection improves')
                    chunk = response.read1(65536)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > LIMIT:
                        raise RuntimeError('Background model exceeded its download limit')
                    digest.update(chunk)
                    output.write(chunk)
            if digest.hexdigest() != SHA256:
                raise RuntimeError('Background model checksum failed; retry with a reliable connection')
        os.replace(temporary, target)
        return target
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)

def remove_background(image):
    global _session
    if image.width * image.height > 80 * 1024 * 1024:
        raise RuntimeError('Background removal is limited to 80 megapixels')
    if _session is None:
        options = ort.SessionOptions()
        options.intra_op_num_threads = min(4, os.cpu_count() or 1)
        options.inter_op_num_threads = 1
        _session = ort.InferenceSession(str(model_path()), sess_options=options, providers=['CPUExecutionProvider'])
    rgba = image.convert('RGBA')
    array = np.asarray(rgba.convert('RGB').resize((320, 320), Image.Resampling.LANCZOS), dtype=np.float32)
    array /= max(float(array.max()), 1.0)
    array = (array - np.array([.485, .456, .406], dtype=np.float32)) / np.array([.229, .224, .225], dtype=np.float32)
    tensor = array.transpose(2, 0, 1)[None]
    prediction = _session.run(None, {_session.get_inputs()[0].name: tensor})[0][0, 0]
    low, high = float(prediction.min()), float(prediction.max())
    if not np.isfinite(prediction).all() or high - low < 1e-6:
        raise RuntimeError('No clear foreground was detected. Try a different image.')
    mask = Image.fromarray(np.clip((prediction - low) / (high - low) * 255, 0, 255).astype(np.uint8)).resize(rgba.size, Image.Resampling.LANCZOS)
    rgba.putalpha(ImageChops.multiply(rgba.getchannel('A'), mask))
    return rgba
