from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database

from app import db as store
from app.db import get_db
from app.models import Medication, Schedule, User
from app.routers.meds import owned_medication
from app.schemas import ScheduleCreate
from app.security import get_current_user

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.post("", response_model=Schedule)
def create_schedule(
    payload: ScheduleCreate,
    db: Database = Depends(get_db),
    user: User = Depends(get_current_user),
):
    owned_medication(db, payload.medication_id, user)
    return store.insert(db, Schedule(**payload.model_dump()))


@router.get("", response_model=list[Schedule])
def list_schedules(
    medication_id: int | None = Query(default=None),
    db: Database = Depends(get_db),
    user: User = Depends(get_current_user),
):
    med_ids = [m["_id"] for m in db[store.coll(Medication)].find({"owner_id": user.id}, {"_id": 1})]
    if medication_id is not None:
        med_ids = [m for m in med_ids if m == medication_id]
    return store.find(db, Schedule, {"medication_id": {"$in": med_ids}}, sort=[("_id", 1)])


@router.delete("/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Database = Depends(get_db),
    user: User = Depends(get_current_user),
):
    schedule = store.get(db, Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    owned_medication(db, schedule.medication_id, user)
    store.delete(db, Schedule, schedule_id)
    return {"ok": True}
