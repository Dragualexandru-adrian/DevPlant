from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from pymongo.database import Database

from app import guidance as guidance_service
from app.catalog import match_ocr_lines, search
from app import db as store
from app.db import get_db
from app.leaflet import LeafletError
from app.models import DrugCatalog

router = APIRouter(prefix="/catalog", tags=["catalog"])


class CatalogMatch(BaseModel):
    entry: DrugCatalog
    score: float


class LinesIn(BaseModel):
    lines: list[str]
    limit: int = 5


def _get_entry(db: Database, entry_id: int) -> DrugCatalog:
    entry = store.get(db, DrugCatalog, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Medicamentul nu există în catalog")
    return entry


@router.get("/search", response_model=list[CatalogMatch])
def search_catalog(
    q: str = Query(min_length=2),
    limit: int = Query(default=10, ge=1, le=50),
    db: Database = Depends(get_db),
):
    return [CatalogMatch(entry=e, score=s) for e, s in search(db, q, limit)]


@router.post("/match", response_model=list[CatalogMatch])
def match_lines(payload: LinesIn, db: Database = Depends(get_db)):
    """Text read off a box on the phone (Tesseract.js) -> best ANM entries. The user confirms one."""
    lines = [line for line in payload.lines if line.strip()][:200]
    limit = max(1, min(payload.limit, 20))
    return [CatalogMatch(entry=e, score=s) for e, s in match_ocr_lines(db, lines, limit)]


@router.get("/{entry_id}", response_model=DrugCatalog)
def get_catalog_entry(entry_id: int, db: Database = Depends(get_db)):
    return _get_entry(db, entry_id)


@router.get("/{entry_id}/guidance")
def get_catalog_guidance(entry_id: int, db: Database = Depends(get_db)):
    """Short AI summary from the official leaflet: how to take it, dose interval, side effects."""
    entry = _get_entry(db, entry_id)
    try:
        return guidance_service.get_guidance(db, entry)
    except LeafletError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except guidance_service.GuidanceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
