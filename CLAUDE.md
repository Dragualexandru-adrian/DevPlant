# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repo.

## Project
MedGuard — smart medication monitoring app. See [PLAN.md](PLAN.md) for full plan.

- Patient app: Expo (React Native)
- OCR: ML Kit / Google Vision, for scanning med labels
- Vision detection: camera-based container access detection (phone cam or ESP32-CAM)
- Backend: Firebase (Firestore + Cloud Functions + Auth)
- Push notifications: Expo Push, to notify caregiver of missed doses
- Hardware (optional): ESP32 + LED + buzzer for local reminders

Current stage: hackathon/demo prototype. Hardware and vision pieces may be mocked until there's time to wire up the real thing — check PLAN.md's "Build order" for what's mocked vs real at any point.

## Conventions
- Expo project lives at repo root (or `/app` once scaffolded — update this file when that's decided).
- Keep OCR, scheduling, vision-detection, and push-alert logic in separate modules — they're built and tested independently per the plan's build order.
- Firebase config/secrets go in `.env`, never committed (check `.gitignore`).
- Mocked hardware (vision detection, buzzer/LED) should be behind a clear interface/flag so swapping in real camera/ESP32 code later doesn't touch calling code.

## Workflow
- No test suite yet — add one as soon as core med-CRUD and schedule logic exist.
- Favor the plan's build order (CRUD → OCR → mock vision → real vision → caregiver push) over building everything at once; this is a demo, scope tightly.
- Don't add backend/infra beyond Firebase unless the plan changes — keep hackathon scope.
