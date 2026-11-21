"""Seed MedGuard's DB with 3 demo accounts, each exercising a different path.

Writes to the MongoDB in backend/.env (MONGODB_URI). Only the 3 demo accounts
(and their meds/schedules/events) are reset; other users are left alone:

    python backend/scripts/seed_db.py
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import db as store
from app.db import get_db, init_db
from app.models import Event, Medication, Schedule, User
from app.security import hash_password

TODAY = datetime.now().astimezone()  # local time: schedules ("08:00") are local
YESTERDAY = TODAY - timedelta(days=1)


DEMO_EMAILS = ["demo@medguard.app", "ion.vasilescu@medguard.app", "maria.ionescu@medguard.app"]


def seed():
    db = get_db()
    init_db(db)

    # Reset only the demo accounts (and everything hanging off them).
    demo_users = [u["_id"] for u in db.user.find({"email": {"$in": DEMO_EMAILS}}, {"_id": 1})]
    demo_meds = [m["_id"] for m in db.medication.find({"owner_id": {"$in": demo_users}}, {"_id": 1})]
    db.event.delete_many({"medication_id": {"$in": demo_meds}})
    db.schedule.delete_many({"medication_id": {"$in": demo_meds}})
    db.medication.delete_many({"_id": {"$in": demo_meds}})
    db.user.delete_many({"_id": {"$in": demo_users}})

    # --- Account 1: golden-path demo (patient) -------------------------
    # Full working flow: 2 meds, daily schedules, confirmed doses today + yesterday.
    elena = User(
        name="Elena Popescu",
        email="demo@medguard.app",
        hashed_password=hash_password("medguard-demo"),
        role="patient",
    )
    store.insert(db, elena)

    metformin = Medication(
        owner_id=elena.id,
        name="Metformin",
        concentration="500mg",
        pills_per_dose=1,
        stock=28,
        marker_id="MED-DEMO-1",
    )
    lisinopril = Medication(
        owner_id=elena.id,
        name="Lisinopril",
        concentration="10mg",
        pills_per_dose=1,
        stock=30,
        marker_id="MED-DEMO-2",
    )
    store.insert(db, metformin)
    store.insert(db, lisinopril)

    store.insert(db, Schedule(medication_id=metformin.id, time="08:00", days_of_week="mon,tue,wed,thu,fri,sat,sun"))
    store.insert(db, Schedule(medication_id=metformin.id, time="20:00", days_of_week="mon,tue,wed,thu,fri,sat,sun"))
    store.insert(db, Schedule(medication_id=lisinopril.id, time="08:00", days_of_week="mon,tue,wed,thu,fri,sat,sun"))

    for med_id, hour in ((metformin.id, 8), (lisinopril.id, 8)):
        for day in (YESTERDAY, TODAY):
            ts = day.replace(hour=hour, minute=1, second=0, microsecond=0)
            store.insert(db, Event(medication_id=med_id, event_type="accessed", timestamp=ts))
            store.insert(db, Event(medication_id=med_id, event_type="dose_confirmed", timestamp=ts + timedelta(minutes=1)))

    # --- Account 2: low stock + missed-dose alert path (patient) ------
    # Push token set -> tests Telegram/push notification path.
    # Today's 09:00 dose has no event at all -> background job should flag missed_alert.
    ion = User(
        name="Ion Vasilescu",
        email="ion.vasilescu@medguard.app",
        hashed_password=hash_password("medguard-test"),
        role="patient",
        expo_push_token="ExponentPushToken[seed-test-token-ion]",
    )
    store.insert(db, ion)

    insulina = Medication(
        owner_id=ion.id,
        name="Insulina",
        concentration="100UI/ml",
        pills_per_dose=1,
        stock=2,  # low stock on purpose
        marker_id="MED-DEMO-3",
    )
    store.insert(db, insulina)

    store.insert(db, Schedule(medication_id=insulina.id, time="09:00", days_of_week="mon,tue,wed,thu,fri,sat,sun", window_minutes=3))
    # yesterday's dose was taken normally, so history isn't empty
    y_ts = YESTERDAY.replace(hour=9, minute=2, second=0, microsecond=0)
    store.insert(db, Event(medication_id=insulina.id, event_type="accessed", timestamp=y_ts))
    store.insert(db, Event(medication_id=insulina.id, event_type="dose_confirmed", timestamp=y_ts + timedelta(minutes=1)))
    # no event for today -> left for the background checker to raise missed_alert

    # --- Account 3: caregiver role + accessed-without-confirmed state -
    # No push token -> tests the in-app alert fallback (CLAUDE.md fallback plan).
    # Vial was accessed but dose never confirmed: tests that "accessed" and
    # "dose_confirmed" stay distinct states, never conflated.
    maria = User(
        name="Maria Ionescu",
        email="maria.ionescu@medguard.app",
        hashed_password=hash_password("medguard-test"),
        role="caregiver",
    )
    store.insert(db, maria)

    vitamina_d = Medication(
        owner_id=maria.id,
        name="Vitamina D",
        concentration="2000UI",
        pills_per_dose=2,
        stock=60,
        marker_id="MED-DEMO-4",
    )
    store.insert(db, vitamina_d)

    store.insert(db, Schedule(medication_id=vitamina_d.id, time="21:00", days_of_week="mon,wed,fri"))
    t_ts = TODAY.replace(hour=21, minute=0, second=0, microsecond=0)
    store.insert(db, Event(medication_id=vitamina_d.id, event_type="accessed", timestamp=t_ts))
    # deliberately no dose_confirmed event today


    print("Seed complete: demo@medguard.app / medguard-demo")
    print("               ion.vasilescu@medguard.app / medguard-test")
    print("               maria.ionescu@medguard.app / medguard-test")


if __name__ == "__main__":
    seed()
