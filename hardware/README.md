# MedGuard hardware (Raspberry Pi)

`leduri.py` runs on the Pi (`~/Desktop/LifeScience/leduri.py`): USB camera + ArUco detection
(DICT_4X4_50), LEDs (white GPIO5, green GPIO27, red GPIO22) and a buzzer (PWM GPIO23).

- Page with live camera and box status: `http://<pi-ip>:5001`
- Every box carries an ArUco marker; marker **N** maps to the medication with `marker_id = "MED-DEMO-N"`.
- A box counts as taken only if it stays out for at least 30 s and is then put back.
  Only then does the Pi send `POST /events {"marker_id": "MED-DEMO-N", "event_type": "accessed"}` to the backend.
  Dose confirmation stays a separate button in the app: the camera detects access, not swallowing.
- Red LED + buzzer: a box was not taken within the alarm window. Green LED: every box was taken and put back.

Run on the Pi:
```bash
python3 leduri.py
# optional env: MEDGUARD_API=http://<laptop-ip>:8000  DURATA_ALARMEI=900  SECUNDE_MIN_SCOASA=30  PREFIX_MARKER=MED-DEMO-
```
