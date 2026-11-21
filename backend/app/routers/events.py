from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database

from app import db as store
from app.db import get_db
from app.models import Event, Medication, User
from app.routers.meds import owned_medication
from app.schemas import DoseConfirm, EventIn
from app.security import get_current_user

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=Event)
def report_event(payload: EventIn, db: Database = Depends(get_db)):
    """Pi posts vial-access events here. No auth: Pi identifies the med by marker_id."""
    med = store.find_one(db, Medication, {"marker_id": payload.marker_id})
    if not med:
        raise HTTPException(status_code=404, detail="Unknown marker_id")
    return store.insert(db, Event(medication_id=med.id, event_type=payload.event_type))


@router.get("", response_model=list[Event])
def list_events(
    medication_id: int | None = Query(default=None),
    db: Database = Depends(get_db),
    user: User = Depends(get_current_user),
):
    med_ids = [m["_id"] for m in db[store.coll(Medication)].find({"owner_id": user.id}, {"_id": 1})]
    if medication_id is not None:
        med_ids = [m for m in med_ids if m == medication_id]
    return store.find(
        db, Event, {"medication_id": {"$in": med_ids}}, sort=[("timestamp", -1), ("_id", -1)]
    )


@router.post("/confirm", response_model=Event)
def confirm_dose(
    payload: DoseConfirm,
    db: Database = Depends(get_db),
    user: User = Depends(get_current_user),
):
    med = owned_medication(db, payload.medication_id, user)
    event = store.insert(db, Event(medication_id=med.id, event_type="dose_confirmed"))
    med.stock = max(0, med.stock - med.pills_per_dose)
    store.save(db, med)
    return event
