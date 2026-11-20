"""Prediction history: SQLite metadata plus PNG artefacts on disk."""

from __future__ import annotations

import shutil
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import cv2
import numpy as np

SCHEMA = """
CREATE TABLE IF NOT EXISTS predictions (
    id              TEXT PRIMARY KEY,
    created_at      TEXT NOT NULL,
    filename        TEXT NOT NULL,
    label           TEXT NOT NULL,
    predicted_class TEXT NOT NULL,
    confidence      REAL NOT NULL,
    prob_benign     REAL NOT NULL,
    prob_malignant  REAL NOT NULL,
    inference_ms    REAL NOT NULL,
    threshold       REAL NOT NULL,
    width           INTEGER NOT NULL,
    height          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_predictions_created ON predictions(created_at DESC);
"""

ARTEFACTS = ("original", "heatmap", "overlay")


class PredictionStore:
    def __init__(self, db_path: Path, results_dir: Path):
        self.db_path = db_path
        self.results_dir = results_dir
        self._lock = threading.Lock()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        results_dir.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(SCHEMA)

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def save_images(self, prediction_id: str, images: dict[str, np.ndarray]) -> None:
        folder = self.results_dir / prediction_id
        folder.mkdir(parents=True, exist_ok=True)
        for name, rgb in images.items():
            cv2.imwrite(str(folder / f"{name}.png"), cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))

    def insert(self, record: dict[str, Any]) -> None:
        cols = ", ".join(record)
        marks = ", ".join("?" for _ in record)
        with self._lock, self._connect() as conn:
            conn.execute(f"INSERT INTO predictions ({cols}) VALUES ({marks})", tuple(record.values()))

    def get(self, prediction_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM predictions WHERE id = ?", (prediction_id,)).fetchone()
        return dict(row) if row else None

    def list(self, limit: int, offset: int, label: str | None = None) -> tuple[list[dict], int]:
        where, args = ("WHERE label = ?", [label]) if label else ("", [])
        with self._connect() as conn:
            total = conn.execute(f"SELECT COUNT(*) FROM predictions {where}", args).fetchone()[0]
            rows = conn.execute(
                f"SELECT * FROM predictions {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                [*args, limit, offset],
            ).fetchall()
        return [dict(r) for r in rows], total

    def delete(self, prediction_id: str) -> bool:
        with self._lock, self._connect() as conn:
            cur = conn.execute("DELETE FROM predictions WHERE id = ?", (prediction_id,))
        shutil.rmtree(self.results_dir / prediction_id, ignore_errors=True)
        return cur.rowcount > 0

    def stats(self) -> dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute(
                """SELECT COUNT(*) AS total,
                          COALESCE(AVG(confidence), 0) AS avg_confidence,
                          COALESCE(AVG(inference_ms), 0) AS avg_inference_ms
                   FROM predictions"""
            ).fetchone()
            by_label = conn.execute("SELECT label, COUNT(*) FROM predictions GROUP BY label").fetchall()
        return {
            "total": row["total"],
            "avg_confidence": round(row["avg_confidence"], 4),
            "avg_inference_ms": round(row["avg_inference_ms"], 1),
            "by_label": {label: count for label, count in by_label},
        }
