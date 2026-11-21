import { Badge } from '../ui.jsx';
import { useAccessibility } from '../context/AccessibilityContext.jsx';

const STRINGS = {
  ro: {
    heading: 'Jurnal interacțiuni și alerte',
    last24h: 'Ultimele 24 de ore',
    empty: 'Niciun eveniment înregistrat încă.',
    cols: ['Medicament', 'Oră eveniment', 'Eveniment detectat', 'Status final'],
  },
  en: {
    heading: 'Interaction and alert log',
    last24h: 'Last 24 hours',
    empty: 'No events logged yet.',
    cols: ['Medication', 'Event time', 'Detected event', 'Final status'],
  },
};

export default function History({ meds, events }) {
  const { lang } = useAccessibility();
  const s = STRINGS[lang] || STRINGS.ro;
  const med = (id) => meds.find((m) => m.id === id);
  const label = (m) => `${m.name} ${m.strength}`;

  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="history-heading" className="font-headline text-headline-md">{s.heading}</h2>
        <span className="font-body text-body-sm text-on-surface-variant">{s.last24h}</span>
      </div>

      {events.length === 0 ? (
        <p className="font-body text-body-md text-on-surface-variant bg-surface-container-lowest rounded-lg p-6 border border-outline-variant/30">
          {s.empty}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:hidden">
            {events.map((e) => {
              const m = med(e.medId);
              return (
                <div key={e.id} className="bg-surface-container-lowest rounded-lg p-5 border border-outline-variant/30 flex flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <h3 className="font-title text-title-md">{label(m)}</h3>
                    <Badge status={e.status} />
                  </div>
                  <p className="font-mono text-mono-sm text-on-surface-variant tabular-nums">{e.when}</p>
                  <p className="font-body text-body-md text-on-surface-variant">{e.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="hidden lg:block w-full overflow-x-auto bg-surface-container-lowest rounded-lg border border-outline-variant/30">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-low">
                  {s.cols.map((h) => (
                    <th key={h} scope="col" className="px-5 py-3.5 font-label text-label-md text-on-surface-variant">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {events.map((e) => {
                  const m = med(e.medId);
                  return (
                    <tr key={e.id} className="hover:bg-surface-container-low/60 transition-colors duration-state-change">
                      <td className="px-5 py-4 font-body text-body-md font-medium whitespace-nowrap">{label(m)}</td>
                      <td className="px-5 py-4 font-mono text-mono-md tabular-nums whitespace-nowrap">{e.when}</td>
                      <td className="px-5 py-4 font-body text-body-md text-on-surface-variant">{e.desc}</td>
                      <td className="px-5 py-4 whitespace-nowrap"><Badge status={e.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
