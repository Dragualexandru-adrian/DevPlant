import { Icon } from '../ui.jsx';
import { useAccessibility } from '../context/AccessibilityContext.jsx';

export default function SafetyBanner({ className = '' }) {
  const { t } = useAccessibility();
  return (
    <div
      role="note"
      className={`flex items-start gap-3 p-4 rounded-md bg-warning-container text-on-warning-container border border-warning/40 ${className}`}
    >
      <Icon n="emergency" size={22} className="shrink-0 mt-0.5" />
      <p className="font-body text-body-md text-pretty">{t('safetyBanner')}</p>
    </div>
  );
}
