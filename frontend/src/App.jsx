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
  { id: 'panou', label: 'Panou principal', short: 'Panou', icon: 'dashboard', view: 'panou' },
  { id: 'scanare', label: 'Adaugă medicament', short: 'Adaugă', icon: 'document_scanner', view: 'scanare' },
  { id: 'istoric', label: 'Istoric', short: 'Istoric', icon: 'history', view: 'istoric' },
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
  const { meds, doses, events, loading, error, confirmDose, addMed, correctStock } = useMedGuard();

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
      {/* Telefon: bară de sus compactă (logo + cont + deconectare) */}
      <div className="lg:hidden sticky top-0 z-20 bg-surface-container-lowest/95 backdrop-blur border-b border-outline-variant/30 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-md bg-primary text-on-primary flex items-center justify-center shrink-0">
            <Icon n="medication" size={20} />
          </div>
          <span className="font-headline text-title-lg text-on-surface leading-none">MedGuard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-title text-label-lg"
            title={user?.name}
          >
            {userInitials}
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Deconectare"
            className="w-11 h-11 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low active:bg-surface-container transition-colors duration-state-change"
          >
            <Icon n="logout" size={22} />
          </button>
        </div>
      </div>

      <aside className="hidden lg:flex w-[260px] shrink-0 bg-surface-container-lowest border-r border-outline-variant/30 flex-col justify-between p-6 gap-8 sticky top-0 h-screen">
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
          <nav aria-label="Navigare principală" className="flex flex-col gap-1.5">
            {NAV.map((item) => {
              const on = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-md font-label text-label-lg text-left transition-colors duration-state-change min-w-0 ${
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
        <div className="flex flex-col gap-3 pt-6 border-t border-outline-variant/30">
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
        <header className="bg-surface border-b border-outline-variant/25 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-headline-sm sm:text-headline-md lg:text-headline-lg text-on-surface text-balance">
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
          <div className="hidden sm:flex flex-wrap items-center gap-3">
            {view === 'panou' && (
              <button type="button" className={btnPrimary} onClick={() => go(NAV[1])}>
                <Icon n="document_scanner" size={22} />
                Scanează cutie
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8 flex flex-col gap-6 sm:gap-8">
          {error ? (
            <p className="font-body text-body-md text-warning">Nu s-a putut contacta serverul MedGuard: {error}</p>
          ) : loading ? (
            <p className="font-body text-body-md text-on-surface-variant">Se încarcă datele…</p>
          ) : view === 'panou' ? (
            <Dashboard meds={meds} doses={doses} events={events} onConfirm={confirmDose} onCorrectStock={correctStock} />
          ) : view === 'istoric' ? (
            <History meds={meds} events={events} />
          ) : (
            <Scan onSave={handleAddMed} onCancel={() => go(NAV[0])} />
          )}
        </main>
      </div>

      {/* Telefon: navigare jos, la îndemâna degetului mare */}
      <nav
        aria-label="Navigare principală"
        className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-surface-container-lowest/95 backdrop-blur border-t border-outline-variant/30 grid grid-cols-3 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {NAV.map((item) => {
          const on = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item)}
              aria-current={on ? 'page' : undefined}
              className="flex flex-col items-center gap-1 py-1.5 min-h-[56px] font-label text-label-md text-on-surface-variant"
            >
              <span
                className={`w-16 h-8 rounded-full flex items-center justify-center transition-colors duration-state-change ${
                  on ? 'bg-primary-container text-on-primary-container' : ''
                }`}
              >
                <Icon n={item.icon} size={24} fill={on} />
              </span>
              <span className={on ? 'text-on-surface font-semibold' : ''}>{item.short}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
