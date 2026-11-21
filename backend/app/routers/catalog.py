from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session

from app import guidance as guidance_service
from app.catalog import search
from app.db import get_session
from app.leaflet import LeafletError
from app.models import DrugCatalog

router = APIRouter(prefix="/catalog", tags=["catalog"])


class CatalogMatch(BaseModel):
    entry: DrugCatalog
    score: float


def _get_entry(session: Session, entry_id: int) -> DrugCatalog:
    entry = session.get(DrugCatalog, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Medicamentul nu există în catalog")
    return entry


@router.get("/search", response_model=list[CatalogMatch])
def search_catalog(
    q: str = Query(min_length=2),
    limit: int = Query(default=10, ge=1, le=50),
    session: Session = Depends(get_session),
):
    return [CatalogMatch(entry=e, score=s) for e, s in search(session, q, limit)]


@router.get("/{entry_id}", response_model=DrugCatalog)
def get_catalog_entry(entry_id: int, session: Session = Depends(get_session)):
    return _get_entry(session, entry_id)


@router.get("/{entry_id}/guidance")
def get_catalog_guidance(entry_id: int, session: Session = Depends(get_session)):
    """Short AI summary from the official leaflet: how to take it, dose interval, side effects."""
    entry = _get_entry(session, entry_id)
    try:
        return guidance_service.get_guidance(session, entry)
    except LeafletError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except guidance_service.GuidanceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
