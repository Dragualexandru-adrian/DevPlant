import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Card, btnPrimary } from '../ui.jsx';
import { readLabel, parseMedication } from '../services/ocr.js';
import { getGuidance } from '../api.js';
import CatalogPicker from './CatalogPicker.jsx';
import GuidancePanel from './GuidancePanel.jsx';

const input = 'w-full px-3.5 py-2.5 rounded-md bg-surface-container-lowest border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary font-body text-body-md';
const DAYS = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];

const Field = ({ label, hint, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="font-label text-label-lg text-on-surface">{label}</span>
    {children}
    {hint && <span className="font-body text-body-sm text-on-surface-variant">{hint}</span>}
  </label>
);

// "PARACETAMOL 500 mg" -> "PARACETAMOL": concentrația are câmpul ei.
const baseName = (name) => name.replace(/\s+\d[\d.,]*\s*(mg|g|mcg|µg|ml|ui|%).*$/i, '').trim() || name;
// "500mg" -> "500 mg"
const spacedStrength = (c) => (c || '').replace(/(\d)\s*([a-zA-Zµ%])/, '$1 $2');

const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
// Cel mai mic interval (ore) între dozele unei zile, inclusiv peste miezul nopții.
function minGapHours(times) {
  if (times.length < 2) return null;
  const mins = [...new Set(times.map(toMinutes))].sort((a, b) => a - b);
  if (mins.length < 2) return 0;
  const gaps = mins.slice(1).map((m, i) => m - mins[i]);
  gaps.push(24 * 60 - mins[mins.length - 1] + mins[0]);
  return Math.min(...gaps) / 60;
}

export default function Scan({ onSave, onCancel }) {
  const imgRef = useRef(null);
  const [src, setSrc] = useState('');
  const [file, setFile] = useState(null);
  const [state, setState] = useState({ kind: 'idle' }); // idle | reading | done | error
  const [ocrMatches, setOcrMatches] = useState(null); // null = nicio scanare încă
  const [entry, setEntry] = useState(null); // medicamentul ales din lista ANM
  const [guidance, setGuidance] = useState(null); // vezi GuidancePanel
  const [f, setF] = useState({ name: '', strength: '', perDose: 1, times: '08:00', stock: 30, days: DAYS, endDate: '' });

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const onFile = (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setSrc(URL.createObjectURL(picked));
    setState({ kind: 'idle' });
  };

  const read = async () => {
    setState({ kind: 'reading' });
    try {
      const r = await readLabel(file, imgRef.current);
      const p = parseMedication(r.lines.join(' '));
      setOcrMatches(r.matches);
      setF((x) => ({ ...x, name: p.name || x.name, strength: p.strength || x.strength }));
      setState({ kind: 'done', found: r.matches.length > 0 || Boolean(p.name || p.strength), lines: r.lines });
    } catch (err) {
      setOcrMatches([]);
      setState({ kind: 'error', noModel: err.message === 'NO_MODEL' });
    }
  };

  // Doar ultimul medicament ales își poate afișa rezumatul (un răspuns întârziat nu îl suprascrie).
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
    setF((x) => ({ ...x, name: baseName(catalogEntry.name), strength: spacedStrength(catalogEntry.concentration) || x.strength }));
    loadGuidance(catalogEntry);
  };

  const times = f.times.match(/\d{1,2}:\d{2}/g)?.map((t) => t.padStart(5, '0')) ?? [];
  const minInterval = guidance?.kind === 'done' ? guidance.data.interval_doze_ore : null;
  const gap = minGapHours(times);
  const tooClose = minInterval != null && gap != null && gap < minInterval;
  const valid = f.name.trim() && f.strength.trim() && times.length && f.perDose > 0 && f.stock >= 0;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      name: f.name.trim(),
      strength: f.strength.trim(),
      perDose: Number(f.perDose),
      stock: Number(f.stock),
      times,
      days: f.days,
      endDate: f.endDate || null,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-5 flex flex-col gap-8">
      <Card className="p-6 flex flex-col gap-4">
        <h2 className="font-title text-title-lg">Fotografia cutiei</h2>
        <label className="flex flex-col items-center justify-center gap-2 min-h-[220px] rounded-md border border-dashed border-outline-variant bg-surface-container-low cursor-pointer overflow-hidden focus-within:ring-2 focus-within:ring-primary">
          {src ? (
            <img ref={imgRef} src={src} alt="Cutia de medicament fotografiată" className="w-full max-h-[320px] object-contain" />
          ) : (
            <>
              <Icon n="add_a_photo" size={32} className="text-primary" />
              <span className="font-label text-label-lg">Alege sau fă o poză</span>
              <span className="font-body text-body-sm text-on-surface-variant">Cutia dreaptă, cu lumină bună</span>
            </>
          )}
          <input type="file" accept="image/*" capture="environment" onChange={onFile} className="sr-only" />
        </label>
        <button type="button" className={btnPrimary} onClick={read} disabled={!src || state.kind === 'reading'}>
          <Icon n="document_scanner" size={18} />
          {state.kind === 'reading' ? 'Se citește…' : 'Citește textul'}
        </button>
        <div aria-live="polite">
          {state.kind === 'done' && (
            <div className="flex flex-col gap-1.5">
              <p className="font-body text-body-sm text-on-surface-variant">
                {state.found ? 'Alegeți medicamentul din lista de mai jos și verificați datele din formular.' : 'Nu am găsit numele sau concentrația. Căutați medicamentul mai jos sau completați manual.'}
              </p>
              {state.lines.length > 0 && (
                <p className="font-mono text-mono-sm text-on-surface-variant break-words">Text citit: {state.lines.join(' • ')}</p>
              )}
            </div>
          )}
          {state.kind === 'error' && (
            <p className="font-body text-body-sm text-warning">
              {state.noModel ? 'Citirea automată nu este disponibilă acum. Căutați medicamentul mai jos sau completați manual.' : 'Citirea a eșuat. Încercați o poză mai clară sau căutați medicamentul mai jos.'}
            </p>
          )}
        </div>
      </Card>

      <CatalogPicker ocrMatches={ocrMatches} selectedId={entry?.id} onSelect={choose} />
      {entry && guidance && <GuidancePanel entry={entry} state={guidance} onRetry={() => loadGuidance(entry)} />}
      </div>

      <Card className="lg:col-span-7 p-6">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <h2 className="font-title text-title-lg">Datele medicamentului</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nume medicament"><input className={input} value={f.name} onChange={(e) => set('name', e.target.value)} required /></Field>
            <Field label="Concentrație"><input className={input} value={f.strength} onChange={(e) => set('strength', e.target.value)} placeholder="500 mg" required /></Field>
            <Field label="Pastile per doză"><input className={input} type="number" min="1" value={f.perDose} onChange={(e) => set('perDose', e.target.value)} /></Field>
            <Field label="Stoc disponibil (pastile)"><input className={input} type="number" min="0" value={f.stock} onChange={(e) => set('stock', e.target.value)} /></Field>
          </div>
          <Field label="Ore de administrare" hint="Separate prin virgulă, de exemplu 08:00, 20:00">
            <input className={`${input} font-mono`} value={f.times} onChange={(e) => set('times', e.target.value)} />
          </Field>
          {minInterval != null && (
            <p role={tooClose ? 'alert' : undefined} className={`-mt-2 flex items-start gap-1.5 font-body text-body-sm ${tooClose ? 'text-warning' : 'text-on-surface-variant'}`}>
              <Icon n={tooClose ? 'warning' : 'schedule'} size={18} className="shrink-0" />
              {tooClose
                ? `Prospectul recomandă cel puțin ${minInterval} ore între doze. Între orele alese sunt doar ${Number(gap.toFixed(1))} ore.`
                : `Prospectul recomandă cel puțin ${minInterval} ore între doze.`}
            </p>
          )}
          <fieldset className="flex flex-col gap-2">
            <legend className="font-label text-label-lg mb-1.5">Zilele săptămânii</legend>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const on = f.days.includes(d);
                return (
                  <button key={d} type="button" aria-pressed={on}
                    onClick={() => set('days', on ? f.days.filter((x) => x !== d) : [...f.days, d])}
                    className={`w-11 h-11 rounded-full font-label text-label-md transition-colors duration-state-change ${on ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <Field label="Până la data (opțional)" hint="Lasă necompletat pentru tratament fără dată de final">
            <input className={input} type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </Field>
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-md bg-secondary-container text-on-secondary-container font-label text-label-lg hover:bg-surface-container-highest transition-colors duration-state-change">Anulează</button>
            <button type="submit" className={btnPrimary} disabled={!valid}>
              <Icon n="check" size={18} />
              Salvează medicamentul
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
