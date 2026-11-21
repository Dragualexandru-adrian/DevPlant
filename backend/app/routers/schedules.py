from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models import Medication, Schedule, User
from app.schemas import ScheduleCreate
from app.security import get_current_user

router = APIRouter(prefix="/schedules", tags=["schedules"])


def _owned_medication(med_id: int, session: Session, user: User) -> Medication:
    med = session.get(Medication, med_id)
    if not med or med.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Medication not found")
    return med


@router.post("", response_model=Schedule)
def create_schedule(
    payload: ScheduleCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _owned_medication(payload.medication_id, session, user)
    schedule = Schedule(**payload.model_dump())
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return schedule


@router.get("", response_model=list[Schedule])
def list_schedules(
    medication_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    query = (
        select(Schedule)
        .join(Medication, Medication.id == Schedule.medication_id)
        .where(Medication.owner_id == user.id)
    )
    if medication_id is not None:
        query = query.where(Schedule.medication_id == medication_id)
    return session.exec(query).all()


@router.delete("/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    schedule = session.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    _owned_medication(schedule.medication_id, session, user)
    session.delete(schedule)
    session.commit()
    return {"ok": True}
