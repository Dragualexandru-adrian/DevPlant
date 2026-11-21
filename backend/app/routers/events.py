from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models import Event, Medication, User
from app.schemas import DoseConfirm, EventIn
from app.security import get_current_user

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=Event)
def report_event(payload: EventIn, session: Session = Depends(get_session)):
    """Pi posts vial-access events here. No auth: Pi identifies the med by marker_id."""
    med = session.exec(
        select(Medication).where(Medication.marker_id == payload.marker_id)
    ).first()
    if not med:
        raise HTTPException(status_code=404, detail="Unknown marker_id")

    event = Event(medication_id=med.id, event_type=payload.event_type)
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


@router.get("", response_model=list[Event])
def list_events(
    medication_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    query = (
        select(Event)
        .join(Medication, Medication.id == Event.medication_id)
        .where(Medication.owner_id == user.id)
        .order_by(Event.timestamp.desc())
    )
    if medication_id is not None:
        query = query.where(Event.medication_id == medication_id)
    return session.exec(query).all()


@router.post("/confirm", response_model=Event)
def confirm_dose(
    payload: DoseConfirm,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    med = session.get(Medication, payload.medication_id)
    if not med or med.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Medication not found")

    event = Event(medication_id=med.id, event_type="dose_confirmed")
    session.add(event)

    med.stock = max(0, med.stock - med.pills_per_dose)
    session.add(med)

    session.commit()
    session.refresh(event)
    return event
