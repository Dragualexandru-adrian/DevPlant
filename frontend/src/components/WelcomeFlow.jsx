import { useState } from 'react';
import { Icon, btnPrimary } from '../ui.jsx';
import { useAccessibility } from '../context/AccessibilityContext.jsx';
import AccessibilityBar from './AccessibilityBar.jsx';

const btnSecondary =
  'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-surface-container text-on-surface font-label text-title-md transition-colors duration-state-change hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

function useSteps(t) {
  return [
    { icon: 'medication', title: t('welcomeStep1Title'), body: t('welcomeStep1Body') },
    { icon: 'notifications_active', title: t('welcomeStep2Title'), body: t('welcomeStep2Body') },
    { icon: 'family_restroom', title: t('welcomeStep3Title'), body: t('welcomeStep3Body') },
    { icon: 'text_increase', title: t('welcomeStep4Title'), body: t('welcomeStep4Body') },
  ];
}

export default function WelcomeFlow({ onDone }) {
  const { t, largeText, toggleLargeText, colorblind, toggleColorblind } = useAccessibility();
  const [step, setStep] = useState(0);
  const STEPS = useSteps(t);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  const next = () => (last ? onDone() : setStep((s) => s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="fixed inset-0 z-50 bg-surface flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-8 py-4">
        <AccessibilityBar />
        <button
          type="button"
          onClick={onDone}
          className="font-label text-label-lg text-on-surface-variant hover:text-on-surface px-3 py-2.5 min-h-[44px] rounded-md"
        >
          {t('welcomeSkip')}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 text-center gap-8 max-w-xl mx-auto">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
          <Icon n={current.icon} size={56} fill />
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="font-headline text-headline-md sm:text-headline-lg text-on-surface text-balance">
            {current.title}
          </h1>
          <p className="font-body text-body-lg text-on-surface-variant text-pretty">{current.body}</p>
        </div>

        {last && (
          <button
            type="button"
            onClick={() => {
              if (!largeText) toggleLargeText();
              if (!colorblind) toggleColorblind();
            }}
            aria-pressed={largeText && colorblind}
            className={`${btnSecondary} w-full sm:w-auto`}
          >
            <Icon n={largeText && colorblind ? 'check_circle' : 'text_increase'} size={22} />
            {largeText && colorblind ? t('welcomeStep4Enabled') : t('welcomeStep4Enable')}
          </button>
        )}

        <div role="group" aria-label={t('welcomeDots')} className="flex items-center gap-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-state-change ${
                i === step ? 'bg-primary' : 'bg-outline-variant'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="px-6 sm:px-10 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 flex items-center justify-between gap-4 max-w-xl w-full mx-auto">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className={`${btnSecondary} disabled:opacity-0 disabled:pointer-events-none`}
        >
          <Icon n="arrow_back" size={20} />
          {t('welcomeBack')}
        </button>
        <button type="button" onClick={next} className={btnPrimary}>
          {last ? t('welcomeStart') : t('welcomeNext')}
          <Icon n={last ? 'check' : 'arrow_forward'} size={20} />
        </button>
      </div>
    </div>
  );
}
