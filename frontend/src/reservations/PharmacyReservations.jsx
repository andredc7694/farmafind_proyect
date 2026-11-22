import React, { useEffect, useState } from 'react';

/** Presentation visibility only; F04 and PostgreSQL RLS authorize every request. */
export function PharmacyReservations({ client, pharmacyId, onChanged, capabilities = null }) {
  const [queue, setQueue] = useState([]);
  const [hours, setHours] = useState(4);
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState('status');
  const can = capability => capabilities === null || capabilities.includes(capability);
  const canRead = can('reservation.read');

  async function reload() {
    const [items, settings] = await Promise.all([client.queue(pharmacyId), client.settings(pharmacyId)]);
    setQueue(items);
    setHours(settings.pickupWindowHours);
    onChanged?.();
  }

  useEffect(() => {
    if (!canRead) return undefined;
    let active = true;
    setStatus('loading');
    Promise.all([client.queue(pharmacyId), client.settings(pharmacyId)])
      .then(([items, settings]) => {
        if (active) { setQueue(items); setHours(settings.pickupWindowHours); setStatus('ready'); }
      }).catch(() => { if (active) setStatus('denied'); });
    return () => { active = false; };
  }, [client, pharmacyId, canRead]);

  async function action(work, success) {
    setBusy(true); setMessage('');
    try {
      await work();
      await reload();
      setMessageKind('status');
      setMessage(success);
    } catch {
      setMessageKind('alert');
      setMessage('La operación no se completó. Comprueba el estado y tus permisos antes de reintentar.');
    } finally { setBusy(false); }
  }

  if (!canRead || status === 'denied') return <p role="status">La administración de reservas no está autorizada para esta sesión.</p>;
  if (status === 'loading') return <p role="status">Cargando reservas de la farmacia…</p>;
  return <section aria-labelledby="pharmacy-reservations-title">
    <h3 id="pharmacy-reservations-title">Cola de la farmacia</h3>
    {message && <p role={messageKind}>{message}</p>}
    {can('reservation.settings') && <form onSubmit={event => {
      event.preventDefault(); void action(() => client.saveSettings(pharmacyId, Number(hours)), 'Plazo guardado por la farmacia.');
    }}>
      <label htmlFor="pickup-hours">Plazo de recogida (1 a 8 horas)</label>
      <input id="pickup-hours" type="number" min="1" max="8" value={hours} onChange={event => setHours(event.target.value)} />
      <button type="submit" disabled={busy}>Guardar plazo</button>
    </form>}
    {queue.length === 0 && <p>No hay reservas de esta farmacia en este momento.</p>}
    <ul className="reservation-queue">{queue.map(item => <li className="surface-card" data-reservation-id={item.id} key={item.id}>
      <strong>{item.state}</strong><span> Cantidad: {item.quantity}</span>
      {item.pickupExpiresAt && <span> · vence {new Date(item.pickupExpiresAt).toLocaleString('es-PE')}</span>}
      <div className="reservation-actions">
        {item.state === 'PENDIENTE' && can('reservation.accept') && <>
          <button type="button" disabled={busy} onClick={() => void action(() => client.confirm(pharmacyId, item.id), 'Reserva confirmada.')}>Confirmar</button>
          <button type="button" disabled={busy} onClick={() => void action(() => client.shortage(pharmacyId, item.id), 'Falta física registrada.')}>Falta física</button>
        </>}
        {item.state === 'CONFIRMADA' && can('reservation.deliver') &&
          <button type="button" disabled={busy} onClick={() => void action(() => client.deliver(pharmacyId, item.id), 'Entrega registrada.')}>Entregar</button>}
      </div>
    </li>)}</ul>
  </section>;
}
