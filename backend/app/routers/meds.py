from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app import db as store
from app.db import get_db
from app.models import Event, Medication, Schedule, User
from app.schemas import MedicationCreate, MedicationUpdate
from app.security import get_current_user

router = APIRouter(prefix="/meds", tags=["meds"])


def owned_medication(db: Database, med_id: int, user: User) -> Medication:
    med = store.get(db, Medication, med_id)
    if not med or med.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Medication not found")
    return med


@router.post("", response_model=Medication)
def create_medication(
    payload: MedicationCreate,
    db: Database = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return store.insert(db, Medication(owner_id=user.id, **payload.model_dump()))
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="marker_id already in use")


@router.get("", response_model=list[Medication])
def list_medications(
    db: Database = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return store.find(db, Medication, {"owner_id": user.id}, sort=[("_id", 1)])


@router.get("/{med_id}", response_model=Medication)
def get_medication(
    med_id: int,
    db: Database = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return owned_medication(db, med_id, user)


@router.put("/{med_id}", response_model=Medication)
def update_medication(
    med_id: int,
    payload: MedicationUpdate,
    db: Database = Depends(get_db),
    user: User = Depends(get_current_user),
):
    med = owned_medication(db, med_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(med, field, value)
    try:
        store.save(db, med)
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="marker_id already in use")
    return med


@router.delete("/{med_id}")
def delete_medication(
    med_id: int,
    db: Database = Depends(get_db),
    user: User = Depends(get_current_user),
):
    owned_medication(db, med_id, user)
    store.delete(db, Medication, med_id)
    # No foreign keys in Mongo: drop the medication's schedules and history too.
    db[store.coll(Schedule)].delete_many({"medication_id": med_id})
    db[store.coll(Event)].delete_many({"medication_id": med_id})
    return {"ok": True}
