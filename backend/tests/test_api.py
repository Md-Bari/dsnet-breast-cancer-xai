"""API tests using a stub model, so they run without a deep-learning backend."""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.model_service import Explanation, Prediction, overlay_heatmap


class FakeModel:
    def __init__(self, probs):
        self.probs = probs

    def predict(self, rgb):
        cam = np.zeros((224, 224), dtype=np.float32)
        cam[50:150, 50:150] = 1.0
        heat, overlay = overlay_heatmap(rgb, cam)
        idx = int(np.argmax(self.probs))
        return Prediction(
            probabilities=list(self.probs),
            class_index=idx,
            confidence=float(self.probs[idx]),
            inference_ms=12.3,
            explanation=Explanation(original=rgb, heatmap=heat, overlay=overlay, cam=cam),
        )


@pytest.fixture
def client():
    from app.main import app, get_model_service

    with TestClient(app) as c:
        c.app = app
        yield c
    app.dependency_overrides.clear()


def use_model(client, probs):
    from app.main import get_model_service

    client.app.dependency_overrides[get_model_service] = lambda: FakeModel(probs)


def test_health_reports_degraded_without_model(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["model_loaded"] is False
    assert r.json()["status"] == "degraded"


def test_predict_returns_503_without_model(client, png_bytes):
    r = client.post("/api/v1/predict", files={"file": ("x.png", png_bytes, "image/png")})
    assert r.status_code == 503


def test_model_card(client):
    card = client.get("/api/v1/model").json()
    assert card["parameters"]["total"] == 1312194
    assert len(card["folds"]) == 5
    assert 0 < card["confidence_threshold"] < 1


def test_predict_malignant_and_history_roundtrip(client, png_bytes):
    use_model(client, [0.02, 0.98])
    r = client.post("/api/v1/predict", files={"file": ("slide.png", png_bytes, "image/png")})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["label"] == "Malignant"
    assert body["image_size"] == [460, 300]
    for url in body["explanation"].values():
        assert client.get(url).status_code == 200

    assert client.get(f"/api/v1/predictions/{body['id']}").json()["id"] == body["id"]
    page = client.get("/api/v1/predictions", params={"label": "Malignant"}).json()
    assert any(item["id"] == body["id"] for item in page["items"])
    assert client.get("/api/v1/predictions/stats").json()["total"] >= 1

    assert client.delete(f"/api/v1/predictions/{body['id']}").status_code == 204
    assert client.get(f"/api/v1/predictions/{body['id']}").status_code == 404


def test_low_confidence_is_inconclusive(client, png_bytes):
    use_model(client, [0.6, 0.4])
    body = client.post("/api/v1/predict", files={"file": ("a.png", png_bytes, "image/png")}).json()
    assert body["label"] == "Inconclusive"
    assert body["predicted_class"] == "Benign"


def test_rejects_non_image(client):
    use_model(client, [0.9, 0.1])
    r = client.post("/api/v1/predict", files={"file": ("a.png", b"not an image", "image/png")})
    assert r.status_code == 422


def test_rejects_wrong_content_type(client):
    use_model(client, [0.9, 0.1])
    r = client.post("/api/v1/predict", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 415


def test_samples_parse_breakhis_names(client):
    samples = client.get("/api/v1/samples").json()
    assert samples, "expected bundled sample images"
    for s in samples:
        expected = "Benign" if "_B_" in s["name"] else "Malignant"
        assert s["ground_truth"] == expected
        assert client.get(s["url"]).status_code == 200
