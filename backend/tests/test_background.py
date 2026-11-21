from contextlib import nullcontext

from app import db as store
from datetime import datetime, timedelta, timezone

import pytest

from app import background
from app.models import Event, Medication, Schedule, User


@pytest.fixture
def bg_engine(monkeypatch, db):
    monkeypatch.setattr(background.store, "get_db", lambda: db)
    background._alerted_occurrences.clear()
    yield db


class _FrozenDatetime(datetime):
    _fixed: "datetime" = None

    @classmethod
    def now(cls, tz=None):
        return cls._fixed


def _freeze(monkeypatch, fixed: datetime) -> None:
    _FrozenDatetime._fixed = fixed
    monkeypatch.setattr(background, "datetime", _FrozenDatetime)


def _make_schedule(session, offset_minutes, window_minutes=3, days=None):
    now = datetime.now(timezone.utc)
    med = Medication(owner_id=1, name="Aspirin")
    store.insert(session, med)

    due_time = (now + timedelta(minutes=offset_minutes)).strftime("%H:%M")
    weekday = days or background._WEEKDAYS[now.weekday()]
    schedule = Schedule(medication_id=med.id, time=due_time, days_of_week=weekday, window_minutes=window_minutes)
    store.insert(session, schedule)
    return now, med, schedule


async def test_missed_dose_creates_alert_and_pushes(bg_engine, monkeypatch):
    sent = []

    async def fake_push(token, title, body):
        sent.append((token, title, body))

    monkeypatch.setattr(background, "send_expo_push", fake_push)

    with nullcontext(bg_engine) as session:
        caregiver = User(name="Caregiver", email="c@b.com", hashed_password="x", role="caregiver", expo_push_token="tok")
        store.insert(session, caregiver)
        now, med, _schedule = _make_schedule(session, offset_minutes=-10)
        med_id, med_name = med.id, med.name

    _freeze(monkeypatch, now)
    await background._check_once()

    with nullcontext(bg_engine) as session:
        alerts = store.find(session, Event, {"event_type": "missed_alert"})
        assert len(alerts) == 1
        assert alerts[0].medication_id == med_id

    assert sent == [("tok", "Missed dose alert", f"{med_name} was not accessed at the scheduled time.")]


async def test_no_alert_when_accessed_within_window(bg_engine, monkeypatch):
    async def fail_push(*args, **kwargs):
        raise AssertionError("push should not be called when dose was accessed")

    monkeypatch.setattr(background, "send_expo_push", fail_push)

    with nullcontext(bg_engine) as session:
        now, med, schedule = _make_schedule(session, offset_minutes=-10)
        hour, minute = map(int, schedule.time.split(":"))
        occurrence = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        store.insert(session, Event(medication_id=med.id, event_type="accessed", timestamp=occurrence))

    _freeze(monkeypatch, now)
    await background._check_once()

    with nullcontext(bg_engine) as session:
        alerts = store.find(session, Event, {"event_type": "missed_alert"})
        assert alerts == []


async def test_not_due_yet_produces_no_alert(bg_engine, monkeypatch):
    async def fail_push(*args, **kwargs):
        raise AssertionError("push should not be called before the dose is due")

    monkeypatch.setattr(background, "send_expo_push", fail_push)

    with nullcontext(bg_engine) as session:
        now, _med, _schedule = _make_schedule(session, offset_minutes=30)

    _freeze(monkeypatch, now)
    await background._check_once()

    with nullcontext(bg_engine) as session:
        events = store.find(session, Event)
        assert events == []


async def test_schedule_not_today_produces_no_alert(bg_engine, monkeypatch):
    async def fail_push(*args, **kwargs):
        raise AssertionError("push should not be called for a day the schedule doesn't run")

    monkeypatch.setattr(background, "send_expo_push", fail_push)

    with nullcontext(bg_engine) as session:
        now = datetime.now(timezone.utc)
        other_day = background._WEEKDAYS[(now.weekday() + 1) % 7]
        now, _med, _schedule = _make_schedule(session, offset_minutes=-10, days=other_day)

    _freeze(monkeypatch, now)
    await background._check_once()

    with nullcontext(bg_engine) as session:
        events = store.find(session, Event)
        assert events == []


async def test_missed_alert_deduped_across_checks(bg_engine, monkeypatch):
    calls = []

    async def fake_push(*args, **kwargs):
        calls.append(args)

    monkeypatch.setattr(background, "send_expo_push", fake_push)

    with nullcontext(bg_engine) as session:
        caregiver = User(name="Caregiver", email="c@b.com", hashed_password="x", role="caregiver", expo_push_token="tok")
        store.insert(session, caregiver)
        now, _med, _schedule = _make_schedule(session, offset_minutes=-10)

    _freeze(monkeypatch, now)
    await background._check_once()
    await background._check_once()

    with nullcontext(bg_engine) as session:
        alerts = store.find(session, Event, {"event_type": "missed_alert"})
        assert len(alerts) == 1
    assert len(calls) == 1
