from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session

from app.catalog import match_ocr_lines
from app.db import get_session
from app.ocr import OcrEngine, OcrUnavailable, get_ocr_engine, load_image
from app.routers.catalog import CatalogMatch

router = APIRouter(prefix="/ocr", tags=["ocr"])

MAX_UPLOAD_BYTES = 15 * 1024 * 1024


class ScanResult(BaseModel):
    lines: list[str]
    matches: list[CatalogMatch]


def ocr_engine() -> OcrEngine:
    try:
        return get_ocr_engine()
    except OcrUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/scan", response_model=ScanResult)
def scan_label(
    image: UploadFile = File(...),
    session: Session = Depends(get_session),
    engine: OcrEngine = Depends(ocr_engine),
):
    """Photo of a medicine box -> text lines (keras-ocr) -> best catalog matches.

    The app shows the matches and the user confirms one; nothing is picked automatically.
    """
    data = image.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Imaginea este prea mare (max. 15 MB).")
    try:
        pixels = load_image(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    lines = engine.read_lines(pixels)
    matches = [CatalogMatch(entry=e, score=s) for e, s in match_ocr_lines(session, lines)]
    return ScanResult(lines=lines, matches=matches)
