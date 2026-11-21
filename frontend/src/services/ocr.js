// OCR cu TensorFlow.js. TF.js nu include un model OCR: pune un model de recunoaștere
// (CRNN convertit cu tensorflowjs_converter) în public/models/ocr/ :
//   model.json (+ fișierele .bin) și charset.txt (un caracter pe linie, indexul 0 = "blank" CTC)
// Presupunere: intrare [1, 32, W, 1] (grayscale 0..1), ieșire [1, T, C]. Ajustează dacă modelul tău diferă.
import { scanLabel, searchCatalog } from '../api.js';

const MODEL_URL = '/models/ocr/model.json';
const CHARSET_URL = '/models/ocr/charset.txt';

let loading;
async function load() {
  const tf = await import('@tensorflow/tfjs');
  const [model, txt] = await Promise.all([
    tf.loadGraphModel(MODEL_URL),
    fetch(CHARSET_URL).then((r) => { if (!r.ok) throw new Error('charset'); return r.text(); }),
  ]);
  return { tf, model, charset: txt.split('\n') };
}

export async function recognizeText(img) {
  loading ||= load();
  let ctx;
  try { ctx = await loading; } catch { loading = null; throw new Error('NO_MODEL'); }
  const { tf, model, charset } = ctx;

  const input = tf.tidy(() => {
    const gray = tf.browser.fromPixels(img).mean(2, true);          // grayscale
    const w = Math.max(32, Math.round((gray.shape[1] / gray.shape[0]) * 32));
    const x = tf.image.resizeBilinear(gray, [32, w]).div(255);
    const min = x.min(), max = x.max();
    return x.sub(min).div(max.sub(min).add(1e-6)).expandDims(0);     // contrast maxim
  });
  const out = model.predict(input);
  const ids = Array.from(await out.argMax(-1).data());
  tf.dispose([input, out]);

  let prev = -1, text = '';
  for (const i of ids) { if (i !== prev && i !== 0) text += charset[i] ?? ''; prev = i; }
  return text;
}

// ---- Citirea etichetei: întâi serverul, apoi browserul ----
// Serverul rulează keras-ocr (TensorFlow) și potrivește textul cu lista ANM
// (backend/app/ocr.py). Dacă serverul nu are TensorFlow (503) sau nu răspunde,
// încercăm modelul TF.js din browser de mai sus; fără model -> completare manuală.
// Rezultat: { lines: string[], matches: [{ entry, score }], source: 'server' | 'browser' }
export async function readLabel(file, img) {
  try {
    const { lines, matches } = await scanLabel(file);
    return { lines, matches, source: 'server' };
  } catch (err) {
    // 4xx = poza în sine e problema (ex. nu e imagine); browserul n-ar face mai bine.
    if (err.status && err.status < 500) throw err;
  }
  const text = (await recognizeText(img)).trim();
  const name = parseMedication(text).name || text.split(/\s+/).find((w) => w.length > 3) || '';
  const matches = name.length >= 2 ? await searchCatalog(name, 5).catch(() => []) : [];
  return { lines: text ? [text] : [], matches, source: 'browser' };
}

// ---- Extragere nume + concentrație din text ----
const KNOWN = ['Metformin', 'Amlodipină', 'Atorvastatină', 'Paracetamol', 'Ibuprofen', 'Aspirină', 'Omeprazol', 'Losartan', 'Bisoprolol'];
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function parseMedication(text) {
  const s = text.match(/(\d+(?:[.,]\d+)?)\s?(mg|g|mcg|µg|ml)\b/i);
  let name = '', best = 0;
  for (const w of norm(text).split(/[^a-z]+/).filter((w) => w.length > 3))
    for (const k of KNOWN) {
      const score = 1 - lev(norm(k), w) / Math.max(k.length, w.length);
      if (score > best) { best = score; name = k; }
    }
  return { name: best >= 0.7 ? name : '', strength: s ? `${s[1]} ${s[2].toLowerCase()}` : '' };
}
