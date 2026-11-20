from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ClassProbability(BaseModel):
    label: str
    probability: float = Field(ge=0, le=1)


class ExplanationUrls(BaseModel):
    original: str
    heatmap: str
    overlay: str


class PredictionResult(BaseModel):
    id: str
    created_at: datetime
    filename: str
    label: Literal["Benign", "Malignant", "Inconclusive"]
    predicted_class: Literal["Benign", "Malignant"]
    confidence: float
    threshold: float
    probabilities: list[ClassProbability]
    inference_ms: float
    image_size: tuple[int, int]
    explanation: ExplanationUrls


class PredictionPage(BaseModel):
    items: list[PredictionResult]
    total: int
    limit: int
    offset: int


class HistoryStats(BaseModel):
    total: int
    avg_confidence: float
    avg_inference_ms: float
    by_label: dict[str, int]


class HealthStatus(BaseModel):
    status: Literal["ok", "degraded"]
    model_loaded: bool
    model_error: str | None = None
    version: str


class Sample(BaseModel):
    name: str
    url: str
    ground_truth: Literal["Benign", "Malignant"]
    subtype: str
    magnification: str
