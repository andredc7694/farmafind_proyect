import React, { useEffect, useMemo, useState } from 'react';
import { createReservationsClient } from './reservations-client.js';
import { CreateReservation } from './CreateReservation.jsx';
import { OwnReservations } from './OwnReservations.jsx';
import { PharmacyReservations } from './PharmacyReservations.jsx';

export function ReservationsView({ pharmacyId, capabilities = null }) {
  const client = useMemo(() => createReservationsClient(), []);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const offerPharmacyId = params.get('pharmacyId') || '';
  const offerMedicationId = params.get('medicationId') || '';
  const targetPharmacyId = offerPharmacyId || pharmacyId;

  async function reload() { setItems(await client.own()); }
  useEffect(() => { void reload().catch(() => setMessage('No se pudieron consultar las reservas.')); }, []);

  async function action(work) {
    setBusy(true); setMessage('');
    try { await work(); await reload(); }
    catch { setMessage('No se pudo completar la operación. Comprueba tu sesión y el estado de la reserva.'); }
    finally { setBusy(false); }
  }

  return <section aria-labelledby="reservations-title">
    <h2 id="reservations-title">Reservas</h2>
    {message && <p role="alert">{message}</p>}
    {!pharmacyId && <p>Para solicitar una reserva, elige una oferta en <a href="/search">la búsqueda pública</a>. Tus reservas propias se muestran aquí aunque no pertenezcas a una farmacia.</p>}
    <CreateReservation pharmacyId={targetPharmacyId} medicationId={offerMedicationId} busy={busy}
      onCreate={(medicationId, quantity) => action(() => client.create(targetPharmacyId, medicationId, quantity))} />
    <OwnReservations items={items} busy={busy} onCancel={id => action(() => client.cancel(id))} />
    {pharmacyId && <PharmacyReservations client={client} pharmacyId={pharmacyId} capabilities={capabilities} />}
  </section>;
}
