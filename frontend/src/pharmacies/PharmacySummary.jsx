import React, { useCallback, useEffect, useState } from 'react';
import { createSummaryClient } from './summary-client.js';

const defaultClient = createSummaryClient();

function Card({ label, value, hint }) {
  return <li className="surface-card summary-card"><strong className="summary-value">{value}</strong><span>{label}</span>{hint && <small>{hint}</small>}</li>;
}

/**
 * Resumen de UNA farmacia: pide solo las lecturas que sus capacidades permiten y muestra el aviso cuando el servidor
 * deniega. La visibilidad es presentación: el servidor autoriza cada lectura.
 */
export function PharmacySummary({ pharmacyId, capabilities = [], client = defaultClient }) {
  const [reservations, setReservations] = useState({ state: 'idle' });
  const [inventory, setInventory] = useState({ state: 'idle' });
  const canReservations = capabilities.includes('reservation.read');
  const canInventory = capabilities.includes('inventory.read');

  const load = useCallback(async () => {
    const run = async (enabled, call, set) => {
      if (!enabled) { set({ state: 'idle' }); return; }
      set({ state: 'loading' });
      try { set({ state: 'ready', data: await call(pharmacyId) }); }
      catch (error) { set({ state: [401, 403, 404].includes(error?.status) ? 'denied' : 'error' }); }
    };
    await Promise.all([run(canReservations, client.reservations, setReservations), run(canInventory, client.inventory, setInventory)]);
  }, [client, pharmacyId, canReservations, canInventory]);

  useEffect(() => { setReservations({ state: 'idle' }); setInventory({ state: 'idle' }); void load(); }, [load]);

  const problem = state => state === 'denied' ? 'No tienes autorización para ver estas cifras.' : state === 'error' ? 'No se pudieron cargar estas cifras.' : null;
  return <section aria-labelledby="summary-title">
    <h2 id="summary-title">Resumen de la farmacia</h2>
    {!canReservations && !canInventory && <p role="status">Tu cuenta no tiene permisos para ver cifras de esta farmacia.</p>}
    {canReservations && <>
      <h3>Reservas</h3>
      {problem(reservations.state) && <p role="alert">{problem(reservations.state)}</p>}
      {reservations.state === 'loading' && <p role="status">Cargando cifras de reservas…</p>}
      {reservations.state === 'ready' && <ul className="summary-grid">
        <Card label="Pendientes de responder" value={reservations.data.pending} />
        <Card label="Confirmadas" value={reservations.data.confirmed} />
        <Card label="Por vencer (en 1 hora o menos)" value={reservations.data.expiringSoon} />
      </ul>}
    </>}
    {canInventory && <>
      <h3>Inventario</h3>
      {problem(inventory.state) && <p role="alert">{problem(inventory.state)}</p>}
      {inventory.state === 'loading' && <p role="status">Cargando cifras de inventario…</p>}
      {inventory.state === 'ready' && <ul className="summary-grid">
        <Card label="Productos en inventario" value={inventory.data.products} />
        <Card label="Productos sin stock disponible" value={inventory.data.withoutStock} />
      </ul>}
    </>}
    {(canReservations || canInventory) && <button type="button" onClick={() => void load()}>Actualizar cifras</button>}
  </section>;
}
