import React, { useEffect, useState } from 'react';
import { createMembershipAdminClient } from './membership-admin-client.js';

const client = createMembershipAdminClient();

/** Only a successful server response reveals this view; the browser grants nothing. */
export function MembershipAdmin({ pharmacyId }) {
  const [status, setStatus] = useState('loading');
  const [workers, setWorkers] = useState([]);
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setWorkers([]);
    client.list(pharmacyId).then(rows => {
      if (active) { setWorkers(rows); setStatus('ready'); }
    }).catch(() => { if (active) setStatus('denied'); });
    return () => { active = false; };
  }, [pharmacyId]);

  async function change(action) {
    setBusy(true);
    try {
      await action();
      setWorkers(await client.list(pharmacyId));
      setUserId('');
      setStatus('ready');
    } catch { setStatus('error'); }
    finally { setBusy(false); }
  }

  if (status === 'loading') return <p role="status">Comprobando acceso a trabajadores…</p>;
  if (status === 'denied') return null;
  return <section aria-labelledby="worker-admin-title">
    <h2 id="worker-admin-title">Trabajadores de la farmacia seleccionada</h2>
    {status === 'error' && <p role="alert">No se pudo completar la operación.</p>}
    <form onSubmit={event => { event.preventDefault(); void change(() => client.grant(pharmacyId, userId)); }}>
      <label htmlFor="worker-user-id">Identificador del usuario</label>
      <input id="worker-user-id" value={userId} onChange={event => setUserId(event.target.value)}
        required autoComplete="off" />
      <button type="submit" disabled={busy}>Conceder rol TRABAJADOR</button>
    </form>
    <ul>{workers.map(worker => <li key={worker.id}>
      <span>{worker.userId} — {worker.status}</span>{' '}
      {worker.status === 'ACTIVA' && <button type="button" disabled={busy}
        onClick={() => void change(() => client.revoke(pharmacyId, worker.id))}>Revocar TRABAJADOR</button>}
    </li>)}</ul>
  </section>;
}
