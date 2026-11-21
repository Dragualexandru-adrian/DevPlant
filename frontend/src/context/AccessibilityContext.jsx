import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'medguard.a11y';

const DICT = {
  ro: {
    appName: 'MedGuard',
    appTagline: 'Monitorizare inteligentă',
    navDashboard: 'Panou principal',
    navDashboardShort: 'Panou',
    navAdd: 'Adaugă medicament',
    navAddShort: 'Adaugă',
    navHistory: 'Istoric',
    navHistoryShort: 'Istoric',
    logout: 'Deconectare',
    greeting: (name) => `Bună ziua, ${name}`,
    historyTitle: 'Istoric',
    addTitle: 'Adaugă un medicament',
    todaySubtitle: 'Programul de tratament de azi',
    historySubtitle: 'Interacțiuni și alerte înregistrate',
    addSubtitle: 'Fotografiază cutia și verifică datele citite',
    scanBox: 'Scanează cutie',
    patient: 'Pacient',
    caregiver: 'Îngrijitor',
    activeAccount: 'Cont activ',
    loadingData: 'Se încarcă datele…',
    serverError: 'Nu s-a putut contacta serverul MedGuard',
    safetyBanner:
      'Acestea nu sunt sfaturi medicale. Confirmați întotdeauna cu medicul sau farmacistul dvs. În caz de urgență, apelați 112.',
    a11yLang: 'Limbă',
    a11yLargeText: 'Text mare',
    a11yLargeTextOn: 'Text mare: activ',
    a11yLargeTextOff: 'Text mare',
    a11yColorblind: 'Mod daltonism',
    a11yColorblindOn: 'Mod daltonism: activ',
    a11yColorblindOff: 'Mod daltonism',
    a11ySettingsLabel: 'Setări de accesibilitate',
    badgeConfirmed: 'Administrare confirmată',
    badgeAccessed: 'Flacon accesat',
    badgeScheduled: 'Programat',
    badgeAlert: 'Notificare trimisă',
  },
  en: {
    appName: 'MedGuard',
    appTagline: 'Smart monitoring',
    navDashboard: 'Dashboard',
    navDashboardShort: 'Dashboard',
    navAdd: 'Add medication',
    navAddShort: 'Add',
    navHistory: 'History',
    navHistoryShort: 'History',
    logout: 'Log out',
    greeting: (name) => `Hello, ${name}`,
    historyTitle: 'History',
    addTitle: 'Add a medication',
    todaySubtitle: "Today's treatment schedule",
    historySubtitle: 'Logged interactions and alerts',
    addSubtitle: 'Photograph the box and check the scanned data',
    scanBox: 'Scan box',
    patient: 'Patient',
    caregiver: 'Caregiver',
    activeAccount: 'Active account',
    loadingData: 'Loading data…',
    serverError: 'Could not reach the MedGuard server',
    safetyBanner:
      'This is not medical advice — always confirm with your doctor or pharmacist. In an emergency, call 112.',
    a11yLang: 'Language',
    a11yLargeText: 'Large text',
    a11yLargeTextOn: 'Large text: on',
    a11yLargeTextOff: 'Large text',
    a11yColorblind: 'Colorblind mode',
    a11yColorblindOn: 'Colorblind mode: on',
    a11yColorblindOff: 'Colorblind mode',
    a11ySettingsLabel: 'Accessibility settings',
    badgeConfirmed: 'Dose confirmed',
    badgeAccessed: 'Vial accessed',
    badgeScheduled: 'Scheduled',
    badgeAlert: 'Alert sent',
  },
};

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        lang: parsed.lang === 'en' ? 'en' : 'ro',
        largeText: Boolean(parsed.largeText),
        colorblind: Boolean(parsed.colorblind),
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return { lang: 'ro', largeText: false, colorblind: false };
}

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }) {
  const [state, setState] = useState(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable — continue without persistence
    }
    document.documentElement.classList.toggle('a11y-large', state.largeText);
    document.documentElement.classList.toggle('a11y-colorblind', state.colorblind);
    document.documentElement.lang = state.lang;
  }, [state]);

  const value = useMemo(() => {
    const dict = DICT[state.lang] || DICT.ro;
    const t = (key, ...args) => {
      const entry = dict[key] ?? DICT.ro[key] ?? key;
      return typeof entry === 'function' ? entry(...args) : entry;
    };
    return {
      ...state,
      t,
      setLang: (lang) => setState((s) => ({ ...s, lang: lang === 'en' ? 'en' : 'ro' })),
      toggleLargeText: () => setState((s) => ({ ...s, largeText: !s.largeText })),
      toggleColorblind: () => setState((s) => ({ ...s, colorblind: !s.colorblind })),
    };
  }, [state]);

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
}
