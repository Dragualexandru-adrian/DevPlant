import { useEffect, useState } from 'react';
import Dashboard from './views/Dashboard.jsx';
import Scan from './views/Scan.jsx';
import History from './views/History.jsx';
import Auth from './views/Auth.jsx';
import { Icon, btnPrimary } from './ui.jsx';
import { useMedGuard } from './useMedGuard.js';
import * as api from './api.js';

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

const NAV = [
  { id: 'panou', label: 'Panou principal', icon: 'dashboard', view: 'panou' },
  { id: 'scanare', label: 'Adaugă medicament', icon: 'document_scanner', view: 'scanare' },
  { id: 'istoric', label: 'Istoric', icon: 'history', view: 'istoric' },
];

export default function App() {
  const [authed, setAuthed] = useState(api.hasSession());

  if (!authed) return <Auth onSuccess={() => setAuthed(true)} />;
  return <AuthedApp onLogout={() => { api.logout(); setAuthed(false); }} />;
}

function AuthedApp({ onLogout }) {
  const [view, setView] = useState('panou');
  const [active, setActive] = useState('panou');
  const [user, setUser] = useState(null);
  const { meds, doses, events, loading, error, confirmDose, addMed } = useMedGuard();

  useEffect(() => {
    api.me().then(setUser).catch(() => {});
  }, []);

  const userFirst = user ? user.name.split(' ')[0] : '';
  const userInitials = user ? initials(user.name) : '';

  const go = (item) => {
    setView(item.view);
    setActive(item.id);
    window.scrollTo({ top: 0 });
  };

  const handleAddMed = async (m) => {
    await addMed(m);
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
          <nav aria-label="Navigare principală" className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:flex lg:flex-col lg:gap-1.5">
            {NAV.map((item) => {
              const on = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3.5 py-3.5 lg:py-2.5 rounded-md font-label text-title-md lg:text-label-lg text-left transition-colors duration-state-change min-w-0 ${
                    on ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  }`}
                >
                  <Icon n={item.icon} size={24} fill={on} className="shrink-0" />
                  <span className="min-w-0">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="hidden lg:flex flex-col gap-3 pt-6 border-t border-outline-variant/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-title text-title-md shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="font-title text-title-md text-on-surface">{user?.name}</p>
              <p className="font-body text-body-sm text-on-surface-variant">
                {user?.role === 'caregiver' ? 'Îngrijitor' : 'Pacient'} • Cont activ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2.5 rounded-md font-label text-label-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors duration-state-change"
          >
            <Icon n="logout" size={18} />
            Deconectare
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-surface border-b border-outline-variant/25 px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-headline-md lg:text-headline-lg text-on-surface text-balance">
              {view === 'panou' ? `Bună ziua, ${userFirst}` : view === 'istoric' ? 'Istoric' : 'Adaugă un medicament'}
            </h1>
            <p className="font-body text-body-md text-on-surface-variant mt-0.5 first-letter:uppercase">
              {view === 'panou'
                ? `${today} • Programul de tratament de azi`
                : view === 'istoric'
                  ? 'Interacțiuni și alerte înregistrate'
                  : 'Fotografiază cutia și verifică datele citite'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {view === 'panou' && (
              <button type="button" className={`${btnPrimary} w-full sm:w-auto`} onClick={() => go(NAV[1])}>
                <Icon n="document_scanner" size={22} />
                Scanează cutie
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-[1320px] w-full mx-auto px-6 lg:px-8 py-8 flex flex-col gap-8">
          {error ? (
            <p className="font-body text-body-md text-warning">Nu s-a putut contacta serverul MedGuard: {error}</p>
          ) : loading ? (
            <p className="font-body text-body-md text-on-surface-variant">Se încarcă datele…</p>
          ) : view === 'panou' ? (
            <Dashboard meds={meds} doses={doses} events={events} onConfirm={confirmDose} />
          ) : view === 'istoric' ? (
            <History meds={meds} events={events} />
          ) : (
            <Scan onSave={handleAddMed} onCancel={() => go(NAV[0])} />
          )}
        </main>
      </div>
    </div>
  );
}
