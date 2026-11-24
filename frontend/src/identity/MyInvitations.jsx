import React, { useEffect, useState } from 'react';
import { createStaffClient } from './staff-client.js';

const client = createStaffClient();

/** Invitaciones recibidas: la vinculación solo ocurre si la persona acepta (F011-FR-004). */
export function MyInvitations({ api = client, onAccepted = () => {} }) {
  const [invitations, setInvitations] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let active = true;
    api.listMine().then(rows => { if (active) setInvitations(rows); }).catch(() => { if (active) setInvitations([]); });
    return () => { active = false; };
  }, [api]);

  async function respond(id, action) {
    setBusyId(id); setMessage(null);
    try {
      await (action === 'accept' ? api.accept(id) : api.decline(id));
      setInvitations(await api.listMine());
      if (action === 'accept') { setMessage('Ya formas parte de la farmacia.'); onAccepted(); }
      else setMessage('Invitación rechazada.');
    } catch {
      setMessage('No se pudo completar la acción. La invitación pudo haber vencido o cambiado.');
      try { setInvitations(await api.listMine()); } catch { setInvitations([]); }
    } finally { setBusyId(null); }
  }

  if (invitations.length === 0 && !message) return null;
  return <section aria-labelledby="my-invitations-title">
    <h2 id="my-invitations-title">Mis invitaciones</h2>
    {message && <p role="status">{message}</p>}
    <ul>{invitations.map(item => <li key={item.id}>
      <span>{item.pharmacyName} — vence el {new Date(item.expiresAt).toLocaleDateString('es-PE')}</span>{' '}
      <button type="button" disabled={busyId === item.id} onClick={() => void respond(item.id, 'accept')}>Aceptar</button>{' '}
      <button type="button" disabled={busyId === item.id} onClick={() => void respond(item.id, 'decline')}>Rechazar</button>
    </li>)}</ul>
  </section>;
}
