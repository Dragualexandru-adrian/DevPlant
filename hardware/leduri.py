from flask import Flask, Response, jsonify
from gpiozero import LED, PWMOutputDevice
from threading import Thread, Event, Lock
import cv2
import glob
import os
import time
import requests

# LED alb, verde, roșu — BCM
# LED-ul alb trebuie conectat la GPIO5 / pinul fizic 29.
leduri = [LED(5), LED(27), LED(22)]
buzzer = PWMOutputDevice(23, frequency=880, initial_value=0)

PORT = 5001
DURATA_ALARMEI = int(os.getenv("DURATA_ALARMEI", 15 * 60))  # secunde
CAMERA_DEV = sorted(glob.glob("/dev/v4l/by-id/*video-index0"))
CAMERA_DEV = CAMERA_DEV[0] if CAMERA_DEV else "/dev/video0"

# Backend MedGuard (laptopul). Pi trimite doar „flacon accesat”; confirmarea dozei
# se face din aplicație, cu butonul — accesul nu înseamnă că pastila a fost luată.
MEDGUARD_API = os.getenv("MEDGUARD_API", "http://172.20.10.5:8000")
# Markerul ArUco cu ID-ul N corespunde medicamentului cu marker_id „MED-DEMO-N” din backend.
PREFIX_MARKER = os.getenv("PREFIX_MARKER", "MED-DEMO-")

# ArUco 4x4 (markerele tipărite pe cutii).
DICTIONAR = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
if hasattr(cv2.aruco, "ArucoDetector"):  # OpenCV >= 4.7
    _detector = cv2.aruco.ArucoDetector(DICTIONAR, cv2.aruco.DetectorParameters())
    detecteaza = _detector.detectMarkers
else:  # OpenCV 4.6 (cel de pe Pi)
    _parametri = cv2.aruco.DetectorParameters_create()
    detecteaza = lambda gri: cv2.aruco.detectMarkers(gri, DICTIONAR, parameters=_parametri)

# Cât timp trebuie să lipsească / să reapară un marker ca să considerăm cutia scoasă / pusă la loc.
SECUNDE_ABSENTA = 1.5
SECUNDE_PREZENTA = 1.0
# Cutia trebuie să stea scoasă cel puțin atât, ca să conteze ca „luată”.
SECUNDE_MIN_SCOASA = int(os.getenv("SECUNDE_MIN_SCOASA", 30))
# Un marker nou intră în monitorizare doar după ce e văzut continuu atâta timp
# (filtrează detecțiile false dintr-un singur cadru, ex. coduri QR, texturi).
SECUNDE_CONFIRMARE = 1.0

app = Flask(__name__)
stop_all = Event()
frame_lock = Lock()
state_lock = Lock()

camera = cv2.VideoCapture(CAMERA_DEV, cv2.CAP_V4L2)
camera.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

if not camera.isOpened():
    raise RuntimeError(f"Nu pot deschide camera: {CAMERA_DEV}")

ultimul_jpg = None

# Câte o intrare pentru fiecare marker văzut vreodată:
# stare: "asteapta" (în cadru, nescoasă încă) / "scoasa" / "luata" (scoasă >= SECUNDE_MIN_SCOASA și pusă la loc)
cutii = {}
# Markere văzute, dar încă neconfirmate: id -> (prima vedere, ultima vedere)
candidati = {}


def trimite_eveniment(marker, tip):
    try:
        r = requests.post(
            f"{MEDGUARD_API}/events",
            json={"marker_id": marker, "event_type": tip},
            timeout=5,
        )
        print(f"[MedGuard] {marker} {tip} -> {r.status_code} {r.text[:120]}", flush=True)
    except requests.RequestException as e:
        print(f"[MedGuard] {marker} {tip} netrimis: {e}", flush=True)


def actualizeaza_cutii(vazute, acum):
    """vazute = set de ID-uri ArUco detectate în cadrul curent."""
    for mid in vazute:
        if mid in cutii:
            continue
        prima, ultima = candidati.get(mid, (acum, acum))
        if acum - ultima > 0.3:  # a dispărut între timp: o luăm de la capăt
            prima = acum
        candidati[mid] = (prima, acum)
        if acum - prima >= SECUNDE_CONFIRMARE:
            del candidati[mid]
            cutii[mid] = {
                "stare": "asteapta",
                "termen": acum + DURATA_ALARMEI,
                "ultima_vedere": acum,
                "prima_revedere": None,
                "scoasa_la": None,
                "nota": "",
            }
            print(f"[ArUco] cutie nouă: ID {mid}", flush=True)

    for mid, c in cutii.items():
        if mid in vazute:
            c["ultima_vedere"] = acum
            if c["stare"] == "scoasa":
                if c["prima_revedere"] is None:
                    c["prima_revedere"] = acum
                elif acum - c["prima_revedere"] >= SECUNDE_PREZENTA:
                    # Cât a stat afară: de la ultima vedere înainte de scoatere până la revenire.
                    afara = c["prima_revedere"] - c["scoasa_la"]
                    if afara >= SECUNDE_MIN_SCOASA:
                        c["stare"] = "luata"
                        c["termen"] = None
                        c["nota"] = f"scoasă {int(afara)} s"
                        print(f"[ArUco] ID {mid} luată ({int(afara)} s afară)", flush=True)
                        Thread(
                            target=trimite_eveniment,
                            args=(f"{PREFIX_MARKER}{mid}", "accessed"),
                            daemon=True,
                        ).start()
                    else:
                        c["stare"] = "asteapta"  # termenul inițial rămâne
                        c["nota"] = f"pusă înapoi după {int(afara)} s (minim {SECUNDE_MIN_SCOASA} s)"
                        print(f"[ArUco] ID {mid} pusă înapoi prea repede ({int(afara)} s)", flush=True)
                    c["scoasa_la"] = None
        else:
            c["prima_revedere"] = None
            if c["stare"] != "scoasa" and acum - c["ultima_vedere"] >= SECUNDE_ABSENTA:
                c["stare"] = "scoasa"
                c["scoasa_la"] = c["ultima_vedere"]
                print(f"[ArUco] ID {mid} scoasă", flush=True)


ETICHETE = {"asteapta": "asteapta", "scoasa": "scoasa", "luata": "luata"}
CULORI = {"asteapta": (0, 200, 255), "scoasa": (255, 160, 0), "luata": (0, 220, 0)}


def captura():
    global ultimul_jpg

    while not stop_all.is_set():
        ok, cadru = camera.read()
        if not ok:
            time.sleep(0.1)
            continue

        gri = cv2.cvtColor(cadru, cv2.COLOR_BGR2GRAY)
        colturi, ids, _ = detecteaza(gri)
        vazute = set() if ids is None else {int(i) for i in ids.flatten()}
        acum = time.monotonic()

        with state_lock:
            actualizeaza_cutii(vazute, acum)
            stari = {mid: c["stare"] for mid, c in cutii.items()}
            alarma = {mid for mid, c in cutii.items()
                      if c["stare"] == "asteapta" and acum >= c["termen"]}

        if ids is not None:
            for colt, mid in zip(colturi, ids.flatten()):
                mid = int(mid)
                pts = colt[0].astype(int)
                if mid not in stari:  # încă neconfirmat
                    culoare, text = (160, 160, 160), "..."
                elif mid in alarma:
                    culoare, text = (0, 0, 255), "ALARMA"
                else:
                    culoare, text = CULORI[stari[mid]], ETICHETE[stari[mid]]
                cv2.polylines(cadru, [pts], True, culoare, 3)
                eticheta = f"ID {mid} - {text}"
                x, y = pts[:, 0].min(), pts[:, 1].min() - 8
                cv2.putText(cadru, eticheta, (int(x), int(max(y, 15))),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 4)
                cv2.putText(cadru, eticheta, (int(x), int(max(y, 15))),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, culoare, 2)

        ok, jpg = cv2.imencode(".jpg", cadru, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if ok:
            with frame_lock:
                ultimul_jpg = jpg.tobytes()


@app.route("/")
def index():
    return """
<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Camera medicament</title>
<style>
body { background:#171717; color:white; font:16px sans-serif; text-align:center; margin:0; padding:16px; }
#feed { width:min(640px, 100%); aspect-ratio:4/3; display:block; margin:auto; border-radius:8px; }
#cutii { list-style:none; padding:0; max-width:640px; margin:16px auto; text-align:left; }
#cutii li { padding:10px 14px; margin:6px 0; border-radius:6px; background:#262626; }
.asteapta { border-left:6px solid #ffc800; }
.scoasa { border-left:6px solid #00a0ff; }
.luata { border-left:6px solid #00dc00; }
.alarma { border-left:6px solid #ff3030; background:#3a1414 !important; }
</style>
</head>
<body>
<h2>Monitorizare cutii medicamente</h2>
<p>Cutiile sunt recunoscute automat după codul ArUco.</p>
<img id="feed" src="/video_feed">
<ul id="cutii"><li>Nicio cutie detectată încă.</li></ul>

<script>
const lista = document.getElementById("cutii");
async function actualizeazaStatus() {
  try {
    const data = await (await fetch("/status")).json();
    if (!data.cutii.length) {
      lista.innerHTML = "<li>Nicio cutie detectată încă. Așază cutiile în cadru.</li>";
      return;
    }
    lista.innerHTML = data.cutii.map(c =>
      `<li class="${c.alarma ? "alarma" : c.stare}"><b>ID ${c.id}</b> (${c.marker}) — ${c.mesaj}</li>`
    ).join("");
  } catch (e) {}
}
setInterval(actualizeazaStatus, 1000);
actualizeazaStatus();
</script>
</body>
</html>
"""


@app.route("/status")
def status():
    acum = time.monotonic()
    rezultat = []
    with state_lock:
        for mid in sorted(cutii):
            c = cutii[mid]
            alarma = c["stare"] == "asteapta" and acum >= c["termen"]
            if c["stare"] == "luata":
                mesaj = f"Luată ({c['nota']}) și pusă la loc. Trimis în aplicație."
            elif c["stare"] == "scoasa":
                afara = int(acum - c["scoasa_la"])
                if afara >= SECUNDE_MIN_SCOASA:
                    mesaj = f"Scoasă de {afara} s. Poți pune cutia la loc."
                else:
                    mesaj = f"Scoasă de {afara} s — mai ține-o afară {SECUNDE_MIN_SCOASA - afara} s."
            elif alarma:
                mesaj = "ALARMĂ: cutia nu a fost luată la timp!"
            else:
                secunde = max(0, int(c["termen"] - acum))
                mesaj = f"Aștept scoaterea cutiei. Timp rămas: {secunde // 60}:{secunde % 60:02d}"
            if c["stare"] == "asteapta" and c["nota"]:
                mesaj += f" (Ultima dată: {c['nota']}, nu s-a înregistrat.)"
            rezultat.append({
                "id": mid,
                "marker": f"{PREFIX_MARKER}{mid}",
                "stare": c["stare"],
                "alarma": alarma,
                "mesaj": mesaj,
            })
    return jsonify(cutii=rezultat)


@app.route("/video_feed")
def video_feed():
    def cadre():
        while not stop_all.is_set():
            with frame_lock:
                jpg = ultimul_jpg
            if jpg is not None:
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
            time.sleep(0.04)

    return Response(cadre(), mimetype="multipart/x-mixed-replace; boundary=frame")


def controleaza_ledurile():
    led_alb, led_verde, led_rosu = leduri
    led_alb.on()

    while not stop_all.is_set():
        acum = time.monotonic()
        with state_lock:
            alarmata = any(c["stare"] == "asteapta" and acum >= c["termen"] for c in cutii.values())
            # Verde: toate cutiile văzute au fost scoase și puse la loc.
            toate_puse = bool(cutii) and all(c["stare"] == "luata" for c in cutii.values())

        led_verde.value = toate_puse and not alarmata
        led_rosu.value = alarmata

        if alarmata:
            buzzer.value = 0.5
            time.sleep(0.4)
            buzzer.off()
            time.sleep(0.6)
        else:
            buzzer.off()
            time.sleep(0.1)


if __name__ == "__main__":
    Thread(target=captura, daemon=True).start()
    Thread(target=controleaza_ledurile, daemon=True).start()
    print(f"Camera: {CAMERA_DEV}")
    print(f"Deschide: http://IP-UL-PI-ULUI:{PORT}/")
    print(f"MedGuard: {MEDGUARD_API}  marker: {PREFIX_MARKER}<ID>  alarmă după {DURATA_ALARMEI}s", flush=True)

    try:
        app.run(host="0.0.0.0", port=PORT, threaded=True, use_reloader=False)
    finally:
        stop_all.set()
        buzzer.off()
        camera.release()
        for led in leduri:
            led.off()
            led.close()
        buzzer.close()
