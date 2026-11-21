import { useState } from 'react';
import { Icon, btnPrimary } from '../ui.jsx';
import * as api from '../api.js';

const input = 'w-full px-3.5 py-2.5 rounded-md bg-surface-container-lowest border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary font-body text-body-md';

export default function Auth({ onSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        await api.register(name.trim(), email.trim(), password);
      }
      await api.login(email.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const useDemo = async () => {
    setError('');
    setBusy(true);
    try {
      await api.ensureDemoSession();
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-6 py-12">
      <div className="w-full max-w-[420px] flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-md bg-primary text-on-primary flex items-center justify-center">
            <Icon n="medication" size={26} />
          </div>
          <div>
            <h1 className="font-headline text-headline-lg text-on-surface">MedGuard</h1>
            <p className="font-body text-body-md text-on-surface-variant mt-1">Monitorizare inteligentă a tratamentului</p>
          </div>
        </div>

        <section className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 p-6 flex flex-col gap-5">
          <div role="tablist" aria-label="Autentificare sau înregistrare" className="grid grid-cols-2 gap-1.5 p-1 rounded-md bg-surface-container-low">
            {[
              ['login', 'Conectare'],
              ['signup', 'Cont nou'],
            ].map(([id, lbl]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => {
                  setMode(id);
                  setError('');
                }}
                className={`py-2 rounded-md font-label text-label-lg transition-colors duration-state-change ${
                  mode === id ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <label className="flex flex-col gap-1.5">
                <span className="font-label text-label-lg text-on-surface">Nume</span>
                <input
                  className={input}
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="font-label text-label-lg text-on-surface">Email</span>
              <input
                className={input}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-label text-label-lg text-on-surface">Parolă</span>
              <input
                className={input}
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {error && (
              <p role="alert" className="font-body text-body-sm text-error">
                {error}
              </p>
            )}

            <button type="submit" className={btnPrimary} disabled={busy}>
              <Icon n={mode === 'signup' ? 'person_add' : 'login'} size={18} />
              {busy ? 'Se procesează…' : mode === 'signup' ? 'Creează cont' : 'Conectează-te'}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-outline-variant/30" />
            <span className="font-label text-label-sm text-on-surface-variant">sau</span>
            <span className="h-px flex-1 bg-outline-variant/30" />
          </div>

          <button
            type="button"
            onClick={useDemo}
            disabled={busy}
            className="px-5 py-2.5 rounded-md bg-secondary-container text-on-secondary-container font-label text-label-lg hover:bg-surface-container-highest transition-colors duration-state-change disabled:opacity-60"
          >
            Continuă cu contul demo
          </button>
        </section>
      </div>
    </div>
  );
}
