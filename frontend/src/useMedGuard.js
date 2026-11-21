import { useCallback, useEffect, useState } from 'react';
import * as api from './api.js';

const DAY_CODES = { Lu: 'mon', Ma: 'tue', Mi: 'wed', Jo: 'thu', Vi: 'fri', Sâ: 'sat', Du: 'sun' };
const TODAY_CODE = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];

const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const isYesterday = (iso) => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return new Date(iso).toDateString() === d.toDateString();
};
const hm = (iso) => new Date(iso).toTimeString().slice(0, 5);

function toMed(medication, schedules) {
  const times = schedules
    .filter((s) => s.medication_id === medication.id)
    .map((s) => s.time)
    .sort();
  return {
    id: medication.id,
    aruco: medication.id,
    markerId: medication.marker_id,
    name: medication.name,
    strength: medication.concentration || '',
    perDose: medication.pills_per_dose,
    stock: medication.stock,
    times,
  };
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);

function toDoses(schedules, events) {
  const today = schedules.filter(
    (s) => s.days_of_week.split(',').includes(TODAY_CODE) && (!s.end_date || s.end_date >= TODAY_ISO),
  );
  // Fiecare eveniment de azi aparține dozei programate cea mai apropiată ca oră, ca o ridicare
  // de seară să nu schimbe starea dozei de dimineață deja confirmate.
  const minutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const latestBySchedule = new Map();
  for (const e of events) {
    if (!isToday(e.timestamp) || (e.event_type !== 'accessed' && e.event_type !== 'dose_confirmed')) continue;
    const slots = today.filter((s) => s.medication_id === e.medication_id);
    if (!slots.length) continue;
    const at = minutes(hm(e.timestamp));
    const slot = slots.reduce((best, s) => (Math.abs(minutes(s.time) - at) < Math.abs(minutes(best.time) - at) ? s : best));
    // O doză confirmată rămâne confirmată: o ridicare ulterioară a cutiei nu o anulează.
    const prev = latestBySchedule.get(slot.id);
    const rank = (x) => (x.event_type === 'dose_confirmed' ? 1 : 0);
    if (!prev || rank(e) > rank(prev) || (rank(e) === rank(prev) && new Date(e.timestamp) > new Date(prev.timestamp))) {
      latestBySchedule.set(slot.id, e);
    }
  }
  return today
    .map((s) => {
      const latest = latestBySchedule.get(s.id);
      const status = latest?.event_type === 'dose_confirmed' ? 'confirmed' : latest?.event_type === 'accessed' ? 'accessed' : 'scheduled';
      return { id: `sch-${s.id}`, medId: s.medication_id, time: s.time, status, at: status === 'scheduled' ? undefined : hm(latest.timestamp) };
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

const EVENT_DESC = {
  accessed: 'Flacon ridicat și reașezat (LED verde)',
  dose_confirmed: 'Confirmare manuală în aplicație',
  missed_alert: 'Întârziere peste fereastra programată (notificare trimisă)',
};
const EVENT_STATUS = { accessed: 'accessed', dose_confirmed: 'confirmed', missed_alert: 'alert' };

function toEvents(events) {
  return events.map((e) => ({
    id: e.id,
    medId: e.medication_id,
    when: `${isToday(e.timestamp) ? 'Azi' : isYesterday(e.timestamp) ? 'Ieri' : new Date(e.timestamp).toLocaleDateString('ro-RO')}, ${hm(e.timestamp)}`,
    desc: EVENT_DESC[e.event_type] || e.event_type,
    status: EVENT_STATUS[e.event_type] || 'scheduled',
  }));
}

export function useMedGuard() {
  const [meds, setMeds] = useState([]);
  const [doses, setDoses] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const [medications, schedules, rawEvents] = await Promise.all([api.listMeds(), api.listSchedules(), api.listEvents()]);
    setMeds(medications.map((m) => toMed(m, schedules)));
    setDoses(toDoses(schedules, rawEvents));
    setEvents(toEvents(rawEvents));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const confirmDose = useCallback(
    async (dose) => {
      await api.confirmDose(dose.medId);
      await refresh();
    },
    [refresh],
  );

  const correctStock = useCallback(
    async (medId, stock) => {
      await api.updateMed(medId, { stock });
      await refresh();
    },
    [refresh],
  );

  const addMed = useCallback(
    async (m) => {
      // marker_id = codul ArUco de pe flacon (Pi trimite „MED-DEMO-<n>”); fără cod -> null.
      const medication = await api.createMed({
        name: m.name,
        concentration: m.strength || null,
        pills_per_dose: m.perDose,
        stock: m.stock,
        marker_id: m.markerId ?? null,
      });
      const daysOfWeek = Object.values(DAY_CODES).join(',');
      await Promise.all(
        m.times.map((time) => api.createSchedule({ medication_id: medication.id, time, days_of_week: daysOfWeek })),
      );
      await refresh();
    },
    [refresh],
  );

  return { meds, doses, events, loading, error, confirmDose, addMed, correctStock };
}
