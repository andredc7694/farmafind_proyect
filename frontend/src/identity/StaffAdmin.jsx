import React, { useEffect, useState } from 'react';
import { createStaffClient } from './staff-client.js';

const client = createStaffClient();

const capabilityLabels = [
  ['reservation.read', 'Ver reservas'],
  ['reservation.accept', 'Confirmar reservas'],
  ['reservation.deliver', 'Entregar reservas'],
  ['inventory.read', 'Ver inventario'],
  ['inventory.write', 'Editar inventario'],
  ['inventory.import.preview', 'Preparar importaciones'],
  ['inventory.import.confirm', 'Confirmar importaciones'],
  ['inventory.history', 'Ver historial de inventario'],
];

/** Solo una respuesta correcta del servidor revela esta vista; el navegador no concede nada. */
export function StaffAdmin({ pharmacyId, api = client }) {
  const [status, setStatus] = useState('loading');
  const [members, setMembers] = useState([]);
  const [alias, setAlias] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [capabilities, setCapabilities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [issued, setIssued] = useState(null); // { alias, temporaryPassword, expiresAt }: se muestra una sola vez

  useEffect(() => {
    let active = true;
    setStatus('loading'); setMembers([]); setIssued(null);
    api.list(pharmacyId).then(rows => { if (active) { setMembers(rows); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('denied'); });
    return () => { active = false; setIssued(null); };
  }, [pharmacyId, api]);

  function toggle(code) {
    setCapabilities(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code]);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      const created = await api.create(pharmacyId, { alias: alias.trim(), displayName: displayName.trim(), capabilities });
      setIssued({ alias: created.alias, temporaryPassword: created.temporaryPassword, expiresAt: created.expiresAt });
      setAlias(''); setDisplayName(''); setCapabilities([]);
      setMembers(await api.list(pharmacyId));
    } catch (error) {
      setMessage(error?.status === 409 ? 'Ese usuario no está disponible. Prueba con otro.'
        : 'No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.');
    } finally { setBusy(false); }
  }

  if (status === 'loading') return <p role="status">Comprobando acceso al personal…</p>;
  if (status === 'denied') return null;
  return <section aria-labelledby="staff-admin-title">
    <h2 id="staff-admin-title">Personal de la farmacia</h2>
    {issued && <div role="alert" className="notice">
      <p>Cuenta creada: <strong>{issued.alias}</strong>. Entrega esta clave temporal en persona. <strong>Se muestra una sola vez</strong>{' '}
        y vence el {new Date(issued.expiresAt).toLocaleString('es-PE')}.</p>
      <p><code aria-label="Clave temporal">{issued.temporaryPassword}</code></p>
      <button type="button" onClick={() => setIssued(null)}>Ya la entregué; ocultar</button>
    </div>}
    <form onSubmit={submit}>
      <label htmlFor="staff-alias">Usuario (alias) del trabajador</label>
      <input id="staff-alias" value={alias} onChange={event => setAlias(event.target.value)} required
        minLength={3} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,39}" autoComplete="off" />
      <label htmlFor="staff-name">Nombre para mostrar</label>
      <input id="staff-name" value={displayName} onChange={event => setDisplayName(event.target.value)} required maxLength={120} autoComplete="off" />
      <fieldset><legend>Permisos iniciales</legend>
        {capabilityLabels.map(([code, label]) => <label key={code}>
          <input type="checkbox" checked={capabilities.includes(code)} onChange={() => toggle(code)} /> {label}
        </label>)}
      </fieldset>
      {message && <p role="alert">{message}</p>}
      <button type="submit" disabled={busy}>Crear cuenta de trabajador</button>
    </form>
    <ul>{members.map(member => <li key={member.membershipId}>
      <strong>{member.alias ?? member.userId}</strong> — {member.displayName ?? 'sin nombre'} — {member.state}
      {member.pendingTemporaryKey && ' — clave temporal pendiente de usar'}
    </li>)}</ul>
  </section>;
}
