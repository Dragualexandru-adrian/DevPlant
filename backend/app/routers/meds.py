from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Medication, User
from app.schemas import MedicationCreate, MedicationUpdate
from app.security import get_current_user

router = APIRouter(prefix="/meds", tags=["meds"])


@router.post("", response_model=Medication)
def create_medication(
    payload: MedicationCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    med = Medication(owner_id=user.id, **payload.model_dump())
    session.add(med)
    session.commit()
    session.refresh(med)
    return med


@router.get("", response_model=list[Medication])
def list_medications(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return session.exec(select(Medication).where(Medication.owner_id == user.id)).all()


@router.get("/{med_id}", response_model=Medication)
def get_medication(
    med_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    med = session.get(Medication, med_id)
    if not med or med.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Medication not found")
    return med


@router.put("/{med_id}", response_model=Medication)
def update_medication(
    med_id: int,
    payload: MedicationUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    med = session.get(Medication, med_id)
    if not med or med.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Medication not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(med, field, value)

    session.add(med)
    session.commit()
    session.refresh(med)
    return med


@router.delete("/{med_id}")
def delete_medication(
    med_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    med = session.get(Medication, med_id)
    if not med or med.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Medication not found")
    session.delete(med)
    session.commit()
    return {"ok": True}
