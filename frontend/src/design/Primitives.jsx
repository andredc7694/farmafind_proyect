import React, { useEffect, useRef } from 'react';

export function StatusNotice({ children, kind = 'info' }) {
  return <p className={`status-notice status-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</p>;
}

export function EmptyState({ title, children }) {
  return <div className="empty-state"><span aria-hidden="true">⌕</span><h3>{title}</h3><p>{children}</p></div>;
}

export function Card({ as: Element = 'div', children, className = '' }) {
  return <Element className={`surface-card ${className}`.trim()}>{children}</Element>;
}

export function Button({ children, variant = 'primary', ...props }) {
  return <button className={`button button-${variant}`} {...props}>{children}</button>;
}

export function Field({ id, label, error, ...props }) {
  return <div className="form-field"><label htmlFor={id}>{label}</label><input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props} />{error && <p id={`${id}-error`} role="alert">{error}</p>}</div>;
}

export function ConfirmDialog({ title, description, busy = false, onCancel, onConfirm }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute('open', '');
    return () => { if (dialog?.open && dialog.close) dialog.close(); };
  }, []);
  return <dialog ref={ref} className="confirm-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-description" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h3 id="confirm-title">{title}</h3><p id="confirm-description">{description}</p>
    <div className="dialog-actions"><button type="button" autoFocus disabled={busy} onClick={onCancel}>Volver</button>
      <button type="button" disabled={busy} onClick={onConfirm}>Confirmar acción</button></div>
  </dialog>;
}
