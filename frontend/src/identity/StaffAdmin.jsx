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

const stateLabel = { PENDIENTE: 'pendiente', ACEPTADA: 'aceptada', RECHAZADA: 'rechazada', VENCIDA: 'vencida', REVOCADA: 'revocada' };

/**
 * El nombre para mostrar «parece un usuario» cuando es una sola palabra con dígitos, punto, guion o
 * guion bajo (p. ej. «JOSE_01») y no coincide con el usuario real: el trabajador podría confundirlos al entrar.
 */
export function nameLooksLikeUsername(displayName, alias) {
  const name = String(displayName ?? '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/.test(name) && /[0-9._-]/.test(name) &&
    name.toLowerCase() !== String(alias ?? '').trim().toLowerCase();
}

function LoginHint({ alias }) {
  return alias
    ? <>Usuario para entrar: <code>{alias}</code></>
    : <>Entra con su correo</>;
}

function CapabilityChecklist({ selected, onToggle, idPrefix }) {
  return <>{capabilityLabels.map(([code, label]) => <label key={code} htmlFor={`${idPrefix}-${code}`}>
    <input id={`${idPrefix}-${code}`} type="checkbox" checked={selected.includes(code)} onChange={() => onToggle(code)} /> {label}
  </label>)}</>;
}

function MemberRow({ member, busy, onSave, onRevoke, onReissue }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(member.capabilities);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setSelected(member.capabilities); }, [member.capabilities]);
  const toggle = code => setSelected(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code]);
  const active = member.state === 'ACTIVA';
  return <li>
    <strong>{member.displayName ?? 'sin nombre'}</strong> — <LoginHint alias={member.alias} /> — {member.state}
    {member.pendingTemporaryKey && ' — clave temporal pendiente de usar'}
    {active && <>{' '}
      <button type="button" disabled={busy} onClick={() => setEditing(value => !value)}>
        {editing ? 'Cerrar permisos' : 'Permisos'}</button>{' '}
      {onReissue && member.alias && <><button type="button" disabled={busy} onClick={() => onReissue(member)}>Emitir nueva clave temporal</button>{' '}</>}
      {!confirming
        ? <button type="button" disabled={busy} onClick={() => setConfirming(true)}>Revocar acceso</button>
        : <><button type="button" disabled={busy} onClick={() => { setConfirming(false); onRevoke(member); }}>Confirmar revocación</button>{' '}
          <button type="button" onClick={() => setConfirming(false)}>Cancelar</button></>}
    </>}
    {active && editing && <fieldset><legend>Permisos de {member.alias ?? member.displayName}</legend>
      <CapabilityChecklist selected={selected} onToggle={toggle} idPrefix={`cap-${member.membershipId}`} />
      <button type="button" disabled={busy} onClick={() => onSave(member, selected)}>Guardar permisos</button>
    </fieldset>}
  </li>;
}

/** Solo una respuesta correcta del servidor revela esta vista; el navegador no concede nada. */
export function StaffAdmin({ pharmacyId, api = client }) {
  const [status, setStatus] = useState('loading');
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [alias, setAlias] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [capabilities, setCapabilities] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [notice, setNotice] = useState(null);
  const [issued, setIssued] = useState(null); // { alias, temporaryPassword, expiresAt }: se muestra una sola vez

  async function refresh() {
    setMembers(await api.list(pharmacyId));
    setInvitations(api.listInvitations ? await api.listInvitations(pharmacyId) : []);
  }

  useEffect(() => {
    let active = true;
    setStatus('loading'); setMembers([]); setInvitations([]); setIssued(null); setNotice(null);
    Promise.all([api.list(pharmacyId), api.listInvitations ? api.listInvitations(pharmacyId) : Promise.resolve([])])
      .then(([rows, invites]) => { if (active) { setMembers(rows); setInvitations(invites); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('denied'); });
    return () => { active = false; setIssued(null); };
  }, [pharmacyId, api]);

  function toggle(code) {
    setCapabilities(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code]);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setMessage(null); setNotice(null);
    try {
      const created = await api.create(pharmacyId, { alias: alias.trim(), displayName: displayName.trim(), capabilities });
      setIssued({ alias: created.alias, displayName: displayName.trim(), temporaryPassword: created.temporaryPassword, expiresAt: created.expiresAt });
      setAlias(''); setDisplayName(''); setCapabilities([]);
      await refresh();
    } catch (error) {
      setMessage(error?.status === 409 ? 'Ese usuario no está disponible. Prueba con otro.'
        : 'No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.');
    } finally { setBusy(false); }
  }

  async function invite(event) {
    event.preventDefault();
    setBusy(true); setMessage(null); setNotice(null);
    try {
      await api.invite(pharmacyId, inviteEmail.trim());
      setInviteEmail('');
      setNotice('Si existe una cuenta con ese correo, recibirá la invitación en «Mis invitaciones». No se confirma si la cuenta existe.');
      await refresh();
    } catch { setMessage('No se pudo enviar la invitación. Revisa el correo e inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }

  async function run(action, failure) {
    setBusy(true); setMessage(null); setNotice(null);
    try { await action(); await refresh(); }
    catch { setMessage(failure); try { await refresh(); } catch { /* se conserva el estado anterior */ } }
    finally { setBusy(false); }
  }

  async function reissue(member) {
    setBusy(true); setMessage(null); setNotice(null);
    try {
      const created = await api.issueTemporaryKey(pharmacyId, member.userId);
      setIssued({ alias: member.alias, displayName: member.displayName, temporaryPassword: created.temporaryPassword, expiresAt: created.expiresAt });
      await refresh();
    } catch { setMessage('No se pudo emitir la clave. Solo aplica a trabajadores sin correo de tu farmacia.'); }
    finally { setBusy(false); }
  }

  if (status === 'loading') return <p role="status">Comprobando acceso al personal…</p>;
  if (status === 'denied') return null;
  return <section aria-labelledby="staff-admin-title">
    <h2 id="staff-admin-title">Personal de la farmacia</h2>
    {issued && <div role="alert" className="notice">
      <p>Clave temporal para <strong>{issued.displayName ?? issued.alias}</strong>. Entrega esta clave en persona. <strong>Se muestra una sola vez</strong>{' '}
        y vence el {new Date(issued.expiresAt).toLocaleString('es-PE')}.</p>
      <p className="login-hint"><LoginHint alias={issued.alias} /></p>
      <p><code aria-label="Clave temporal">{issued.temporaryPassword}</code></p>
      {nameLooksLikeUsername(issued.displayName, issued.alias) &&
        <p>Recuérdale que entra con el usuario <code>{issued.alias}</code>, no con su nombre «{issued.displayName}».</p>}
      <button type="button" onClick={() => setIssued(null)}>Ya la entregué; ocultar</button>
    </div>}
    <form onSubmit={submit}>
      <label htmlFor="staff-alias">Usuario (alias) del trabajador</label>
      <input id="staff-alias" value={alias} onChange={event => setAlias(event.target.value)} required
        minLength={3} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,39}" autoComplete="off" />
      <label htmlFor="staff-name">Nombre para mostrar</label>
      <input id="staff-name" value={displayName} onChange={event => setDisplayName(event.target.value)} required maxLength={120} autoComplete="off"
        aria-describedby={nameLooksLikeUsername(displayName, alias) ? 'staff-name-warning' : undefined} />
      {nameLooksLikeUsername(displayName, alias) && <p id="staff-name-warning" className="field-warning" aria-live="polite">
        Este nombre parece un usuario. Para entrar, el trabajador usará el usuario
        {alias.trim() ? <> <code>{alias.trim().toLowerCase()}</code></> : ' que escribas arriba'}, no este nombre.
        Puedes usar su nombre real, por ejemplo «José Pérez».</p>}
      <fieldset><legend>Permisos iniciales</legend>
        <CapabilityChecklist selected={capabilities} onToggle={toggle} idPrefix="new-cap" />
      </fieldset>
      {message && <p role="alert">{message}</p>}
      <button type="submit" disabled={busy}>Crear cuenta de trabajador</button>
    </form>
    {api.invite && <form onSubmit={invite} aria-labelledby="invite-title">
      <h3 id="invite-title">Invitar a una cuenta existente</h3>
      <label htmlFor="invite-email">Correo de la persona</label>
      <input id="invite-email" type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)}
        required maxLength={254} autoComplete="off" />
      <button type="submit" disabled={busy}>Enviar invitación</button>
      {notice && <p role="status">{notice}</p>}
    </form>}
    {invitations.length > 0 && <>
      <h3>Invitaciones enviadas</h3>
      <ul>{invitations.map(item => <li key={item.id}>
        {item.destination} — {stateLabel[item.state] ?? item.state}{' '}
        {item.state === 'PENDIENTE' && <button type="button" disabled={busy}
          onClick={() => void run(() => api.revokeInvitation(pharmacyId, item.id), 'No se pudo revocar la invitación.')}>
          Revocar invitación</button>}
      </li>)}</ul></>}
    <ul>{members.map(member => <MemberRow key={member.membershipId} member={member} busy={busy}
      onSave={(row, selected) => void run(() => api.setCapabilities(pharmacyId, row.membershipId, selected), 'No se pudieron guardar los permisos.')}
      onRevoke={row => void run(() => api.revokeMembership(pharmacyId, row.membershipId), 'No se pudo revocar el acceso.')}
      onReissue={api.issueTemporaryKey ? row => void reissue(row) : undefined} />)}</ul>
  </section>;
}
