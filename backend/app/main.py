"""FastAPI application exposing DS-Net inference, Grad-CAM explanations and history."""

from __future__ import annotations

import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import Settings, get_settings
from .model_service import DSNetService, InvalidImageError, decode_image
from .schemas import (
    ClassProbability,
    ExplanationUrls,
    HealthStatus,
    HistoryStats,
    PredictionPage,
    PredictionResult,
    Sample,
)
from .storage import PredictionStore

logger = logging.getLogger("dsnet")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

MODEL_CARD_PATH = Path(__file__).with_name("model_card.json")

SUBTYPES = {
    "A": "Adenosis",
    "F": "Fibroadenoma",
    "PT": "Phyllodes tumor",
    "TA": "Tubular adenoma",
    "DC": "Ductal carcinoma",
    "LC": "Lobular carcinoma",
    "MC": "Mucinous carcinoma",
    "PC": "Papillary carcinoma",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.store = PredictionStore(settings.db_path, settings.results_dir)
    app.state.model_service = None
    app.state.model_error = None
    if settings.load_model_on_startup:
        try:
            logger.info("Loading model from %s", settings.model_path)
            app.state.model_service = DSNetService(settings.model_path, settings.img_size)
            logger.info("Model ready (%s parameters)", f"{app.state.model_service.param_count:,}")
        except Exception as exc:  # keep the API up so /health can report the problem
            logger.exception("Model failed to load")
            app.state.model_error = str(exc)
    yield


settings = get_settings()
settings.results_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=(
        "Breast cancer histopathology classification (Benign / Malignant) with the DS-Net "
        "residual-attention CNN and Grad-CAM visual explanations. Research use only."
    ),
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/media", StaticFiles(directory=settings.results_dir), name="media")
if settings.samples_dir.exists():
    app.mount("/sample-images", StaticFiles(directory=settings.samples_dir), name="samples")


# ---------------------------------------------------------------- dependencies
def get_store(request: Request) -> PredictionStore:
    return request.app.state.store


def get_model_service(request: Request) -> DSNetService:
    service = request.app.state.model_service
    if service is None:
        detail = request.app.state.model_error or "Model is not loaded."
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)
    return service


StoreDep = Annotated[PredictionStore, Depends(get_store)]
ModelDep = Annotated[DSNetService, Depends(get_model_service)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def to_result(row: dict) -> PredictionResult:
    pid = row["id"]
    return PredictionResult(
        id=pid,
        created_at=row["created_at"],
        filename=row["filename"],
        label=row["label"],
        predicted_class=row["predicted_class"],
        confidence=row["confidence"],
        threshold=row["threshold"],
        probabilities=[
            ClassProbability(label="Benign", probability=row["prob_benign"]),
            ClassProbability(label="Malignant", probability=row["prob_malignant"]),
        ],
        inference_ms=row["inference_ms"],
        image_size=(row["width"], row["height"]),
        explanation=ExplanationUrls(
            original=f"/media/{pid}/original.png",
            heatmap=f"/media/{pid}/heatmap.png",
            overlay=f"/media/{pid}/overlay.png",
        ),
    )


# ---------------------------------------------------------------- routes
@app.get("/", include_in_schema=False)
def root():
    return {"name": settings.app_name, "docs": "/docs", "health": "/api/v1/health"}


@app.get("/api/v1/health", response_model=HealthStatus, tags=["system"])
def health(request: Request):
    loaded = request.app.state.model_service is not None
    return HealthStatus(
        status="ok" if loaded else "degraded",
        model_loaded=loaded,
        model_error=request.app.state.model_error,
        version=settings.version,
    )


@app.get("/api/v1/model", tags=["model"])
def model_info(cfg: SettingsDep):
    card = json.loads(MODEL_CARD_PATH.read_text(encoding="utf-8"))
    card["confidence_threshold"] = cfg.confidence_threshold
    return card


@app.post(
    "/api/v1/predict",
    response_model=PredictionResult,
    status_code=status.HTTP_201_CREATED,
    tags=["inference"],
)
def predict(
    model: ModelDep,
    store: StoreDep,
    cfg: SettingsDep,
    file: UploadFile = File(..., description="Histopathology image (PNG, JPEG, TIFF, BMP, WebP)"),
):
    if file.content_type and file.content_type not in cfg.allowed_content_types:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"Unsupported file type: {file.content_type}"
        )
    max_bytes = cfg.max_upload_mb * 1024 * 1024
    data = file.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Max upload is {cfg.max_upload_mb} MB")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file.")

    try:
        rgb = decode_image(data)
    except InvalidImageError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    result = model.predict(rgb)
    predicted = cfg.class_names[result.class_index]
    label = predicted if result.confidence >= cfg.confidence_threshold else "Inconclusive"

    pid = uuid.uuid4().hex[:12]
    exp = result.explanation
    store.save_images(pid, {"original": exp.original, "heatmap": exp.heatmap, "overlay": exp.overlay})
    row = {
        "id": pid,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "filename": Path(file.filename or "upload").name[:200],
        "label": label,
        "predicted_class": predicted,
        "confidence": round(result.confidence, 6),
        "prob_benign": round(result.probabilities[0], 6),
        "prob_malignant": round(result.probabilities[1], 6),
        "inference_ms": result.inference_ms,
        "threshold": cfg.confidence_threshold,
        "width": int(rgb.shape[1]),
        "height": int(rgb.shape[0]),
    }
    store.insert(row)
    logger.info("Prediction %s: %s (%.2f%%)", pid, label, result.confidence * 100)
    return to_result(row)


@app.get("/api/v1/predictions", response_model=PredictionPage, tags=["history"])
def list_predictions(
    store: StoreDep,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    label: str | None = Query(None, pattern="^(Benign|Malignant|Inconclusive)$"),
):
    rows, total = store.list(limit, offset, label)
    return PredictionPage(items=[to_result(r) for r in rows], total=total, limit=limit, offset=offset)


@app.get("/api/v1/predictions/stats", response_model=HistoryStats, tags=["history"])
def prediction_stats(store: StoreDep):
    return store.stats()


@app.get("/api/v1/predictions/{prediction_id}", response_model=PredictionResult, tags=["history"])
def get_prediction(prediction_id: str, store: StoreDep):
    row = store.get(prediction_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prediction not found.")
    return to_result(row)


@app.delete(
    "/api/v1/predictions/{prediction_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["history"]
)
def delete_prediction(prediction_id: str, store: StoreDep):
    if not store.delete(prediction_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prediction not found.")


@app.get("/api/v1/samples", response_model=list[Sample], tags=["samples"])
def list_samples(cfg: SettingsDep):
    """BreakHis sample images. Filenames encode the label: SOB_<B|M>_<subtype>-<id>-<mag>-<seq>."""
    samples = []
    if not cfg.samples_dir.exists():
        return samples
    for path in sorted(cfg.samples_dir.iterdir()):
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp"}:
            continue
        parts = path.stem.split("_")
        if len(parts) < 3:
            continue
        code, rest = parts[1], parts[2].split("-")
        samples.append(
            Sample(
                name=path.name,
                url=f"/sample-images/{path.name}",
                ground_truth="Benign" if code == "B" else "Malignant",
                subtype=SUBTYPES.get(rest[0], rest[0]),
                magnification=f"{rest[3]}X" if len(rest) > 3 else "unknown",
            )
        )
    return samples
