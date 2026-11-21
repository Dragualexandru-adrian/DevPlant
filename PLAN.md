# MedGuard — Plan

## Problem
Elderly patients miss meds. Families can't always check.

## Solution
Smart med monitor: OCR registry + vision access detection + alerts.

## Stack
- App: Expo (React Native), patient + caregiver
- OCR: ML Kit / Google Vision (scan pill box label)
- Vision detection: phone cam or ESP32-CAM, motion/object detect on container access
- Backend: Firebase (Firestore + Cloud Functions + Auth)
- Alerts: Expo Push (push notification to caregiver)
- Hardware (optional): ESP32 + LED + buzzer, local reminder

## Flow
1. Register med: scan label (OCR) → confirm name/dosage → set schedule.
2. Schedule engine: local notification fires at dose time, dose state pending.
3. Vision camera watches container. Access event detected.
4. Access within dose window → mark taken. No access by window end → missed.
5. Missed dose → trigger local buzzer/LED (if hardware) + push caregiver app.
6. Caregiver app: adherence dashboard, today's status, history.

## Architecture
```
Expo App (patient) --OCR scan--> Backend (Firestore)
Expo App (patient) --schedule--> local notifications
Camera feed (phone/ESP32) --vision detect--> event --> Backend
Backend --missed-dose check (Cloud Function/cron)--> Expo Push --> Caregiver App
```

## Build order (demo-first)
1. App skeleton + med CRUD (manual entry) + schedule + local notification
2. OCR scan -> autofill med entry
3. Mock vision detection (button simulates "container opened") -> marks dose taken
4. Swap in real camera detection if time allows
5. Caregiver view + push alert on missed dose
6. Polish demo script

## Scope
Hackathon/demo prototype. Hardware/vision parts may stay mocked if time short.
