import { useState } from 'react';
import Dashboard from './views/Dashboard.jsx';
import Scan from './views/Scan.jsx';
import { Icon, btnPrimary } from './ui.jsx';
import { user, seedMeds, seedDoses, seedEvents } from './data.js';

const nowHM = () => new Date().toTimeString().slice(0, 5);

const NAV = [
  { id: 'panou', label: 'Panou principal', icon: 'dashboard', view: 'panou' },
  { id: 'scanare', label: 'Adaugă cu OCR', icon: 'document_scanner', view: 'scanare' },
  { id: 'istoric', label: 'Istoric & Alerte', icon: 'history', view: 'panou', anchor: 'istoric' },
  { id: 'hardware', label: 'Dispozitiv Pi 4', icon: 'memory', view: 'panou', anchor: 'hardware' },
];

export default function App() {
  const [view, setView] = useState('panou');
  const [active, setActive] = useState('panou');
  const [meds, setMeds] = useState(seedMeds);
  const [doses, setDoses] = useState(seedDoses);
  const [events, setEvents] = useState(seedEvents);

  const go = (item) => {
    setView(item.view);
    setActive(item.id);
    setTimeout(() => {
      if (item.anchor) document.getElementById(item.anchor)?.scrollIntoView({ behavior: 'smooth' });
      else window.scrollTo({ top: 0 });
    }, 0);
  };

  const pushEvent = (medId, desc, status) =>
    setEvents((e) => [{ id: crypto.randomUUID(), medId, when: `Azi, ${nowHM()}`, desc, status }, ...e]);

  const confirmDose = (dose) => {
    setDoses((d) => d.map((x) => (x.id === dose.id ? { ...x, status: 'confirmed', at: nowHM() } : x)));
    setMeds((m) => m.map((x) => (x.id === dose.medId ? { ...x, stock: Math.max(0, x.stock - x.perDose) } : x)));
    pushEvent(dose.medId, 'Confirmare manuală în aplicație', 'confirmed');
  };

  // Pentru demo fără Raspberry Pi: simulează ridicarea flaconului
  const simulatePickup = () => {
    const next = doses.find((d) => d.status === 'scheduled');
    if (!next) return;
    setDoses((d) => d.map((x) => (x.id === next.id ? { ...x, status: 'accessed', at: nowHM() } : x)));
    pushEvent(next.medId, 'Flacon ridicat și reașezat (LED verde)', 'accessed');
  };

  const addMed = (m) => {
    const id = Math.max(0, ...meds.map((x) => x.id)) + 1;
    const aruco = Math.max(0, ...meds.map((x) => x.aruco)) + 1;
    setMeds((x) => [...x, { ...m, id, aruco }]);
    setDoses((d) => [
      ...d,
      ...m.times.map((t) => ({ id: crypto.randomUUID(), medId: id, time: t, status: 'scheduled' })),
    ].sort((a, b) => a.time.localeCompare(b.time)));
    go(NAV[0]);
  };

  const today = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside className="w-full lg:w-[260px] shrink-0 bg-surface-container-lowest border-b lg:border-b-0 lg:border-r border-outline-variant/30 flex flex-col justify-between p-6 gap-8 lg:sticky lg:top-0 lg:h-screen">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary text-on-primary flex items-center justify-center shrink-0">
              <Icon n="medication" size={22} />
            </div>
            <div>
              <span className="font-headline text-headline-sm text-on-surface block leading-none">MedGuard</span>
              <span className="font-label text-label-sm text-on-surface-variant block mt-1">Monitorizare inteligentă</span>
            </div>
          </div>
          <nav aria-label="Navigare principală" className="flex flex-row lg:flex-col gap-1.5 overflow-x-auto">
            {NAV.map((item) => {
              const on = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-md font-label text-label-lg whitespace-nowrap text-left transition-colors duration-state-change ${
                    on ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  }`}
                >
                  <Icon n={item.icon} fill={on} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="hidden lg:flex flex-col gap-3 pt-6 border-t border-outline-variant/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-title text-title-md shrink-0">
              {user.initials}
            </div>
            <div className="min-w-0">
              <p className="font-title text-title-md text-on-surface">{user.name}</p>
              <p className="font-body text-body-sm text-on-surface-variant">Pacient • Cont activ</p>
            </div>
          </div>
          <div className="px-3 py-2.5 rounded-md bg-surface-container-low flex items-center gap-2">
            <Icon n="send" size={18} className="text-primary shrink-0" />
            <span className="font-body text-body-sm text-on-surface-variant">Telegram: {user.caregiver}</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-surface border-b border-outline-variant/25 px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-headline-md lg:text-headline-lg text-on-surface text-balance">
              {view === 'panou' ? `Bună ziua, ${user.first}` : 'Adaugă un medicament'}
            </h1>
            <p className="font-body text-body-md text-on-surface-variant mt-0.5 first-letter:uppercase">
              {view === 'panou' ? `${today} • Programul de tratament de azi` : 'Fotografiază cutia și verifică datele citite'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-container-lowest border border-outline-variant/30">
              <span role="status" aria-label="Raspberry Pi conectat" className="inline-block w-2.5 h-2.5 rounded-full bg-success shrink-0" />
              <span className="font-label text-label-md text-on-surface">Raspberry Pi 4 • Cameră activă</span>
            </div>
            {view === 'panou' && (
              <button type="button" className={btnPrimary} onClick={() => go(NAV[1])}>
                <Icon n="document_scanner" />
                Scanează cutie (OCR)
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-[1320px] w-full mx-auto px-6 lg:px-8 py-8 flex flex-col gap-8">
          {view === 'panou' ? (
            <Dashboard meds={meds} doses={doses} events={events} onConfirm={confirmDose} onSimulate={simulatePickup} />
          ) : (
            <Scan onSave={addMed} onCancel={() => go(NAV[0])} />
          )}
        </main>
      </div>
    </div>
  );
}
