// Client FastAPI. Vezi backend/app/routers/*.py pentru formele exacte ale cererilor.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'medguard_token';

// Un singur cont demo pentru hackathon (CLAUDE.md: MVP = un cont demo).
export const DEMO_EMAIL = 'demo@medguard.app';
export const DEMO_PASSWORD = 'medguard-demo';

let token = localStorage.getItem(TOKEN_KEY) || null;

function setToken(value) {
  token = value;
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, form, auth = true } = {}) {
  const headers = {};
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = new URLSearchParams(form);
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `${method} ${path} a eșuat (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function register(name, email, password) {
  return request('/auth/register', { method: 'POST', body: { name, email, password }, auth: false });
}

export async function login(email, password) {
  const data = await request('/auth/login', { method: 'POST', form: { username: email, password }, auth: false });
  setToken(data.access_token);
  return data;
}

export function logout() {
  setToken(null);
}

export function hasSession() {
  return Boolean(token);
}

export const me = () => request('/auth/me');

export async function ensureDemoSession() {
  if (token) return;
  try {
    await login(DEMO_EMAIL, DEMO_PASSWORD);
  } catch {
    await register('Cont demo', DEMO_EMAIL, DEMO_PASSWORD);
    await login(DEMO_EMAIL, DEMO_PASSWORD);
  }
}

export const listMeds = () => request('/meds');
export const createMed = (med) => request('/meds', { method: 'POST', body: med });
export const updateMed = (medId, patch) => request(`/meds/${medId}`, { method: 'PUT', body: patch });

export const listSchedules = (medicationId) =>
  request(medicationId ? `/schedules?medication_id=${medicationId}` : '/schedules');
export const createSchedule = (schedule) => request('/schedules', { method: 'POST', body: schedule });

export const listEvents = (medicationId) =>
  request(medicationId ? `/events?medication_id=${medicationId}` : '/events');
export const confirmDose = (medicationId) =>
  request('/events/confirm', { method: 'POST', body: { medication_id: medicationId } });

// Apelat de Raspberry Pi; expus și în UI ca buton de simulare fără hardware.
export const reportVialAccess = (markerId) =>
  request('/events', { method: 'POST', body: { marker_id: markerId, event_type: 'accessed' }, auth: false });
