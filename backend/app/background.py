import asyncio
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.config import MISSED_DOSE_CHECK_INTERVAL_SECONDS
from app.db import engine
from app.models import Event, Medication, Schedule, User
from app.push import send_expo_push

_alerted_occurrences: set[tuple[int, str]] = set()  # (schedule_id, "YYYY-MM-DD HH:MM")

_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


async def _check_once() -> None:
    now = datetime.now(timezone.utc)
    today_abbr = _WEEKDAYS[now.weekday()]

    with Session(engine) as session:
        schedules = session.exec(select(Schedule)).all()
        for schedule in schedules:
            if today_abbr not in [d.strip() for d in schedule.days_of_week.split(",")]:
                continue

            hour, minute = map(int, schedule.time.split(":"))
            occurrence = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            window_end = occurrence + timedelta(minutes=schedule.window_minutes)

            if now <= window_end:
                continue  # not due yet, or still inside the grace window

            occurrence_key = (schedule.id, occurrence.strftime("%Y-%m-%d %H:%M"))
            if occurrence_key in _alerted_occurrences:
                continue

            accessed = session.exec(
                select(Event)
                .where(Event.medication_id == schedule.medication_id)
                .where(Event.event_type.in_(["accessed", "dose_confirmed"]))
                .where(Event.timestamp >= occurrence)
                .where(Event.timestamp <= window_end)
            ).first()

            if accessed:
                _alerted_occurrences.add(occurrence_key)
                continue

            med = session.get(Medication, schedule.medication_id)
            if not med:
                continue

            session.add(Event(medication_id=med.id, event_type="missed_alert"))
            session.commit()
            _alerted_occurrences.add(occurrence_key)

            caregivers = session.exec(
                select(User).where(User.role == "caregiver").where(User.expo_push_token.is_not(None))
            ).all()
            for caregiver in caregivers:
                await send_expo_push(
                    caregiver.expo_push_token,
                    title="Missed dose alert",
                    body=f"{med.name} was not accessed at the scheduled time.",
                )


async def missed_dose_loop() -> None:
    while True:
        await _check_once()
        await asyncio.sleep(MISSED_DOSE_CHECK_INTERVAL_SECONDS)
