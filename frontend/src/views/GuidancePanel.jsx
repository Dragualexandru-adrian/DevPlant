import { Icon, Card } from '../ui.jsx';

const Row = ({ label, value, strong }) => (
  <div className="flex flex-col gap-0.5">
    <dt className="font-label text-label-md text-on-surface-variant">{label}</dt>
    <dd className={`font-body text-body-md ${value ? 'text-on-surface' : 'text-on-surface-variant italic'} ${strong ? 'font-semibold' : ''}`}>
      {value || 'Nu este precizat în prospect'}
    </dd>
  </div>
);

const List = ({ label, items, tone }) => (
  <div className={`flex flex-col gap-1.5 rounded-md p-3.5 ${tone === 'warning' ? 'bg-warning-container text-on-warning-container' : 'bg-surface-container-low'}`}>
    <p className="font-label text-label-lg flex items-center gap-1.5">
      {tone === 'warning' && <Icon n="emergency" size={18} />}
      {label}
    </p>
    {items.length ? (
      <ul className="list-disc pl-5 font-body text-body-md flex flex-col gap-0.5">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    ) : (
      <p className="font-body text-body-sm italic">Nu sunt precizate în prospect</p>
    )}
  </div>
);

// Rezumatul AI din prospectul oficial ANM (GET /catalog/{id}/guidance).
// state: { kind: 'loading' } | { kind: 'error', message } | { kind: 'done', data }
export default function GuidancePanel({ entry, state, onRetry }) {
  const g = state.kind === 'done' ? state.data : null;
  const interval = g
    ? g.interval_doze_ore != null
      ? `Cel puțin ${g.interval_doze_ore} ore${g.interval_doze_text ? ` (${g.interval_doze_text})` : ''}`
      : g.interval_doze_text
    : null;

  return (
    <Card className="p-6 flex flex-col gap-4" aria-live="polite">
      <div className="flex items-start gap-3">
        <Icon n="menu_book" size={24} className="text-primary shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h2 className="font-title text-title-lg">Pe scurt din prospect</h2>
          <p className="font-body text-body-sm text-on-surface-variant">{entry.name}{entry.concentration ? ` • ${entry.concentration}` : ''}</p>
        </div>
      </div>

      {state.kind === 'loading' && (
        <p className="font-body text-body-md text-on-surface-variant">Se citește prospectul oficial…</p>
      )}

      {state.kind === 'error' && (
        <div className="flex flex-col gap-3">
          <p className="font-body text-body-sm text-warning">Rezumatul nu este disponibil: {state.message}</p>
          <button type="button" onClick={onRetry} className="self-start px-4 py-2 rounded-md bg-secondary-container text-on-secondary-container font-label text-label-lg hover:bg-surface-container-highest transition-colors duration-state-change">
            Încearcă din nou
          </button>
        </div>
      )}

      {g && (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Row label="Mod de utilizare" value={g.mod_utilizare} /></div>
            <Row label="Doza obișnuită" value={g.doza_uzuala} />
            <Row label="Interval între doze" value={interval} strong />
            <div className="sm:col-span-2"><Row label="Doza maximă pe zi" value={g.doza_maxima_zilnica} /></div>
          </dl>
          <List label="Reacții adverse principale" items={g.efecte_adverse_principale} />
          <List label="Mergeți imediat la medic dacă apar" items={g.efecte_adverse_grave} tone="warning" />
          <p className="font-body text-body-sm text-on-surface-variant">{g.disclaimer}</p>
        </>
      )}

      {entry.leaflet_url && (
        <a href={entry.leaflet_url} target="_blank" rel="noreferrer" className="self-start inline-flex items-center gap-1.5 font-label text-label-lg text-primary hover:underline">
          Prospectul oficial (PDF)
          <Icon n="open_in_new" size={16} />
        </a>
      )}
    </Card>
  );
}
