# MedGuard Backend

FastAPI + SQLite backend for MedGuard. See [../PLAN.md](../PLAN.md) for full project plan, [../CLAUDE.md](../CLAUDE.md) / [../AGENTS.md](../AGENTS.md) for agent conventions.

## What it does
Serves the API for:
- **Meds** — registered medications (name, concentration, dose, schedule, stock)
- **Schedules** — dose times / days per medication
- **Events** — vial access events pushed from the Raspberry Pi (ArUco marker disappear/reappear), dose confirmations, alerts
- **Telegram notifications** — missed-dose alert to a trusted contact

Raspberry Pi talks to this backend over Wi-Fi via plain HTTP, posting detected vial-access events. The React frontend talks to it for auth, med registration (OCR-assisted), dashboard, and dose confirmation.

Currently skeleton only: app boots, `/health` works, routers exist but have no routes yet. No DB models, no real endpoints, no Telegram integration implemented yet.

## File structure
```
backend/
  app/
    main.py          FastAPI app, CORS, router registration, startup (init_db)
    config.py        env var loading (.env) -> DATABASE_URL, TELEGRAM_*, CORS_ORIGINS
    db.py            SQLModel engine + session, init_db() creates tables
    routers/
      meds.py         /meds      — empty router, no routes yet
      schedules.py    /schedules — empty router, no routes yet
      events.py       /events    — empty router, no routes yet
  requirements.txt   fastapi, uvicorn, sqlmodel, python-dotenv, python-multipart, httpx
  .env.example       copy to .env, fill in values
  venv/              local virtualenv (gitignored, not committed)
```

No models/schemas file yet — add one (e.g. `app/models.py`) when implementing meds/schedules/events.

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
Fill in `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` in `.env` once available (not required to boot).

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

## Notes
- SQLite DB file (`medguard.db`) is created on startup next to wherever uvicorn runs, gitignored.
- CORS origins come from `CORS_ORIGINS` in `.env` (comma-separated), default `http://localhost:3000` for the React dev server.
