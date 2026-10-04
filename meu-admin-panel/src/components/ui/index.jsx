import React, { useEffect, useRef, useCallback, createContext, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Search, Navigation, Pause, WifiOff, CircleSlash, Wrench,
  CheckCircle2, AlertTriangle, AlertOctagon, Info, ChevronUp, ChevronDown,
} from 'lucide-react';
import './ui.css';

/* ---------- Button ---------- */
export function Button({ variant = 'secondary', size = 'md', loading, block, children, ...rest }) {
  return (
    <button
      className={`btn btn--${variant}${size !== 'md' ? ` btn--${size}` : ''}${block ? ' btn--block' : ''}`}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function IconButton({ label, children, ...rest }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

/* ---------- Fields ---------- */
export function Field({ label, required, hint, error, htmlFor, children }) {
  return (
    <div className="field">
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          {label}{required && <span className="field__req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && (
        <span className="field__error" role="alert">
          <AlertTriangle size={13} aria-hidden="true" />{error}
        </span>
      )}
    </div>
  );
}

export const Input = React.forwardRef(function Input({ invalid, ...rest }, ref) {
  return <input ref={ref} className={`input${invalid ? ' input--invalid' : ''}`} aria-invalid={invalid || undefined} {...rest} />;
});

export function Select({ invalid, children, ...rest }) {
  return <select className={`input${invalid ? ' input--invalid' : ''}`} aria-invalid={invalid || undefined} {...rest}>{children}</select>;
}

export function SearchInput({ value, onChange, placeholder, label }) {
  const { t } = useTranslation();
  return (
    <div className="search">
      <Search size={16} className="search__icon" aria-hidden="true" />
      <input
        type="text" className="input" value={value} placeholder={placeholder}
        aria-label={label || placeholder || t('search')}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <span className="search__clear">
          <IconButton label={t('close')} onClick={() => onChange('')}><X size={15} /></IconButton>
        </span>
      )}
    </div>
  );
}

/* ---------- Badges ---------- */
export function Badge({ tone = 'neutral', icon: Icon, children }) {
  return (
    <span className={`badge badge--${tone}`}>
      {Icon && <Icon size={12} aria-hidden="true" />}{children}
    </span>
  );
}

const STATUS_META = {
  on_route:       { tone: 'ok',       Icon: Navigation },
  idle:           { tone: 'info',     Icon: Pause },
  no_signal:      { tone: 'warn',     Icon: WifiOff },
  offline:        { tone: 'neutral',  Icon: CircleSlash },
  out_of_service: { tone: 'neutral',  Icon: Wrench },
  open_status:    { tone: 'critical', Icon: AlertOctagon },
  acknowledged:   { tone: 'warn',     Icon: AlertTriangle },
  resolved:       { tone: 'ok',       Icon: CheckCircle2 },
};

// Icon + colour + text on every status. Never colour alone.
export function StatusBadge({ status }) {
  const { t } = useTranslation();
  const meta = STATUS_META[status] || STATUS_META.offline;
  return <Badge tone={meta.tone} icon={meta.Icon}>{t(status)}</Badge>;
}

export function ProgressBar({ value, max, level = 'ok', label }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0}
         aria-valuemax={max || 0} aria-label={label}>
      <div className={`progress__fill progress__fill--${level}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- Card ---------- */
export function Card({ title, actions, children, style }) {
  return (
    <section className="card" style={style}>
      {(title || actions) && (
        <header className="card__head">
          <h2 className="card__title">{title}</h2>
          {actions}
        </header>
      )}
      <div className="card__body">{children}</div>
    </section>
  );
}

/* ---------- Focus trap shared by Modal + Drawer ---------- */
function useDismissable(onClose, ref) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const node = ref.current;
    const focusables = () => node
      ? [...node.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      : [];
    
    // Only focus first element once when modal mounts
    focusables()[0]?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current?.(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (prevFocus instanceof HTMLElement) prevFocus.focus();
    };
  }, [ref]);
}

/* ---------- Modal ---------- */
export function Modal({ title, onClose, footer, size, children }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  useDismissable(onClose, ref);
  const titleId = `modal-${title?.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`modal${size === 'sm' ? ' modal--sm' : ''}`}
           role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal__head">
          <h2 className="modal__title" id={titleId}>{title}</h2>
          <IconButton label={t('close')} onClick={onClose}><X size={18} /></IconButton>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, body, confirmLabel, danger, requireWord, onConfirm, onClose, loading }) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const blocked = requireWord && typed.trim().toUpperCase() !== requireWord.toUpperCase();

  return (
    <Modal title={title} onClose={onClose} size="sm" footer={
      <>
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}
                disabled={blocked} loading={loading}>{confirmLabel}</Button>
      </>
    }>
      <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>{body}</p>
      {requireWord && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Field label={t('type_to_confirm', { word: requireWord })} htmlFor="confirm-word">
            <Input id="confirm-word" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
        </div>
      )}
    </Modal>
  );
}

/* ---------- Drawer ---------- */
export function Drawer({ title, subtitle, onClose, footer, children }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  useDismissable(onClose, ref);

  return (
    <div className="drawer-overlay" role="presentation">
      <div className="drawer-scrim" onMouseDown={onClose} />
      <aside ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header className="drawer__head">
          <div>
            <h2 className="modal__title">{title}</h2>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{subtitle}</p>}
          </div>
          <IconButton label={t('close')} onClick={onClose}><X size={18} /></IconButton>
        </header>
        <div className="drawer__body">{children}</div>
        {footer && <footer className="drawer__foot">{footer}</footer>}
      </aside>
    </div>
  );
}

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, tone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, msg, tone }]);
    if (tone !== 'error') setTimeout(() => setItems((p) => p.filter((i) => i.id !== id)), 4000);
  }, []);
  const dismiss = (id) => setItems((p) => p.filter((i) => i.id !== id));
  const ICONS = { success: CheckCircle2, error: AlertOctagon, info: Info };

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map(({ id, msg, tone }) => {
          const Icon = ICONS[tone] || Info;
          return (
            <div key={id} className={`toast toast--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
              <Icon size={16} aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />
              <span className="toast__msg">{msg}</span>
              <IconButton label="close" onClick={() => dismiss(id)}><X size={14} /></IconButton>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- States ---------- */
export function EmptyState({ icon: Icon = Info, tone, title, body, action }) {
  return (
    <div className="state">
      <div className="state__icon" style={tone ? { background: `var(--color-status-${tone}-bg)`, color: `var(--color-status-${tone})` } : undefined}>
        <Icon size={22} aria-hidden="true" />
      </div>
      <h3 className="state__title">{title}</h3>
      {body && <p className="state__body">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title, body, onRetry }) {
  const { t } = useTranslation();
  return (
    <EmptyState icon={AlertOctagon} tone="critical" title={title} body={body}
      action={onRetry && <Button variant="secondary" onClick={onRetry}>{t('retry')}</Button>} />
  );
}

export function Spinner() { return <span className="spinner" aria-hidden="true" />; }

export function SkeletonRows({ rows = 5, cols = 4 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c}><div className="skeleton" style={{ height: 12, width: c === 0 ? '40%' : '65%' }} /></td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/* ---------- Sortable table header ---------- */
export function SortHeader({ id, sort, onSort, align, children }) {
  const active = sort.key === id;
  const dir = active ? sort.dir : null;
  return (
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        style={align === 'end' ? { textAlign: 'end' } : undefined}>
      <button type="button" onClick={() => onSort(id)}>
        {children}
        {active && (dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
      </button>
    </th>
  );
}

export function Pagination({ page, pageSize, total, onPage }) {
  const { t } = useTranslation();
  if (total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="pager">
      <span className="tabular">{t('showing_range', { from, to, total })}</span>
      <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>‹</Button>
        <Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>›</Button>
      </span>
    </div>
  );
}
