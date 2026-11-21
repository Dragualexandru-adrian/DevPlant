// Citirea cutiei direct pe telefon/în browser, cu Tesseract.js (fără server, fără model propriu).
// Datele de limbă (română) se descarcă o singură dată de pe CDN și rămân în cache-ul browserului.
//
// Numele comercial e aproape mereu textul cel mai mare de pe cutie, așa că propunem
// rândurile ordonate după înălțimea literelor; utilizatorul confirmă sau corectează.
import { createWorker, PSM } from 'tesseract.js';

const MAX_SIDE = 2000; // pozele de telefon au 3-4k px: mai mari doar încetinesc
let workerPromise = null;
let onProgress = null;

function getWorker() {
  workerPromise ||= createWorker('ron', 1, {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') onProgress(m.progress);
    },
  }).then(async (w) => {
    // Textul de pe ambalaje e împrăștiat (nume, concentrație, sigle): mod „sparse”.
    await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    return w;
  });
  workerPromise.catch(() => { workerPromise = null; });
  return workerPromise;
}

// Doar micșorăm pozele mari (viteză pe telefon). Fără alb-negru/contrast propriu:
// binarizarea internă a Tesseract a dat rezultate mai bune pe ambalaje în teste.
function prepare(img) {
  const scale = MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight);
  if (scale >= 1) return img;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const letters = (s) => (s.match(/\p{L}/gu) || []).length;
// Capete fără litere/cifre scoase; „Î” în mijlocul cuvântului e mereu un „I” citit greșit (FARÎNGO).
const clean = (s) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(/(?<=\p{L})Î/gu, 'I');
// „FARINGO HOT” -> „Faringo Hot”; „omega” -> „Omega”.
const titleCase = (s) => {
  const t = s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase()) : s;
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Cuvinte generice de pe ambalaje: nu sunt niciodată numele medicamentului.
const GENERIC = new Set(
  'comprimate comprimat filmate capsule capsula capsulas kapseln granule plicuri plic pentru solutie soluție orala orală sirop suspensie crema cremă gel unguent picaturi picături injectabila injectabilă flacon cutie tablete tabletten film mg ml mit und für fur the and with'.split(' '),
);
const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function* allLines(blocks) {
  for (const b of blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) yield l;
}

// Rânduri candidate pentru nume: cuvinte sigure, cu litere, grupate pe rând.
// Ordine: mărimea literelor × încrederea (o literă mare citită greșit nu câștigă).
function candidates(blocks) {
  const out = [];
  for (const line of allLines(blocks)) {
    const words = (line.words || [])
      .map((w) => ({ text: clean(w.text), conf: w.confidence, h: w.bbox.y1 - w.bbox.y0 }))
      .filter((w) => w.conf >= 50 && letters(w.text) >= 2 && letters(w.text) >= w.text.length / 2 && !GENERIC.has(plain(w.text)));
    if (!words.length) continue;
    const tallest = Math.max(...words.map((w) => w.h));
    const big = words.filter((w) => w.h >= tallest * 0.7);
    const text = big.map((w) => w.text).join(' ');
    const conf = big.reduce((s, w) => s + w.conf, 0) / big.length;
    if (letters(text) >= 3) out.push({ text: titleCase(text), score: tallest * (conf / 100) });
  }
  const seen = new Set();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      const k = c.text.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 6)
    .map((c) => c.text);
}

/**
 * Citește cutia din imaginea <img> deja încărcată.
 * @returns {Promise<{ name: string, strength: string, candidates: string[], lines: string[], text: string }>}
 */
export async function readBox(img, progress) {
  onProgress = progress;
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(prepare(img), {}, { text: true, blocks: true });
    const text = data.text || '';
    const list = candidates(data.blocks);
    const s = text.match(/(\d+(?:[.,]\d+)?)\s?(mg|g|mcg|µg|ml|ui)\b/i);
    const rest = text.split('\n').map((l) => l.trim()).filter((l) => letters(l) >= 3);
    return {
      name: list[0] || '',
      strength: s ? `${s[1]} ${s[2].toLowerCase()}` : '',
      candidates: list,
      lines: [...list, ...rest], // pentru potrivirea cu lista ANM: textul cel mai mare primul
      text,
    };
  } finally {
    onProgress = null;
  }
}
