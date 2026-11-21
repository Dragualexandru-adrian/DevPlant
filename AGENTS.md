# AGENTS.md

Guidance for AI coding agents working in this repo.

## Project
MedGuard — smart medication monitoring app. Full plan: [PLAN.md](PLAN.md).

Stack:
- Patient app: Expo (React Native)
- OCR: ML Kit / Google Vision, for scanning med labels at registration
- Vision detection: camera-based container-access detection (phone cam or ESP32-CAM)
- Backend: Firebase (Firestore + Cloud Functions + Auth)
- Push notifications: Expo Push, alerts caregiver on missed dose
- Hardware (optional): ESP32 + LED + buzzer for local reminders

Stage: hackathon/demo prototype. Parts of the vision/hardware pipeline may be mocked — see PLAN.md's build order for current status.

## Setup
- Expo project: run `cd app`, then `npx expo start`.
- Firebase: config in `.env`, never commit secrets.

## Conventions
- Keep these concerns in separate modules: OCR/med-registration, schedule engine, vision-access-detection, push-alert/caregiver dashboard.
- Mock interfaces (vision detection, buzzer/LED) must be swappable for real hardware without touching callers.
- No test suite yet — add tests once med-CRUD and schedule logic land.

## Build order (do not skip ahead)
1. App skeleton + med CRUD (manual entry) + schedule + local notification
2. OCR scan → autofill med entry
3. Mock vision detection (manual trigger simulates "container opened")
4. Real camera-based vision detection
5. Caregiver view + push alert on missed dose
6. Demo polish

## Scope discipline
This is a hackathon demo. Don't add infra, abstractions, or features beyond PLAN.md without checking with the user first.
