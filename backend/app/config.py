"""Application settings, overridable through environment variables (prefix ``DSNET_``)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DSNET_", env_file=".env", extra="ignore")

    app_name: str = "DS-Net Histopathology API"
    version: str = "1.0.0"

    model_path: Path = BASE_DIR / "models" / "Ds-Net-p3-final_fold5_best.h5"
    load_model_on_startup: bool = True
    class_names: list[str] = ["Benign", "Malignant"]
    img_size: int = 224
    # A two-class softmax always has max(p) >= 0.5, so the old 0.5 cut-off never fired.
    # Predictions whose top probability falls below this value are flagged "Inconclusive".
    confidence_threshold: float = 0.75

    data_dir: Path = BASE_DIR / "data"
    samples_dir: Path = BASE_DIR / "samples"
    max_upload_mb: int = 10
    allowed_content_types: list[str] = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/tiff",
        "image/bmp",
        "image/webp",
    ]

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @property
    def results_dir(self) -> Path:
        return self.data_dir / "results"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "predictions.db"


@lru_cache
def get_settings() -> Settings:
    return Settings()
