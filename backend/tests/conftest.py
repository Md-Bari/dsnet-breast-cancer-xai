import io
import os
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

# Must be set before app.config.get_settings() is first called.
os.environ["DSNET_DATA_DIR"] = tempfile.mkdtemp(prefix="dsnet-test-")
os.environ["DSNET_LOAD_MODEL_ON_STARTUP"] = "false"


@pytest.fixture
def png_bytes():
    rng = np.random.default_rng(0)
    img = rng.integers(0, 255, (300, 460, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return io.BytesIO(buf.tobytes())
