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
  const latestByMed = new Map();
  for (const e of events) {
    if (!isToday(e.timestamp)) continue;
    const prev = latestByMed.get(e.medication_id);
    if (!prev || new Date(e.timestamp) > new Date(prev.timestamp)) latestByMed.set(e.medication_id, e);
  }
  return today
    .map((s) => {
      const latest = latestByMed.get(s.medication_id);
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
      const markerId = `MED-${Date.now()}`;
      const medication = await api.createMed({
        name: m.name,
        concentration: m.strength,
        pills_per_dose: m.perDose,
        stock: m.stock,
        marker_id: markerId,
      });
      const daysOfWeek = m.days.map((d) => DAY_CODES[d]).join(',');
      await Promise.all(
        m.times.map((time) =>
          api.createSchedule({ medication_id: medication.id, time, days_of_week: daysOfWeek, end_date: m.endDate || null }),
        ),
      );
      await refresh();
    },
    [refresh],
  );

  return { meds, doses, events, loading, error, confirmDose, addMed, correctStock };
}
