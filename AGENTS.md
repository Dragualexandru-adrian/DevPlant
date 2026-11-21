# AGENTS.md

Guidance for AI coding agents working in this repo.

## Project
MedGuard — smart medication monitoring system. Full plan: [PLAN.md](PLAN.md).

Stack:
- Frontend: React + Tesseract.js — auth, OCR box scanning, dose/schedule form, dashboard
- Backend: Python + FastAPI + SQLite — users, meds, schedules, history, Telegram notifications
- Hardware: Raspberry Pi 4 + camera + OpenCV — ArUco marker detection on med vials, 2 LEDs, buzzer
- Pi <-> backend: HTTP API over Wi-Fi

Stage: 3-hour hackathon build, MVP scope — one demo account, two medications, one complete working flow.

## Setup
- Frontend: standard React app (not yet scaffolded as of this writing).
- Backend: FastAPI + SQLite, run with `uvicorn`.
- Hardware: Raspberry Pi 4, OpenCV, camera; ArUco marker generation/detection.
- Secrets (Telegram bot token, etc.) in `.env`, never committed.

## Conventions
- Keep frontend, backend, and hardware/vision code as separate, independently testable pieces — matches the 3-person team split (Frontend+OCR / Hardware+CV / Backend+DB).
- "Vial accessed" (camera-detected) and "Administrare confirmată" / dose confirmed (button-logged) are distinct states — never conflate. Detection confirms access, not swallowing.
- Keep the Pi -> backend event API small: marker/med id, event type, timestamp.

## Build order (hour by hour — see PLAN.md for detail)
1. **Hour 1 (parallel):** React app + OCR integration + form/dashboard skeleton; Pi/camera/LED/buzzer wiring + ArUco markers + OpenCV detection; FastAPI + SQLite + APIs + dose-time logic + Telegram prep.
2. **Hour 2 (integration):** form -> backend save; med <-> marker linking; Pi -> FastAPI event push; dashboard updates; green/red LED + buzzer wiring; dose confirmation + stock update.
3. **Hour 3 (test + demo):** OCR test + manual correction, vial detection test, simulated dose window, alert verification, history/confirmation/low-stock test, final 20 min for fixes + pitch.

## Priorities / fallback
- Must-have: web app, med registration, vial detection, history, one working alert.
- Nice-to-have: automatic OCR, full auth, Telegram notifications, advanced stock handling.
- Fallback: Pi too slow for camera -> move OpenCV to laptop, Pi handles only LEDs/buzzer. Telegram not ready -> show alert in-app.

## Scope discipline
Hackathon demo, timeboxed. Don't add infra, abstractions, or features beyond PLAN.md without checking with the user first.
