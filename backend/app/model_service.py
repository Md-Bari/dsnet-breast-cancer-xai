"""DS-Net inference and Grad-CAM explanation.

Grad-CAM is computed in closed form. In DS-Net the last feature map ``A`` (h x w x K)
feeds GlobalAveragePooling -> Dense(128, ReLU) -> Dropout -> Dense(2). For the class
logit ``z_c`` the gradient with respect to the pooled vector ``g`` is

    dz_c/dg = W1 @ (1[W1^T g + b1 > 0] * W2[:, c])

and because ``g`` is a spatial mean, dz_c/dA_k(i, j) = (dz_c/dg_k) / (h*w). The Grad-CAM
channel weights are therefore exact and need no autodiff, so the service works with any
Keras 3 backend (TensorFlow, JAX, PyTorch).
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


class InvalidImageError(ValueError):
    """Raised when uploaded bytes cannot be decoded as an image."""


@dataclass
class Explanation:
    original: np.ndarray  # RGB uint8, original resolution
    heatmap: np.ndarray  # RGB uint8 (JET colormap), original resolution
    overlay: np.ndarray  # RGB uint8, original resolution
    cam: np.ndarray  # float32 in [0, 1], img_size x img_size


@dataclass
class Prediction:
    probabilities: list[float]
    class_index: int
    confidence: float
    inference_ms: float
    explanation: Explanation


def decode_image(data: bytes) -> np.ndarray:
    """Decode raw bytes into an RGB uint8 array."""
    buf = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None or img.size == 0:
        raise InvalidImageError("File could not be decoded as an image.")
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def softmax(z: np.ndarray) -> np.ndarray:
    e = np.exp(z - z.max())
    return e / e.sum()


def overlay_heatmap(rgb: np.ndarray, cam: np.ndarray, alpha: float = 0.45):
    """Resize a [0, 1] CAM to the image and blend a JET heatmap over it."""
    h, w = rgb.shape[:2]
    cam_full = cv2.resize(cam, (w, h), interpolation=cv2.INTER_CUBIC)
    cam_full = np.clip(cam_full, 0.0, 1.0)
    heat_bgr = cv2.applyColorMap(np.uint8(255 * cam_full), cv2.COLORMAP_JET)
    heat = cv2.cvtColor(heat_bgr, cv2.COLOR_BGR2RGB)
    blended = cv2.addWeighted(rgb, 1 - alpha, heat, alpha, 0)
    return heat, blended


class DSNetService:
    """Loads the trained Keras model once and serves thread-safe predictions."""

    def __init__(self, model_path: Path, img_size: int = 224):
        import keras  # imported lazily so the API module loads without a DL backend

        if not Path(model_path).exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")

        self.img_size = img_size
        self.model = keras.models.load_model(str(model_path), compile=False)
        self._lock = threading.Lock()

        gap = next(
            (l for l in self.model.layers if isinstance(l, keras.layers.GlobalAveragePooling2D)),
            None,
        )
        dense = [l for l in self.model.layers if isinstance(l, keras.layers.Dense)]
        if gap is None or len(dense) != 2:
            raise RuntimeError("Unexpected architecture: expected GAP -> Dense -> Dense head.")

        self.target_layer = gap.input
        self.feature_model = keras.Model(self.model.inputs, [gap.input, self.model.output])
        self.w1, self.b1 = (np.asarray(w, dtype=np.float32) for w in dense[0].get_weights())
        self.w2, self.b2 = (np.asarray(w, dtype=np.float32) for w in dense[1].get_weights())
        self.param_count = int(self.model.count_params())
        self.layer_count = len(self.model.layers)

        # Warm-up so the first real request is not slowed by graph tracing.
        self.feature_model(np.zeros((1, img_size, img_size, 3), dtype=np.float32), training=False)

    def preprocess(self, rgb: np.ndarray) -> np.ndarray:
        resized = cv2.resize(rgb, (self.img_size, self.img_size), interpolation=cv2.INTER_AREA)
        return (resized.astype(np.float32) / 255.0)[None, ...]

    def _grad_cam(self, features: np.ndarray, class_index: int) -> np.ndarray:
        """Exact Grad-CAM for the class logit (see module docstring)."""
        fmap = features[0]  # (h, w, K)
        pooled = fmap.mean(axis=(0, 1))  # (K,)
        hidden_active = (pooled @ self.w1 + self.b1) > 0  # ReLU mask, (128,)
        weights = self.w1 @ (hidden_active * self.w2[:, class_index])  # (K,)
        cam = np.maximum(np.tensordot(fmap, weights, axes=([2], [0])), 0)
        cam = cv2.resize(cam.astype(np.float32), (self.img_size, self.img_size))
        cam -= cam.min()
        return cam / (cam.max() + 1e-8)

    def predict(self, rgb: np.ndarray) -> Prediction:
        x = self.preprocess(rgb)
        start = time.perf_counter()
        with self._lock:
            features, probs = self.feature_model(x, training=False)
        features = np.asarray(features, dtype=np.float32)
        probs = np.asarray(probs, dtype=np.float32)[0]
        class_index = int(np.argmax(probs))
        cam = self._grad_cam(features, class_index)
        elapsed = (time.perf_counter() - start) * 1000

        heat, overlay = overlay_heatmap(rgb, cam)
        return Prediction(
            probabilities=[float(p) for p in probs],
            class_index=class_index,
            confidence=float(probs[class_index]),
            inference_ms=round(elapsed, 1),
            explanation=Explanation(original=rgb, heatmap=heat, overlay=overlay, cam=cam),
        )
