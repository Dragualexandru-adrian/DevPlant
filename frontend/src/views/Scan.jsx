import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Card, btnPrimary } from '../ui.jsx';
import { readBox } from '../services/ocr.js';
import { getGuidance, matchCatalog } from '../api.js';
import CatalogPicker from './CatalogPicker.jsx';
import GuidancePanel from './GuidancePanel.jsx';

// "FARINGO HOT DRINK 500 mg/200 mg/4 mg" -> "FARINGO HOT DRINK": concentrația are câmpul ei.
const baseName = (name) => name.replace(/\s+\d[\d.,]*\s*(mg|g|mcg|µg|ml|ui|%).*$/i, '').trim() || name;
const spacedStrength = (c) => (c || '').replace(/(\d)\s*([a-zA-Zµ%])/, '$1 $2');
const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
// Cel mai mic interval (ore) între dozele unei zile, inclusiv peste miezul nopții.
function minGapHours(times) {
  const mins = [...new Set(times.map(toMinutes))].sort((a, b) => a - b);
  if (mins.length < 2) return null;
  const gaps = mins.slice(1).map((m, i) => m - mins[i]);
  gaps.push(24 * 60 - mins[mins.length - 1] + mins[0]);
  return Math.min(...gaps) / 60;
}

const input =
  'w-full px-3.5 py-3 rounded-md bg-surface-container-lowest border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary font-body text-body-md';

// Ore propuse în funcție de câte ori pe zi se ia medicamentul (se pot schimba).
const DEFAULT_TIMES = {
  1: ['08:00'],
  2: ['08:00', '20:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['08:00', '12:00', '16:00', '20:00'],
};

const Question = ({ n, title, hint, children }) => (
  <fieldset className="flex flex-col gap-3">
    <legend className="flex items-start gap-3">
      <span className="w-7 h-7 shrink-0 rounded-full bg-primary-container text-on-primary-container font-label text-label-lg flex items-center justify-center">
        {n}
      </span>
      <span className="flex flex-col">
        <span className="font-title text-title-md text-on-surface">{title}</span>
        {hint && <span className="font-body text-body-sm text-on-surface-variant">{hint}</span>}
      </span>
    </legend>
    <div className="pl-10">{children}</div>
  </fieldset>
);

function Stepper({ value, onChange, min = 0, max = 999, step = 1, label }) {
  const btn =
    'w-12 h-12 rounded-md bg-secondary-container text-on-secondary-container flex items-center justify-center hover:bg-surface-container-highest active:bg-surface-container-highest transition-colors duration-state-change disabled:opacity-40';
  const clamp = (v) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={btn} aria-label={`Mai puțin: ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - step))}>
        <Icon n="remove" size={22} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        className={`${input} w-24 text-center font-mono text-title-lg tabular-nums`}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
      />
      <button type="button" className={btn} aria-label={`Mai mult: ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + step))}>
        <Icon n="add" size={22} />
      </button>
    </div>
  );
}

export default function Scan({ onSave, onCancel }) {
  const imgRef = useRef(null);
  const [src, setSrc] = useState('');
  const [ocr, setOcr] = useState({ kind: 'idle' }); // idle | reading | done | error
  const [name, setName] = useState('');
  const [strength, setStrength] = useState('');
  const [stock, setStock] = useState(30);
  const [perDose, setPerDose] = useState(1);
  const [times, setTimes] = useState(DEFAULT_TIMES[1]);
  const [marker, setMarker] = useState('');
  const [save, setSave] = useState({ kind: 'idle' }); // idle | saving | error
  const [matches, setMatches] = useState(null); // potriviri ANM pentru textul citit (null = încă nimic)
  const [entry, setEntry] = useState(null); // medicamentul ales din lista ANM
  const [guidance, setGuidance] = useState(null); // vezi GuidancePanel

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  // Doar ultimul medicament ales își afișează rezumatul (un răspuns întârziat nu îl suprascrie).
  const guidanceReq = useRef(0);
  const loadGuidance = useCallback((catalogEntry) => {
    const req = ++guidanceReq.current;
    setGuidance({ kind: 'loading' });
    getGuidance(catalogEntry.id)
      .then((data) => { if (req === guidanceReq.current) setGuidance({ kind: 'done', data }); })
      .catch((err) => { if (req === guidanceReq.current) setGuidance({ kind: 'error', message: err.message }); });
  }, []);

  const choose = (catalogEntry) => {
    setEntry(catalogEntry);
    setName(baseName(catalogEntry.name));
    if (catalogEntry.concentration) setStrength(spacedStrength(catalogEntry.concentration));
    loadGuidance(catalogEntry);
  };

  const onFile = (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setSrc(URL.createObjectURL(picked));
    setOcr({ kind: 'reading', progress: 0 });
  };

  // Citirea pornește singură când poza s-a încărcat în <img>.
  const read = async () => {
    setOcr({ kind: 'reading', progress: 0 });
    try {
      const r = await readBox(imgRef.current, (p) => setOcr({ kind: 'reading', progress: p }));
      setOcr({ kind: 'done', candidates: r.candidates });
      if (r.name) setName(r.name);
      if (r.strength) setStrength(r.strength);
      setEntry(null);
      setGuidance(null);
      setMatches(null);
      matchCatalog(r.lines).then(setMatches).catch(() => setMatches([]));
    } catch (err) {
      console.error(err);
      setOcr({ kind: 'error' });
    }
  };

  const setCount = (n) => setTimes((cur) => (cur.length === n ? cur : DEFAULT_TIMES[n]));
  const setTime = (i, v) => setTimes((cur) => cur.map((t, j) => (j === i ? v : t)));

  const sortedTimes = [...new Set(times.filter(Boolean))].sort();
  const markerNum = marker.trim() === '' ? null : Number(marker);
  const markerOk = markerNum === null || (Number.isInteger(markerNum) && markerNum >= 0 && markerNum < 50);
  const valid = name.trim() && sortedTimes.length > 0 && perDose > 0 && stock >= 0 && markerOk;
  const minInterval = guidance?.kind === 'done' ? guidance.data.interval_doze_ore : null;
  const gap = minGapHours(sortedTimes);
  const tooClose = minInterval != null && gap != null && gap < minInterval;
  const perDay = perDose * sortedTimes.length;
  const days = perDay ? Math.floor(stock / perDay) : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || save.kind === 'saving') return;
    setSave({ kind: 'saving' });
    try {
      await onSave({
        name: name.trim(),
        strength: strength.trim(),
        perDose,
        stock,
        times: sortedTimes,
        markerId: markerNum === null ? null : `MED-DEMO-${markerNum}`,
      });
    } catch (err) {
      setSave({
        kind: 'error',
        message: /marker_id/.test(err.message)
          ? `Codul ${markerNum} este deja folosit de alt medicament.`
          : `Nu s-a putut salva: ${err.message}`,
      });
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
      <Card className="lg:col-span-5 p-4 sm:p-6 flex flex-col gap-4">
        <h2 className="font-title text-title-lg">Fotografia cutiei</h2>
        <label className="flex flex-col items-center justify-center gap-2 min-h-[200px] rounded-md border border-dashed border-outline-variant bg-surface-container-low cursor-pointer overflow-hidden focus-within:ring-2 focus-within:ring-primary">
          {src ? (
            <img ref={imgRef} src={src} onLoad={read} alt="Cutia de medicament fotografiată" className="w-full max-h-[300px] object-contain" />
          ) : (
            <>
              <Icon n="add_a_photo" size={36} className="text-primary" />
              <span className="font-label text-label-lg">Fă o poză cutiei</span>
              <span className="font-body text-body-sm text-on-surface-variant px-4 text-center">De aproape: cutia să umple poza, cu numele la vedere și lumină bună</span>
            </>
          )}
          <input type="file" accept="image/*" capture="environment" onChange={onFile} className="sr-only" />
        </label>

        <div aria-live="polite">
          {ocr.kind === 'reading' && (
            <div className="flex flex-col gap-2">
              <p className="font-body text-body-sm text-on-surface-variant flex items-center gap-2">
                <Icon n="hourglass_top" size={18} className="animate-pulse" />
                {ocr.progress > 0 ? `Se citește textul… ${Math.round(ocr.progress * 100)}%` : 'Se pregătește citirea (prima dată durează puțin mai mult)…'}
              </p>
              <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
                <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${Math.round((ocr.progress || 0.03) * 100)}%` }} />
              </div>
            </div>
          )}
          {ocr.kind === 'done' && (
            <p className="font-body text-body-sm text-on-surface-variant">
              {ocr.candidates.length ? 'Verificați numele mai jos. Atingeți alt text citit dacă numele nu e corect.' : 'Nu am putut citi numele. Scrieți-l mai jos sau încercați o poză mai apropiată.'}
            </p>
          )}
          {ocr.kind === 'error' && (
            <p className="font-body text-body-sm text-warning">
              Citirea a eșuat (este nevoie de internet prima dată). Scrieți numele mai jos.
            </p>
          )}
        </div>
      </Card>

      {(matches !== null || entry) && (
        <div className="lg:col-span-5 lg:col-start-1 flex flex-col gap-6 sm:gap-8">
          <CatalogPicker ocrMatches={matches} selectedId={entry?.id} onSelect={choose} />
          {entry && guidance && <GuidancePanel entry={entry} state={guidance} onRetry={() => loadGuidance(entry)} />}
        </div>
      )}

      <Card className="lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:row-span-2 p-4 sm:p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="med-name" className="font-title text-title-lg">Medicamentul</label>
          <input id="med-name" className={`${input} font-title text-title-md`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Numele de pe cutie" required />
          {ocr.kind === 'done' && ocr.candidates.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {ocr.candidates.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setName(c)}
                  aria-pressed={name === c}
                  className={`px-3 py-1.5 rounded-full font-label text-label-md transition-colors duration-state-change ${
                    name === c ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          {strength && (
            <p className="font-body text-body-sm text-on-surface-variant">
              Concentrație citită: <span className="font-mono">{strength}</span>{' '}
              <button type="button" className="underline" onClick={() => setStrength('')}>șterge</button>
            </p>
          )}
        </div>

        <Question n={1} title="Câte pastile sunt în flacon?">
          <Stepper label="Pastile în flacon" value={stock} onChange={setStock} min={0} max={999} />
        </Question>

        <Question n={2} title="De câte ori pe zi o ia?">
          <div className="grid grid-cols-4 gap-2 max-w-xs" role="radiogroup" aria-label="De câte ori pe zi">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={times.length === n}
                onClick={() => setCount(n)}
                className={`h-12 rounded-md font-title text-title-md transition-colors duration-state-change ${
                  times.length === n ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {n}×
              </button>
            ))}
          </div>
        </Question>

        <Question n={3} title="La ce oră?">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {times.map((t, i) => (
              <input key={i} type="time" aria-label={`Ora dozei ${i + 1}`} className={`${input} font-mono text-center`} value={t} onChange={(e) => setTime(i, e.target.value)} required />
            ))}
          </div>
          {minInterval != null && (
            <p role={tooClose ? 'alert' : undefined} className={`mt-2 flex items-start gap-1.5 font-body text-body-sm ${tooClose ? 'text-warning' : 'text-on-surface-variant'}`}>
              <Icon n={tooClose ? 'warning' : 'schedule'} size={18} className="shrink-0" />
              {tooClose
                ? `Prospectul recomandă cel puțin ${minInterval} ore între doze. Între orele alese sunt doar ${Number(gap.toFixed(1))} ore.`
                : `Prospectul recomandă cel puțin ${minInterval} ore între doze.`}
            </p>
          )}
        </Question>

        <Question n={4} title="Câte pastile o dată?">
          <Stepper label="Pastile per doză" value={perDose} onChange={setPerDose} min={1} max={10} />
          {perDay > 0 && (
            <p className="font-body text-body-sm text-on-surface-variant mt-2">
              {perDay} {perDay === 1 ? 'pastilă' : 'pastile'} pe zi • flaconul ajunge {days} {days === 1 ? 'zi' : 'zile'}
            </p>
          )}
        </Question>

        <details className="group rounded-md bg-surface-container-low p-4">
          <summary className="cursor-pointer font-label text-label-lg text-on-surface flex items-center gap-2 list-none">
            <Icon n="qr_code_2" size={20} />
            Flaconul are cod de monitorizare? (opțional)
            <Icon n="expand_more" size={20} className="ml-auto transition-transform group-open:rotate-180" />
          </summary>
          <label className="flex flex-col gap-1.5 mt-3">
            <span className="font-body text-body-sm text-on-surface-variant">Numărul codului pătrat lipit pe flacon, ca să-l recunoască camera.</span>
            <input className={`${input} w-32 font-mono`} inputMode="numeric" value={marker} onChange={(e) => setMarker(e.target.value.replace(/\D/g, ''))} placeholder="ex. 5" />
            {!markerOk && <span className="font-body text-body-sm text-warning">Introduceți un număr între 0 și 49.</span>}
          </label>
        </details>

        {save.kind === 'error' && <p role="alert" className="font-body text-body-sm text-error">{save.message}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] px-5 py-2.5 rounded-md bg-secondary-container text-on-secondary-container font-label text-label-lg hover:bg-surface-container-highest transition-colors duration-state-change"
          >
            Anulează
          </button>
          <button type="submit" className={`${btnPrimary} min-h-[48px]`} disabled={!valid || save.kind === 'saving'}>
            <Icon n="check" size={20} />
            {save.kind === 'saving' ? 'Se salvează…' : 'Salvează medicamentul'}
          </button>
        </div>
      </Card>
    </form>
  );
}
