import { Icon, Badge, Card, btnPrimary } from '../ui.jsx';

const pill = (n) => `${n} ${n === 1 ? 'pastilă' : 'pastile'}`;
const LOW = 3;

export default function Dashboard({ meds, doses, events, onConfirm, onCorrectStock }) {
  const med = (id) => meds.find((m) => m.id === id);
  const label = (m) => `${m.name} ${m.strength}`;
  const done = doses.filter((d) => d.status === 'confirmed').length;
  const waiting = doses.filter((d) => d.status === 'accessed').length;
  const next = doses.find((d) => d.status === 'scheduled');
  const low = meds.filter((m) => m.stock <= LOW);
  const last = events[0];
  const lastMed = last && med(last.medId);
  const lastDose = [...doses].reverse().find((d) => d.at && d.status !== 'scheduled');

  return (
    <>
      <section aria-label="Indicatori zilnici" className="grid grid-cols-1 md:grid-cols-3 items-stretch gap-3 sm:gap-6">
        <Card className="h-full p-4 sm:p-6 flex flex-col justify-between gap-2 sm:gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-title text-title-md text-on-surface-variant">Aderență azi</h2>
            <Icon n="verified" size={22} className="text-primary" />
          </div>
          <div>
            <p className="font-display text-display-lg-mobile lg:text-display-lg tabular-nums">{done} / {doses.length} doze</p>
            <p className="font-body text-body-sm text-on-surface-variant mt-1">
              {waiting ? `${waiting} ${waiting === 1 ? 'doză așteaptă' : 'doze așteaptă'} confirmarea dvs.` : next ? `Următoarea doză programată la ${next.time}` : 'Toate dozele sunt confirmate'}
            </p>
          </div>
        </Card>

        <Card className="h-full p-4 sm:p-6 flex flex-col justify-between gap-2 sm:gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-title text-title-md text-on-surface-variant">Ultima detecție cameră</h2>
            <Icon n="sensors" size={22} className="text-warning" />
          </div>
          <div>
            <p className="font-headline text-headline-md">{last ? (last.status === 'confirmed' ? 'Confirmat' : 'Flacon accesat') : 'Fără detecții'}</p>
            {lastMed && lastDose && (
              <p className="font-body text-body-sm text-on-surface-variant mt-1">
                {label(lastMed)} • Ridicat la <span className="tabular-nums">{lastDose.at}</span>
              </p>
            )}
          </div>
        </Card>

        <Card className="h-full p-4 sm:p-6 flex flex-col justify-between gap-2 sm:gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-title text-title-md text-on-surface-variant">Atenționare stoc</h2>
            <Icon n="inventory_2" size={22} className="text-warning" />
          </div>
          <div>
            <p className="font-display text-display-lg-mobile lg:text-display-lg tabular-nums">{low.length} {low.length === 1 ? 'cutie' : 'cutii'}</p>
            <p className="font-body text-body-sm text-on-surface-variant mt-1">
              {low[0] ? `${label(low[0])}: ${pill(low[0].stock)} rămase` : 'Stocul este suficient'}
            </p>
          </div>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        <section aria-labelledby="schedule-heading" className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="schedule-heading" className="font-headline text-headline-md">Programul de azi</h2>
            <span className="font-body text-body-sm text-on-surface-variant">{doses.length} doze programate</span>
          </div>

          {doses.length === 0 && (
            <p className="font-body text-body-md text-on-surface-variant bg-surface-container-lowest rounded-lg p-6 border border-outline-variant/30">
              Nicio doză programată pentru azi.
            </p>
          )}

          {doses.map((d) => {
            const m = med(d.medId);
            if (d.status === 'accessed') {
              return (
                <article key={d.id} className="bg-surface-container-lowest rounded-lg p-4 sm:p-6 border border-warning/40 flex flex-col gap-4">
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-mono-md tabular-nums">{d.time}</span>
                      <h3 className="font-headline text-headline-sm">{label(m)}</h3>
                      <p className="font-body text-body-sm text-on-surface-variant">{m.perDose} {m.perDose === 1 ? 'comprimat' : 'comprimate'}{m.note ? ` ${m.note}` : ''}</p>
                    </div>
                    <Badge status="accessed" />
                  </header>
                  <div className="p-4 rounded-md bg-surface-container-low">
                    <p className="font-body text-body-md text-pretty">
                      Camera de monitorizare a detectat ridicarea și reașezarea flaconului la {d.at} (LED verde activ). Confirmați înghițirea dozei pentru a actualiza stocul.
                    </p>
                  </div>
                  <footer className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <span className={`font-body text-body-sm font-medium ${m.stock <= LOW ? 'text-warning' : 'text-on-surface-variant'}`}>
                      Stoc curent: {pill(m.stock)} rămase
                    </span>
                    <button type="button" className={`${btnPrimary} w-full sm:w-auto min-h-[48px]`} onClick={() => onConfirm(d)}>
                      <Icon n="check" size={18} />
                      Confirmă administrarea
                    </button>
                  </footer>
                </article>
              );
            }
            return (
              <article key={d.id} className="bg-surface-container-lowest rounded-lg p-4 sm:p-5 border border-outline-variant/30 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-mono-md text-on-surface-variant tabular-nums w-12">{d.time}</span>
                  <div>
                    <h3 className="font-headline text-headline-sm">{label(m)}</h3>
                    <p className="font-body text-body-sm text-on-surface-variant">
                      {m.perDose} {m.perDose === 1 ? 'comprimat' : 'comprimate'}
                      {d.status === 'confirmed' ? ` • Confirmat la ${d.at}` : ''}
                    </p>
                  </div>
                </div>
                <Badge status={d.status} />
              </article>
            );
          })}
        </section>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card className="p-4 sm:p-6 flex flex-col gap-4" aria-labelledby="stock-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="stock-heading" className="font-title text-title-lg">Stoc medicamente</h2>
            </div>
            <div className="flex flex-col divide-y divide-outline-variant/25">
              {meds.map((m) => {
                const isLow = m.stock <= LOW;
                const days = Math.floor(m.stock / (m.perDose * m.times.length));
                const correct = () => {
                  const next = window.prompt(`Stoc nou pentru ${label(m)}:`, m.stock);
                  if (next === null) return;
                  const value = Number(next);
                  if (!Number.isFinite(value) || value < 0) return;
                  onCorrectStock(m.id, Math.round(value));
                };
                return (
                  <div key={m.id} className="py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div>
                      <p className="font-body text-body-md font-semibold">{label(m)}</p>
                      <p className={`font-body text-body-sm ${isLow ? 'text-warning' : 'text-on-surface-variant'}`}>
                        {isLow ? 'Reaprovizionare recomandată' : `Suficient pentru ${days} zile`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-mono-md tabular-nums ${isLow ? 'text-warning' : ''}`}>{pill(m.stock)}</span>
                      <button
                        type="button"
                        onClick={correct}
                        className="px-3 py-2 sm:px-2.5 sm:py-1 rounded-md bg-secondary-container text-on-secondary-container font-label text-label-sm hover:bg-surface-container-highest transition-colors duration-state-change"
                      >
                        Corectează stoc
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
