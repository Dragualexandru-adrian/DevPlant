export const Icon = ({ n, size = 20, fill = false, className = '' }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{ fontSize: size, ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}) }}
    aria-hidden="true"
  >
    {n}
  </span>
);

const BADGES = {
  confirmed: ['bg-success-container text-on-success-container', 'check_circle', 'Administrare confirmată'],
  accessed: ['bg-warning-container text-on-warning-container', 'sensors', 'Flacon accesat'],
  scheduled: ['bg-surface-container text-on-surface-variant', 'schedule', 'Programat'],
  alert: ['bg-error text-on-error', 'notifications_active', 'Notificare trimisă'],
};

export const Badge = ({ status }) => {
  const [cls, icon, label] = BADGES[status];
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-label text-label-md whitespace-nowrap ${cls}`}>
      <Icon n={icon} size={16} />
      {label}
    </span>
  );
};

export const Card = ({ className = '', children, ...p }) => (
  <section className={`bg-surface-container-lowest rounded-lg border border-outline-variant/30 ${className}`} {...p}>
    {children}
  </section>
);

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-primary text-on-primary font-label text-title-md transition-colors duration-state-change hover:bg-on-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:bg-surface-container-high disabled:text-outline disabled:cursor-not-allowed';
