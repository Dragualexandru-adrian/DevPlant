# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repo.

## Project
MedGuard — smart medication monitoring system. Full plan: [PLAN.md](PLAN.md).

- Frontend: React + Tesseract.js (web, mobile-accessible) — auth, OCR box scanning, dose/schedule form, dashboard
- Backend: Python + FastAPI + MongoDB Atlas — users, meds, schedules, history, Telegram notifications
- Hardware: Raspberry Pi 4 + camera + OpenCV — ArUco marker detection on med vials, 2 LEDs, buzzer
- Pi and backend communicate over Wi-Fi via HTTP API

Stage: 3-hour hackathon build. MVP targets one demo account, two medications, one full working flow — not breadth.

## Conventions
- Keep frontend (React/OCR/dashboard), backend (FastAPI/MongoDB/Telegram), and hardware (Pi/OpenCV/LEDs/buzzer) as separate, independently testable pieces — matches the 3-person team split in PLAN.md.
- Vial access ("Vial accessed", detected by camera) and dose confirmation ("Administrare confirmată", logged by button) are distinct states — never conflate them. The system detects access, not swallowing.
- Pi -> backend communication is a plain HTTP event push over Wi-Fi; keep that API small (med/marker id, event type, timestamp).
- Secrets (Telegram bot token, etc.) go in `.env`, never committed.

## Priorities (see PLAN.md for full fallback plan)
- Must-have: web app, med registration, vial detection, history, one working alert path.
- Nice-to-have: automatic OCR, full auth, Telegram notifications, advanced stock management.
- Fallback: if the Pi can't keep up with camera processing, move OpenCV to the laptop and use the Pi only for LEDs/buzzer. If Telegram isn't ready, show the alert in-app instead.

## Workflow
- No test suite — this is a timeboxed demo; favor the hour-by-hour build order in PLAN.md over polishing any one piece.
- Don't add infra/features beyond PLAN.md without checking with the user first.
