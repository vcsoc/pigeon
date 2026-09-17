"""Run with the private plugin Python and a previously downloaded U2Net-P model."""
import importlib.util
import json
import shutil
import sys
import tempfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

with tempfile.TemporaryDirectory(prefix='pigeon-background-check-') as directory:
    root = Path(directory)
    helper = root / 'background_removal.py'
    shutil.copyfile(Path(__file__).resolve().parents[2] / 'electron/plugin-examples/ai-removal/background_removal.py', helper)
    (root / 'models').mkdir()
    shutil.copyfile(sys.argv[1], root / 'models/u2netp.onnx')
    spec = importlib.util.spec_from_file_location('background_check', helper)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    image = Image.new('RGBA', (128, 128), 'white')
    draw = ImageDraw.Draw(image)
    draw.ellipse((35, 10, 93, 70), fill=(180, 90, 30, 255))
    draw.rectangle((42, 60, 87, 120), fill=(20, 80, 180, 255))
    draw.rectangle((0, 0, 8, 127), fill=(255, 255, 255, 0))
    before = np.asarray(image).copy()
    output = module.remove_background(image)
    after = np.asarray(output)
    assert output.mode == 'RGBA' and output.size == image.size
    assert np.array_equal(before[:, :, :3], after[:, :, :3])
    assert np.all(after[:, :, 3] <= before[:, :, 3])
    assert np.array_equal(before, np.asarray(image))
    assert int(after[80:110, 50:80, 3].mean()) > int(after[10:100, 110:120, 3].mean())
    print(json.dumps({'mode': output.mode, 'unchangedRGB': True, 'originalUnchanged': True,
                      'existingTransparencyPreserved': True,
                      'foregroundAlpha': float(after[80:110, 50:80, 3].mean()),
                      'backgroundAlpha': float(after[10:100, 110:120, 3].mean())}))
