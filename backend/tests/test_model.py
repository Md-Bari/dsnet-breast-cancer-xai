"""Tests against the real DS-Net checkpoint. Skipped when TensorFlow is not installed."""

from pathlib import Path

import cv2
import numpy as np
import pytest

tf = pytest.importorskip("tensorflow")

from app.config import get_settings  # noqa: E402
from app.model_service import DSNetService  # noqa: E402

SAMPLES = Path(__file__).resolve().parent.parent / "samples"


@pytest.fixture(scope="module")
def service():
    return DSNetService(get_settings().model_path)


def load(path):
    return cv2.cvtColor(cv2.imread(str(path)), cv2.COLOR_BGR2RGB)


def test_probabilities_match_keras_predict(service):
    rgb = load(next(SAMPLES.glob("*.png")))
    pred = service.predict(rgb)
    ref = service.model.predict(service.preprocess(rgb), verbose=0)[0]
    np.testing.assert_allclose(pred.probabilities, ref, atol=1e-5)
    assert abs(sum(pred.probabilities) - 1) < 1e-5


@pytest.mark.parametrize("path", sorted(SAMPLES.glob("*.png")), ids=lambda p: p.stem)
def test_sample_classification(service, path):
    expected = 0 if "_B_" in path.name else 1
    assert service.predict(load(path)).class_index == expected


def test_closed_form_gradcam_matches_autodiff(service):
    """The analytic Grad-CAM must equal the classic GradientTape implementation."""
    rgb = load(next(SAMPLES.glob("*.png")))
    x = tf.convert_to_tensor(service.preprocess(rgb))
    pred = service.predict(rgb)
    c = pred.class_index

    # Gradient of the pre-softmax logit: rebuild it from the last Dense layer.
    last_dense = [l for l in service.model.layers if isinstance(l, tf.keras.layers.Dense)][-1]
    logits_model = tf.keras.Model(service.model.inputs, [service.target_layer, last_dense.input])
    with tf.GradientTape() as tape:
        fmap, hidden = logits_model(x, training=False)
        logit = tf.matmul(hidden, last_dense.kernel)[0, c] + last_dense.bias[c]
    grads = tape.gradient(logit, fmap)
    weights = tf.reduce_mean(grads, axis=(0, 1, 2)).numpy()
    cam = np.maximum(np.tensordot(fmap[0].numpy(), weights, axes=([2], [0])), 0)
    cam = cv2.resize(cam.astype(np.float32), (224, 224))
    cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

    np.testing.assert_allclose(pred.explanation.cam, cam, atol=1e-3)
