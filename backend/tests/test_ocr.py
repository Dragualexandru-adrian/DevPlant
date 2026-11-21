import io

import numpy as np
import pytest
from PIL import Image
from sqlmodel import Session

from app import ocr
from app.main import app
from app.models import DrugCatalog
from app.ocr import OcrUnavailable, group_into_lines, load_image
from app.routers.ocr import ocr_engine


def _box(x0, y0, x1, y1):
    return np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])


def _png(width=200, height=100, exif_rotate=False) -> bytes:
    img = Image.new("RGB", (width, height), "white")
    buf = io.BytesIO()
    if exif_rotate:
        exif = Image.Exif()
        exif[0x0112] = 6  # Orientation: rotate 90 CW
        img.save(buf, format="JPEG", exif=exif)
    else:
        img.save(buf, format="PNG")
    return buf.getvalue()


class FakeEngine:
    def __init__(self, lines):
        self.lines = lines
        self.seen_shape = None

    def read_lines(self, image):
        self.seen_shape = image.shape
        return self.lines


@pytest.fixture
def use_engine():
    def _use(engine):
        app.dependency_overrides[ocr_engine] = lambda: engine
        return engine

    return _use


def test_group_into_lines_restores_reading_order():
    words = [
        ("mg", _box(130, 52, 160, 68)),
        ("paracetamol", _box(10, 10, 120, 30)),
        ("500", _box(80, 50, 120, 70)),
        ("zentiva", _box(10, 100, 90, 120)),
    ]
    assert group_into_lines(words) == ["paracetamol", "500 mg", "zentiva"]


def test_group_into_lines_empty():
    assert group_into_lines([]) == []


def test_load_image_downscales_and_applies_exif_rotation():
    pixels = load_image(_png(4000, 1000), max_side=1000)
    assert pixels.shape == (250, 1000, 3)
    rotated = load_image(_png(400, 100, exif_rotate=True), max_side=1000)
    assert rotated.shape[:2] == (400, 100)  # portrait after EXIF transpose


def test_load_image_rejects_garbage():
    with pytest.raises(ValueError, match="imagine"):
        load_image(b"not an image")


def test_scan_returns_lines_and_catalog_matches(client, engine, use_engine):
    with Session(engine) as session:
        session.add(DrugCatalog(name="NUROFEN 200 mg", dci="IBUPROFENUM", leaflet_url="http://anm/PRO_2.pdf"))
        session.add(DrugCatalog(name="ASPENTER 75 mg", dci="ACIDUM ACETYLSALICYLICUM"))
        session.commit()
    fake = use_engine(FakeEngine(["reckitt", "nurofen", "200 mg"]))

    resp = client.post("/ocr/scan", files={"image": ("box.png", _png(), "image/png")})

    assert resp.status_code == 200
    body = resp.json()
    assert body["lines"] == ["reckitt", "nurofen", "200 mg"]
    assert body["matches"][0]["entry"]["name"] == "NUROFEN 200 mg"
    assert fake.seen_shape == (100, 200, 3)


def test_scan_rejects_non_image(client, use_engine):
    use_engine(FakeEngine([]))
    resp = client.post("/ocr/scan", files={"image": ("x.txt", b"hello", "text/plain")})
    assert resp.status_code == 400


def test_scan_returns_503_when_tensorflow_unavailable(client, monkeypatch):
    def unavailable():
        raise OcrUnavailable("TensorFlow blocat")

    monkeypatch.setattr("app.routers.ocr.get_ocr_engine", unavailable)
    resp = client.post("/ocr/scan", files={"image": ("box.png", _png(), "image/png")})
    assert resp.status_code == 503
    assert "TensorFlow" in resp.json()["detail"]


def test_get_ocr_engine_caches_import_failure(monkeypatch):
    attempts = []

    class Broken:
        def __init__(self):
            attempts.append(1)
            raise OcrUnavailable("no tf")

    monkeypatch.setattr(ocr, "KerasOcrEngine", Broken)
    monkeypatch.setattr(ocr, "_engine", None)
    monkeypatch.setattr(ocr, "_engine_error", None)
    for _ in range(2):
        with pytest.raises(OcrUnavailable):
            ocr.get_ocr_engine()
    assert len(attempts) == 1
