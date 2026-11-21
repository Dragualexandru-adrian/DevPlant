import { Icon, Badge, Card, btnPrimary } from '../ui.jsx';
import { user } from '../data.js';

const pill = (n) => `${n} ${n === 1 ? 'pastilă' : 'pastile'}`;
const LOW = 3;

export default function Dashboard({ meds, doses, events, onConfirm, onSimulate }) {
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
      <section aria-label="Indicatori zilnici" className="grid grid-cols-1 md:grid-cols-3 items-stretch gap-6">
        <Card className="h-full p-6 flex flex-col justify-between gap-3">
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

        <Card className="h-full p-6 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-title text-title-md text-on-surface-variant">Ultima detecție cameră</h2>
            <Icon n="sensors" size={22} className="text-warning" />
          </div>
          <div>
            <p className="font-headline text-headline-md">{last ? (last.status === 'confirmed' ? 'Confirmat' : 'Flacon accesat') : 'Fără detecții'}</p>
            {lastMed && (
              <p className="font-body text-body-sm text-on-surface-variant mt-1">
                <span className="font-mono text-mono-sm">ArUco #{String(lastMed.aruco).padStart(2, '0')}</span>
                {lastDose && <> • Ridicat la <span className="font-mono text-mono-sm tabular-nums">{lastDose.at}</span></>}
              </p>
            )}
          </div>
        </Card>

        <Card className="h-full p-6 flex flex-col justify-between gap-3">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section aria-labelledby="schedule-heading" className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 id="schedule-heading" className="font-headline text-headline-md">Programul de azi</h2>
            <span className="font-body text-body-sm text-on-surface-variant">{doses.length} doze programate</span>
          </div>

          {doses.map((d) => {
            const m = med(d.medId);
            const tag = <span className="font-mono text-mono-sm">ArUco #{String(m.aruco).padStart(2, '0')}</span>;
            if (d.status === 'accessed') {
              return (
                <article key={d.id} className="bg-surface-container-lowest rounded-lg p-6 border border-warning/40 flex flex-col gap-4">
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-mono-md tabular-nums">{d.time}</span>
                        <span className="font-mono text-mono-sm px-2.5 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant">ArUco #{String(m.aruco).padStart(2, '0')}</span>
                      </div>
                      <h3 className="font-headline text-headline-sm">{label(m)}</h3>
                      <p className="font-body text-body-sm text-on-surface-variant">{m.perDose} {m.perDose === 1 ? 'comprimat' : 'comprimate'}{m.note ? ` ${m.note}` : ''}</p>
                    </div>
                    <Badge status="accessed" />
                  </header>
                  <div className="p-4 rounded-md bg-surface-container-low">
                    <p className="font-body text-body-md text-pretty">
                      Camera Raspberry Pi a detectat ridicarea și reașezarea flaconului la {d.at} (LED verde activ). Confirmați înghițirea dozei pentru a actualiza stocul.
                    </p>
                  </div>
                  <footer className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <span className={`font-body text-body-sm font-medium ${m.stock <= LOW ? 'text-warning' : 'text-on-surface-variant'}`}>
                      Stoc curent: {pill(m.stock)} rămase
                    </span>
                    <button type="button" className={btnPrimary} onClick={() => onConfirm(d)}>
                      <Icon n="check" size={18} />
                      Confirmă administrarea
                    </button>
                  </footer>
                </article>
              );
            }
            return (
              <article key={d.id} className="bg-surface-container-lowest rounded-lg p-5 border border-outline-variant/30 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-mono-md text-on-surface-variant tabular-nums w-12">{d.time}</span>
                  <div>
                    <h3 className="font-title text-title-md">{label(m)}</h3>
                    <p className="font-body text-body-sm text-on-surface-variant">
                      {m.perDose} {m.perDose === 1 ? 'comprimat' : 'comprimate'} • {tag}
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
          <Card id="hardware" className="p-6 flex flex-col gap-4 scroll-mt-6" aria-labelledby="hardware-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="hardware-heading" className="font-title text-title-lg">Semnale Hardware &amp; Alerte</h2>
              <span className="font-mono text-mono-sm text-on-surface-variant">Wi-Fi OK</span>
            </div>
            <ul className="flex flex-col gap-3">
              <li className="flex items-center justify-between gap-3 p-3 rounded-md bg-surface-container-low">
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${waiting ? 'bg-success' : 'bg-outline-variant'}`} />
                  <div>
                    <p className="font-title text-title-md">LED Verde</p>
                    <p className="font-body text-body-sm text-on-surface-variant">{lastDose ? `Aprins la ${lastDose.at} (Flacon #${String(med(lastDose.medId).aruco).padStart(2, '0')} accesat)` : 'Nicio interacțiune încă'}</p>
                  </div>
                </div>
                <span className={`font-label text-label-md ${waiting ? 'text-success' : 'text-on-surface-variant'}`}>{waiting ? 'Activ' : 'Standby'}</span>
              </li>
              <li className="flex items-center justify-between gap-3 p-3 rounded-md bg-surface-container-low">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-outline-variant shrink-0" />
                  <div>
                    <p className="font-title text-title-md">LED Roșu &amp; Buzzer</p>
                    <p className="font-body text-body-sm text-on-surface-variant">Prag alertă: 3 min fără interacțiune</p>
                  </div>
                </div>
                <span className="font-label text-label-md text-on-surface-variant">Standby</span>
              </li>
              <li className="flex items-center justify-between gap-3 p-3 rounded-md bg-surface-container-low">
                <div className="flex items-center gap-3">
                  <Icon n="send" size={18} className="text-primary shrink-0" />
                  <div>
                    <p className="font-title text-title-md">Notificare Telegram</p>
                    <p className="font-body text-body-sm text-on-surface-variant">Aparținător: {user.caregiverFull}</p>
                  </div>
                </div>
                <span className="font-label text-label-md text-primary">Conectat</span>
              </li>
            </ul>
            <button type="button" onClick={onSimulate} disabled={!next}
              className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary-container text-on-secondary-container font-label text-label-md hover:bg-surface-container-highest transition-colors duration-state-change disabled:opacity-50 disabled:cursor-not-allowed">
              <Icon n="touch_app" size={16} />
              Simulează ridicarea flaconului
            </button>
          </Card>

          <Card className="p-6 flex flex-col gap-4" aria-labelledby="stock-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="stock-heading" className="font-title text-title-lg">Stoc medicamente</h2>
              <button type="button" className="px-3 py-1.5 rounded-md bg-secondary-container text-on-secondary-container font-label text-label-md hover:bg-surface-container-highest transition-colors duration-state-change">
                Corectează stoc
              </button>
            </div>
            <div className="flex flex-col divide-y divide-outline-variant/25">
              {meds.map((m) => {
                const isLow = m.stock <= LOW;
                const days = Math.floor(m.stock / (m.perDose * m.times.length));
                return (
                  <div key={m.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-body text-body-md font-semibold">{label(m)}</p>
                      <p className={`font-body text-body-sm ${isLow ? 'text-warning' : 'text-on-surface-variant'}`}>
                        {isLow ? 'Reaprovizionare recomandată' : `Suficient pentru ${days} zile`}
                      </p>
                    </div>
                    <span className={`font-mono text-mono-md tabular-nums ${isLow ? 'text-warning' : ''}`}>{pill(m.stock)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <section id="istoric" aria-labelledby="history-heading" className="flex flex-col gap-4 scroll-mt-6">
        <div className="flex items-center justify-between gap-4">
          <h2 id="history-heading" className="font-headline text-headline-md">Jurnal interacțiuni și alerte</h2>
          <span className="font-body text-body-sm text-on-surface-variant">Ultimele 24 de ore</span>
        </div>
        <div className="w-full overflow-x-auto bg-surface-container-lowest rounded-lg border border-outline-variant/30">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low">
                {['Medicament', 'Marker ArUco', 'Oră eveniment', 'Eveniment detectat', 'Status final'].map((h) => (
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
                    <td className="px-5 py-4 font-mono text-mono-sm text-on-surface-variant whitespace-nowrap">ArUco #{String(m.aruco).padStart(2, '0')}</td>
                    <td className="px-5 py-4 font-mono text-mono-md tabular-nums whitespace-nowrap">{e.when}</td>
                    <td className="px-5 py-4 font-body text-body-md text-on-surface-variant">{e.desc}</td>
                    <td className="px-5 py-4 whitespace-nowrap"><Badge status={e.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
