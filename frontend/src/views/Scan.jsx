import { useRef, useState } from 'react';
import { Icon, Card, btnPrimary } from '../ui.jsx';
import { recognizeText, parseMedication } from '../services/ocr.js';

const input = 'w-full px-3.5 py-2.5 rounded-md bg-surface-container-lowest border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary font-body text-body-md';
const DAYS = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];

const Field = ({ label, hint, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="font-label text-label-lg text-on-surface">{label}</span>
    {children}
    {hint && <span className="font-body text-body-sm text-on-surface-variant">{hint}</span>}
  </label>
);

export default function Scan({ onSave, onCancel }) {
  const imgRef = useRef(null);
  const [src, setSrc] = useState('');
  const [state, setState] = useState({ kind: 'idle' }); // idle | reading | done | error
  const [f, setF] = useState({ name: '', strength: '', perDose: 1, times: '08:00', stock: 30, days: DAYS, endDate: '' });

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSrc(URL.createObjectURL(file));
    setState({ kind: 'idle' });
  };

  const read = async () => {
    setState({ kind: 'reading' });
    try {
      const text = await recognizeText(imgRef.current);
      const p = parseMedication(text);
      setF((x) => ({ ...x, name: p.name || x.name, strength: p.strength || x.strength }));
      setState({ kind: 'done', found: Boolean(p.name || p.strength) });
    } catch (err) {
      setState({ kind: 'error', noModel: err.message === 'NO_MODEL' });
    }
  };

  const times = f.times.match(/\d{1,2}:\d{2}/g)?.map((t) => t.padStart(5, '0')) ?? [];
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
      <Card className="lg:col-span-5 p-6 flex flex-col gap-4">
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
            <p className="font-body text-body-sm text-on-surface-variant">
              {state.found ? 'Am completat ce am găsit. Verificați datele din formular.' : 'Nu am găsit numele sau concentrația. Completați-le manual.'}
            </p>
          )}
          {state.kind === 'error' && (
            <p className="font-body text-body-sm text-warning">
              {state.noModel ? 'Citirea automată nu este disponibilă acum. Completați datele manual.' : 'Citirea a eșuat. Încercați o poză mai clară sau completați manual.'}
            </p>
          )}
        </div>
      </Card>

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
