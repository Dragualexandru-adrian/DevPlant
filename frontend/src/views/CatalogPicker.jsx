import { useEffect, useState } from 'react';
import { Icon, Card } from '../ui.jsx';
import { searchCatalog } from '../api.js';

const input = 'w-full px-3.5 py-2.5 rounded-md bg-surface-container-lowest border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary font-body text-body-md';

// Identificarea medicamentului în lista ANM: potrivirile găsite de OCR + căutare manuală.
// Utilizatorul confirmă mereu varianta; nimic nu se alege automat.
export default function CatalogPicker({ ocrMatches, selectedId, onSelect }) {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState({ query: '', results: [], error: '' });

  const query = q.trim();
  useEffect(() => {
    if (query.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchCatalog(query)
        .then((results) => { if (!cancelled) setSearch({ query, results, error: '' }); })
        .catch((e) => { if (!cancelled) setSearch({ query, results: [], error: e.message }); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  // Rezultatele contează doar pentru textul scris acum; altfel arătăm potrivirile OCR.
  const current = query.length >= 2 && search.query === query ? search : null;
  const found = current && !current.error ? current.results : null;
  const error = current?.error ?? '';
  const results = found ?? ocrMatches ?? [];
  const heading = found
    ? 'Rezultatele căutării'
    : ocrMatches?.length
      ? 'Potriviri pentru textul citit'
      : ocrMatches
        ? 'Nu am găsit medicamentul după text. Căutați-l după nume'
        : '';

  return (
    <Card className="p-6 flex flex-col gap-4">
      <div>
        <h2 className="font-title text-title-lg">Identificare în lista ANM</h2>
        <p className="font-body text-body-sm text-on-surface-variant mt-1">Alegeți medicamentul exact de pe cutie pentru a vedea modul de administrare.</p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="font-label text-label-lg text-on-surface">Caută după nume sau substanță activă</span>
        <div className="relative">
          <Icon n="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input className={`${input} pl-10`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="De exemplu Paracetamol" />
        </div>
      </label>
      {error && <p className="font-body text-body-sm text-warning">{error}</p>}
      {heading && <p className="font-label text-label-md text-on-surface-variant">{heading}</p>}
      {results.length > 0 && (
        <ul className="flex flex-col gap-2 max-h-[340px] overflow-y-auto">
          {results.map(({ entry }) => {
            const on = entry.id === selectedId;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSelect(entry)}
                  className={`w-full text-left px-3.5 py-3 rounded-md border transition-colors duration-state-change ${
                    on ? 'bg-primary-container border-primary text-on-primary-container' : 'bg-surface-container-lowest border-outline-variant/40 hover:bg-surface-container-low'
                  }`}
                >
                  <span className="font-title text-title-md block">{entry.name}</span>
                  <span className="font-body text-body-sm text-on-surface-variant block">
                    {[entry.concentration, entry.form, entry.dci].filter(Boolean).join(' • ')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {found && found.length === 0 && <p className="font-body text-body-sm text-on-surface-variant">Niciun rezultat în lista ANM.</p>}
    </Card>
  );
}
