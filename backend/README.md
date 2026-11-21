# MedGuard Backend

FastAPI + SQLite backend for MedGuard. See [../PLAN.md](../PLAN.md) for full project plan, [../CLAUDE.md](../CLAUDE.md) / [../AGENTS.md](../AGENTS.md) for agent conventions.

## What it does
- **Auth** — register/login with email+password, JWT bearer tokens. Roles: `patient` / `caregiver`.
- **Meds** — CRUD for a patient's registered medications (name, concentration, pills per dose, stock, ArUco `marker_id`).
- **Schedules** — dose time + days of week + access window (minutes) per medication.
- **Events** — vial-access events pushed by the Raspberry Pi (`accessed`), dose confirmations (`dose_confirmed`, logged via a button, decrements stock), and system-generated `missed_alert` events.
- **Missed-dose background loop** — runs continuously inside the FastAPI process; for every schedule, if the access window has passed with no `accessed`/`dose_confirmed` event, it logs a `missed_alert` event and sends an Expo push notification to any caregiver with a stored push token.

This deviates from the original docx plan in two ways (per product decision): auth is real JWT (not just a demo account), and alerts go out as **Expo push notifications** to a caregiver's phone instead of Telegram.

Vial access ("Flacon accesat" / `accessed`) and dose confirmation ("Administrare confirmată" / `dose_confirmed`) are deliberately separate event types — the camera confirms the vial was touched, not that the pill was swallowed.

## File structure
```
backend/
  app/
    main.py            FastAPI app, CORS, router registration, startup (init_db + background loop)
    config.py           env var loading (.env)
    db.py                SQLModel engine + session, init_db() creates tables
    models.py            SQLModel tables: User, Medication, Schedule, Event
    schemas.py           pydantic request bodies (UserCreate, MedicationCreate, ScheduleCreate, EventIn, ...)
    security.py          password hashing, JWT create/decode, get_current_user dependency
    push.py              send_expo_push() - POSTs to Expo's push API
    background.py        missed_dose_loop() - periodic check, dedupes per (schedule, occurrence)
    routers/
      auth.py             POST /auth/register, POST /auth/login, POST /auth/push-token
      meds.py             CRUD /meds (JWT-protected, scoped to owner)
      schedules.py        CRUD /schedules (JWT-protected)
      events.py           POST /events (no auth - Pi posts by marker_id), GET /events (JWT), POST /events/confirm (JWT)
  requirements.txt
  .env.example          copy to .env, fill in values
  venv/                 local virtualenv (gitignored, not committed)
```

## API summary
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | - | `{email, password, role}` |
| POST | `/auth/login` | - | form-encoded `username`/`password`, returns `access_token` |
| POST | `/auth/push-token` | JWT | sets the caller's `expo_push_token` |
| POST | `/meds` | JWT | create medication |
| GET | `/meds`, `/meds/{id}` | JWT | list/read own medications |
| PUT/DELETE | `/meds/{id}` | JWT | update/delete own medication |
| POST | `/schedules` | JWT | `{medication_id, time, days_of_week, window_minutes}` |
| GET/DELETE | `/schedules` | JWT | list (optional `?medication_id=`) / delete |
| POST | `/events` | none | Pi posts `{marker_id, event_type: "accessed"}` |
| GET | `/events` | JWT | list own events (optional `?medication_id=`) |
| POST | `/events/confirm` | JWT | `{medication_id}` - logs `dose_confirmed`, decrements stock |

Full interactive docs at `/docs` once running.

## Install
```powershell
cd backend
python -m venv venv
./venv/Scripts/Activate.ps1
pip install -r requirements.txt
```
Then copy env config:
```powershell
Copy-Item .env.example .env
```
Fill in `JWT_SECRET` with a real secret before anything but local demo use.

## Run
```powershell
cd backend
./venv/Scripts/Activate.ps1
uvicorn app.main:app --reload --port 8000
```
Check it's up:
```powershell
curl http://127.0.0.1:8000/health
```
Should return `{"status":"ok"}`. Interactive API docs at `http://127.0.0.1:8000/docs`.

## Tests
Pytest suite (unit + integration) covering auth, meds, schedules, events, security, push, and the missed-dose background logic. In-memory SQLite per test, no real DB or background task touched.

```powershell
cd backend
./venv/Scripts/Activate.ps1
pip install -r requirements-dev.txt   # once
pytest
```
Runs with coverage by default (`pytest.ini`); HTML report at `backend/htmlcov/index.html`. Run a single file/test with `pytest tests/test_meds.py` or `pytest tests/test_meds.py::test_create_medication`.

## Notes / known limitations (MVP scope)
- SQLite DB file (`medguard.db`) is created on startup next to wherever uvicorn runs, gitignored.
- CORS origins come from `CORS_ORIGINS` in `.env` (comma-separated), default `http://localhost:3000`.
- Schedule `time` is interpreted in the server's local time (naive "HH:MM"); the background loop compares against UTC-aware timestamps assuming server and schedule agree on timezone — fine for a same-machine demo, not correct across timezones.
- Missed-dose alert state is kept in memory (not persisted) — restarting the server resets dedupe tracking for already-alerted occurrences.
- No caregiver-to-patient linking yet: any user with `role=caregiver` and a stored push token gets every alert. Fine for the single-patient/single-caregiver demo.
- `bcrypt` is pinned to `4.0.1` — `passlib==1.7.4` is incompatible with `bcrypt>=4.1`.
