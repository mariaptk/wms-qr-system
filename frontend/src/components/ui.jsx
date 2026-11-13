import { STATUS_LABELS } from '../lib/shipments.js';

export function StatusBadge({ status }) {
  return <span className={`status status-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

export function ErrorMessage({ error }) {
  if (!error) return null;
  const details = Array.isArray(error.details) ? error.details : [];
  return (
    <div className="alert alert-error" role="alert">
      <strong>{error.message}</strong>
      {details.length > 0 && (
        <ul>
          {details.map((item, index) => (
            <li key={`${item.field}-${index}`}>{item.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Loading({ text = 'Загрузка…' }) {
  return <div className="loading"><span className="spinner" aria-hidden="true" />{text}</div>;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function fieldError(error, field) {
  const item = Array.isArray(error?.details) ? error.details.find((detail) => detail.field === field) : null;
  return item ? <span className="field-error">{item.message}</span> : null;
}
