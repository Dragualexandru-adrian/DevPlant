import { Icon } from '../ui.jsx';
import { useAccessibility } from '../context/AccessibilityContext.jsx';

const toggleBtn = (on) =>
  `inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-md font-label text-label-md transition-colors duration-state-change ${
    on
      ? 'bg-primary-container text-on-primary-container'
      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
  }`;

export default function AccessibilityBar({ className = '' }) {
  const { lang, largeText, colorblind, setLang, toggleLargeText, toggleColorblind, t } = useAccessibility();

  return (
    <div
      role="group"
      aria-label={t('a11ySettingsLabel')}
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      <button
        type="button"
        onClick={() => setLang(lang === 'ro' ? 'en' : 'ro')}
        className={toggleBtn(false)}
        aria-label={t('a11yLang')}
        title={t('a11yLang')}
      >
        <Icon n="translate" size={18} />
        {lang === 'ro' ? 'RO' : 'EN'}
      </button>

      <button
        type="button"
        onClick={toggleLargeText}
        aria-pressed={largeText}
        className={toggleBtn(largeText)}
        title={largeText ? t('a11yLargeTextOn') : t('a11yLargeTextOff')}
      >
        <Icon n="text_increase" size={18} />
        {t('a11yLargeText')}
      </button>

      <button
        type="button"
        onClick={toggleColorblind}
        aria-pressed={colorblind}
        className={toggleBtn(colorblind)}
        title={colorblind ? t('a11yColorblindOn') : t('a11yColorblindOff')}
      >
        <Icon n="palette" size={18} />
        {t('a11yColorblind')}
      </button>
    </div>
  );
}
