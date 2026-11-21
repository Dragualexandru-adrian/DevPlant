"""Label OCR with keras-ocr (TensorFlow): CRAFT text detector + CRNN recogniser.

TensorFlow is imported lazily on the first scan, so the rest of the backend runs
on machines without it (see requirements-ocr.txt; needs Python 3.11 for TF 2.15).
Callers depend on the OcrEngine interface via get_ocr_engine(), so tests (or a
different engine later) can be swapped in without touching the router.
"""

import io
import threading
from typing import Protocol

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from app import config


class OcrUnavailable(Exception):
    """OCR engine cannot run on this machine (TensorFlow/keras-ocr missing or blocked)."""


class OcrEngine(Protocol):
    def read_lines(self, image: np.ndarray) -> list[str]:
        """Text lines on the image, top to bottom."""
        ...


def load_image(data: bytes, max_side: int | None = None) -> np.ndarray:
    """Decode an uploaded photo to an RGB array, upright and scaled down."""
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img).convert("RGB")  # phones store rotation in EXIF
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Fișierul trimis nu este o imagine validă.") from exc
    max_side = max_side or config.OCR_MAX_SIDE
    img.thumbnail((max_side, max_side))
    return np.asarray(img)


def group_into_lines(words: list[tuple[str, np.ndarray]]) -> list[str]:
    """keras-ocr returns unordered (word, 4x2 box) pairs; rebuild reading order.

    Words whose vertical centre falls within half a word-height of the current
    line's centre join that line; each line is then read left to right.
    """
    items = []
    for text, box in words:
        box = np.asarray(box, dtype=float)
        ys, xs = box[:, 1], box[:, 0]
        items.append((text, (ys.min() + ys.max()) / 2, max(ys.max() - ys.min(), 1.0), xs.min()))
    items.sort(key=lambda it: it[1])

    lines: list[list[tuple]] = []
    for item in items:
        if lines:
            line = lines[-1]
            centre = sum(i[1] for i in line) / len(line)
            height = sum(i[2] for i in line) / len(line)
            if abs(item[1] - centre) <= height / 2:
                line.append(item)
                continue
        lines.append([item])
    return [" ".join(i[0] for i in sorted(line, key=lambda i: i[3])) for line in lines]


class KerasOcrEngine:
    def __init__(self) -> None:
        try:
            import keras_ocr  # heavy: pulls in TensorFlow
        # ImportError covers a missing package and a DLL blocked by Windows App
        # Control; keras-ocr's old deps can also fail at import with other errors.
        except Exception as exc:
            raise OcrUnavailable(
                "OCR indisponibil pe acest server: TensorFlow/keras-ocr nu poate fi încărcat "
                f"({exc}). Instalați requirements-ocr.txt pe Python 3.11."
            ) from exc
        # First run downloads the CRAFT + CRNN weights (~80 MB) to ~/.keras-ocr.
        self._pipeline = keras_ocr.pipeline.Pipeline()
        self._lock = threading.Lock()  # one TF graph, requests come from a thread pool

    def read_lines(self, image: np.ndarray) -> list[str]:
        with self._lock:
            predictions = self._pipeline.recognize([image])[0]
        return group_into_lines(predictions)


_engine: OcrEngine | None = None
_engine_error: OcrUnavailable | None = None
_engine_lock = threading.Lock()


def get_ocr_engine() -> OcrEngine:
    """FastAPI dependency: the shared engine, built on first use."""
    global _engine, _engine_error
    with _engine_lock:
        if _engine is None and _engine_error is None:
            try:
                _engine = KerasOcrEngine()
            except OcrUnavailable as exc:
                _engine_error = exc  # don't retry a blocked import on every request
        if _engine is None:
            raise _engine_error  # type: ignore[misc]
        return _engine
