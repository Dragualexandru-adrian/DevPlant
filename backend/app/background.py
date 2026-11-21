import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from pymongo.database import Database

from app import db as store
from app.config import MISSED_DOSE_CHECK_INTERVAL_SECONDS
from app.models import Event, Medication, Schedule, User
from app.push import send_expo_push

_alerted_occurrences: set[tuple[int, str]] = set()  # (schedule_id, "YYYY-MM-DD HH:MM")

_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


async def _check_once(db: Optional[Database] = None) -> None:
    db = store.get_db() if db is None else db
    # Schedule times ("08:00") are what the user picked in local time, so occurrences are
    # built in the server's local timezone. Event timestamps are UTC-aware; aware datetimes
    # compare correctly across timezones (and pymongo converts them to UTC in queries).
    now = datetime.now(timezone.utc).astimezone()
    today_abbr = _WEEKDAYS[now.weekday()]

    for schedule in store.find(db, Schedule):
        if today_abbr not in [d.strip() for d in schedule.days_of_week.split(",")]:
            continue
        if schedule.end_date and now.strftime("%Y-%m-%d") > schedule.end_date:
            continue

        hour, minute = map(int, schedule.time.split(":"))
        occurrence = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        window_end = occurrence + timedelta(minutes=schedule.window_minutes)

        if now <= window_end:
            continue  # not due yet, or still inside the grace window

        occurrence_key = (schedule.id, occurrence.strftime("%Y-%m-%d %H:%M"))
        if occurrence_key in _alerted_occurrences:
            continue

        accessed = db[store.coll(Event)].find_one({
            "medication_id": schedule.medication_id,
            "event_type": {"$in": ["accessed", "dose_confirmed"]},
            "timestamp": {"$gte": occurrence, "$lte": window_end},
        })
        # The in-memory set is lost on restart; the stored alert is not.
        occurrence_id = f"{schedule.id}@{occurrence_key[1]}"
        already_alerted = db[store.coll(Event)].find_one({"event_type": "missed_alert", "occurrence": occurrence_id})
        if accessed or already_alerted:
            _alerted_occurrences.add(occurrence_key)
            continue

        med = store.get(db, Medication, schedule.medication_id)
        if not med:
            continue

        store.insert(db, Event(medication_id=med.id, event_type="missed_alert", occurrence=occurrence_id))
        _alerted_occurrences.add(occurrence_key)

        caregivers = store.find(db, User, {"role": "caregiver", "expo_push_token": {"$ne": None}})
        for caregiver in caregivers:
            await send_expo_push(
                caregiver.expo_push_token,
                title="Missed dose alert",
                body=f"{med.name} was not accessed at the scheduled time.",
            )


async def missed_dose_loop() -> None:
    while True:
        try:
            await _check_once()
        except Exception as exc:  # a DB hiccup (Atlas, network) must not kill the loop
            print(f"[missed_dose_loop] {exc}", flush=True)
        await asyncio.sleep(MISSED_DOSE_CHECK_INTERVAL_SECONDS)
