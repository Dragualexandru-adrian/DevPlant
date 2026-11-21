# MedGuard — Smart Medication Monitoring System

## Problem
Elderly patients forget medication times. Families can't always check adherence.

## Solution
Web app + OCR + computer vision + Raspberry Pi. Automates medication monitoring and caregiver alerts.

## Stack
- **Frontend:** React + Tesseract.js — web UI, auth, OCR, dashboard
- **Backend:** Python + FastAPI + SQLite — users, meds, schedules, history, Telegram notifications
- **Hardware:** Raspberry Pi 4 + camera + OpenCV — vial detection, 2 LEDs, buzzer
- Raspberry Pi and laptop communicate over Wi-Fi via HTTP API

## Flow

### 1. Web app + OCR
Patient creates account (web, mobile-accessible). To add a med: photograph the box, Tesseract.js (OCR) extracts name + concentration, user verifies. Then fills form: pills per dose, times, days of week, stock on hand. Saved to account; app generates schedule + reminders.

### 2. Automatic monitoring via hardware
Raspberry Pi 4 + camera + 2 LEDs + buzzer. Meds sit in a stand; each vial gets an ArUco marker (black/white, QR-like) linked to that med in the app. Camera continuously watches vials; OpenCV detects marker disappear/reappear = possible vial access. Pi sends event to backend automatically — no manual scan needed each time.

### 3. Alerts and notifications
- Vial accessed at scheduled time → **green LED** confirms detection.
- No interaction within window (e.g. 3 min) → **red LED + buzzer**.
- Still unresolved → **Telegram notification** to a trusted contact (family member).
- Camera detects *vial access*, not *swallowing*. App distinguishes "Vial accessed" vs "Dose confirmed" — the latter logged via a button.

### 4. History and stock management
Dashboard: registered meds, daily schedule, detected interactions, confirmed doses, alerts. Estimated stock updates after each confirmed dose; low stock (e.g. 2–3 pills left) triggers a refill reminder. Stock can also be corrected manually.

## Architecture
```
React app (OCR, auth, dashboard) <--HTTP--> FastAPI backend (SQLite)
                                                  |
                                          Telegram notification
                                                  |
Raspberry Pi 4 + camera + OpenCV ---Wi-Fi/HTTP---> FastAPI backend
      |
 ArUco marker detection -> vial access event
      |
 Green LED (on-time) / Red LED + buzzer (missed window)
```

## Team roles (3-hour build)
- **Person 1 — Frontend + OCR:** React app, demo auth, Tesseract.js box scanning, dose/time/days/stock form, dashboard.
- **Person 2 — Hardware + Computer Vision:** camera + Raspberry Pi 4 wiring, LEDs + buzzer, ArUco markers on 2 vials, OpenCV disappear/reappear detection.
- **Person 3 — Backend + Database:** FastAPI + SQLite, APIs for meds/schedules/events, dose-time check logic, Telegram notifications.

## 3-hour schedule

**Hour 1 — Parallel build (0–60 min)**
- Frontend: React app + demo auth, Tesseract.js integration, dose/time/days/stock form, dashboard skeleton.
- Hardware: camera↔Pi wiring check, LEDs + buzzer mounted, 2 ArUco markers generated + attached, OpenCV disappear/reappear detection.
- Backend: FastAPI + SQLite setup, APIs for meds/schedules/events, dose-time check logic, Telegram notification prep.

**Hour 2 — Integration (60–120 min)**
- Connect React form to backend for saving meds.
- Link each med to its ArUco marker.
- Pi sends detected events to FastAPI over Wi-Fi.
- Backend stores events, updates dashboard.
- Wire green LED (access) and red LED + buzzer (missed reminder).
- Add dose confirmation + stock update.

**Hour 3 — Test + demo prep (120–180 min)**
- Test OCR on 2 boxes + manual correction.
- Test vial lift/replace detection.
- Simulate a scheduled dose 20–30 sec out.
- Verify LEDs, buzzer, Telegram notification fire.
- Test history, dose confirmation, low-stock alert.
- Last 20 min: bug fixes + pitch prep.

## Priorities / fallback plan
- **Must-have:** web app, med registration, vial detection, history, working alert.
- **Nice-to-have:** automatic OCR, full auth, Telegram notifications, advanced stock management.
- **Fallback:** if Pi can't process camera fast enough, move OpenCV to laptop, use Pi only for LEDs/buzzer. If Telegram isn't configured in time, demo the notification in-app instead.

## Success criterion
At the end: lift a vial → system auto-detects the interaction and shows it on dashboard. If not accessed by scheduled time → real alert fires. **Note:** vial detection confirms access, not that the medication was swallowed — don't claim otherwise in the demo.
