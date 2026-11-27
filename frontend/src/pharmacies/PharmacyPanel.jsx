import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createSessionClient } from '../identity/session-client.js';
import { createReservationsClient } from '../reservations/reservations-client.js';
import { PharmacyReservations } from '../reservations/PharmacyReservations.jsx';
import { InventoryView } from '../inventory/InventoryView.jsx';
import { StaffAdmin } from '../identity/StaffAdmin.jsx';
import { MyPharmacy } from './MyPharmacy.jsx';
import { PharmacySummary } from './PharmacySummary.jsx';
import { panelSections } from '../app/navigation.js';

const importCapabilities = ['inventory.import.preview', 'inventory.import.confirm'];

function PickupSettings({ client, pharmacyId }) {
  const [hours, setHours] = useState(4);
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true; setState('loading');
    client.settings(pharmacyId).then(value => { if (active) { setHours(value.pickupWindowHours); setState('ready'); } }).catch(() => { if (active) setState('denied'); });
    return () => { active = false; };
  }, [client, pharmacyId]);
  async function save(event) {
    event.preventDefault(); setMessage('');
    try { await client.saveSettings(pharmacyId, Number(hours)); setMessage('Plazo guardado por la farmacia.'); }
    catch { setMessage('No se pudo guardar. Comprueba tus permisos.'); }
  }
  if (state === 'loading') return <p role="status">Cargando configuración…</p>;
  if (state === 'denied') return <p role="status">La configuración no está autorizada para esta sesión.</p>;
  return <section aria-labelledby="settings-title">
    <h2 id="settings-title">Configuración de reservas</h2>
    <form onSubmit={save}>
      <label htmlFor="panel-pickup-hours">Plazo de recogida (1 a 8 horas)</label>
      <input id="panel-pickup-hours" type="number" min="1" max="8" value={hours} onChange={event => setHours(event.target.value)} />
      <button type="submit">Guardar plazo</button>
    </form>
    {message && <p role="status">{message}</p>}
  </section>;
}

/** Historial de la farmacia: reservas, importaciones y movimientos, cada vista solo con su capacidad. */
function PharmacyHistory({ client, pharmacyId, capabilities }) {
  const views = [
    capabilities.includes('reservation.read') && { id: 'atendidas', label: 'Atendidas' },
    capabilities.includes('inventory.history') && { id: 'importaciones', label: 'Importaciones' },
    capabilities.includes('inventory.history') && { id: 'movimientos', label: 'Movimientos' },
  ].filter(Boolean);
  const [chosen, setChosen] = useState(null);
  const active = views.some(view => view.id === chosen) ? chosen : views[0]?.id ?? null;
  return <>
    {views.length > 1 && <div role="group" aria-label="Tipo de historial">{views.map(view =>
      <button type="button" key={view.id} aria-pressed={view.id === active} onClick={() => setChosen(view.id)}>{view.label}</button>)}</div>}
    {active === 'atendidas' && <PharmacyReservations client={client} pharmacyId={pharmacyId} capabilities={capabilities} showSettings={false} showTabs={false} initialTab="history" />}
    {(active === 'importaciones' || active === 'movimientos') &&
      <InventoryView key={active} pharmacyId={pharmacyId} capabilities={capabilities} section={active} />}
  </>;
}

/**
 * Panel de farmacia (F08.1): secciones por capacidad, en el orden de la spec, compuestas con los componentes existentes.
 * Es presentación: cada petición la autoriza el servidor y, si una capacidad se revoca, la siguiente lectura falla.
 */
export function PharmacyPanel({ sessionClient: injectedSession, reservationsClient: injectedReservations }) {
  const sessionClient = useMemo(() => injectedSession ?? createSessionClient(), [injectedSession]);
  const reservationsClient = useMemo(() => injectedReservations ?? createReservationsClient(), [injectedReservations]);
  const [status, setStatus] = useState('loading');
  const [memberships, setMemberships] = useState([]);
  const [pharmacyId, setPharmacyId] = useState(null);
  const [sectionId, setSectionId] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const session = await sessionClient.session();
      if (!session) { setMemberships([]); setStatus('anonymous'); return; }
      const own = (await sessionClient.memberships()).filter(item => panelSections(item.delegationCodes ?? []).length > 0);
      setMemberships(own); setStatus(own.length ? 'ready' : 'none');
      setPharmacyId(current => own.some(item => item.pharmacyId === current) ? current : own[0]?.pharmacyId ?? null);
    } catch { setStatus('error'); }
  }, [sessionClient]);

  useEffect(() => {
    void refresh();
    const again = () => { void refresh(); };
    window.addEventListener('focus', again); window.addEventListener('farmafind:session-changed', again);
    return () => { window.removeEventListener('focus', again); window.removeEventListener('farmafind:session-changed', again); };
  }, [refresh]);

  const current = memberships.find(item => item.pharmacyId === pharmacyId) ?? null;
  const codes = current?.delegationCodes ?? [];
  const sections = panelSections(codes);
  const activeSection = sections.some(item => item.id === sectionId) ? sectionId : sections[0]?.id ?? null;
  useEffect(() => { setSectionId(null); }, [pharmacyId]);

  if (status === 'loading') return <p role="status">Cargando tu panel…</p>;
  if (status === 'anonymous') return <p role="status">Inicia sesión para ver el panel de tu farmacia. <a href="/identity">Ir a Mi cuenta</a></p>;
  if (status === 'error') return <p role="alert">No se pudo cargar el panel. Inténtalo de nuevo.</p>;
  if (status === 'none' || !current) return <p role="status">Tu cuenta no tiene tareas asignadas en ninguna farmacia.</p>;

  return <div className="page-stack pharmacy-panel">
    <header>
      <h1>Panel de farmacia</h1>
      {memberships.length > 1 ? <div role="group" aria-label="Farmacia activa">{memberships.map(item =>
        <button type="button" key={item.pharmacyId} aria-pressed={item.pharmacyId === pharmacyId}
          onClick={() => setPharmacyId(item.pharmacyId)}>{item.pharmacyName}</button>)}</div>
        : <p>{current.pharmacyName}</p>}
    </header>
    <nav aria-label="Secciones de la farmacia"><ul className="panel-nav">{sections.map(item => <li key={item.id}>
      <button type="button" aria-current={item.id === activeSection ? 'true' : undefined} onClick={() => setSectionId(item.id)}>{item.label}</button></li>)}</ul></nav>
    <div key={`${pharmacyId}:${activeSection}`}>
      {activeSection === 'resumen' && <PharmacySummary pharmacyId={pharmacyId} capabilities={codes} />}
      {activeSection === 'farmacia' && <MyPharmacy pharmacyId={pharmacyId} codes={codes} />}
      {activeSection === 'inventario' && <InventoryView pharmacyId={pharmacyId} section="inventario" capabilities={codes.filter(code => !importCapabilities.includes(code))} />}
      {activeSection === 'importar' && <InventoryView pharmacyId={pharmacyId} section="importar" capabilities={codes.filter(code => code === 'inventory.read' || importCapabilities.includes(code))} />}
      {activeSection === 'reservas' && <PharmacyReservations client={reservationsClient} pharmacyId={pharmacyId} capabilities={codes} showSettings={false} showTabs={false} />}
      {activeSection === 'historial' && <PharmacyHistory client={reservationsClient} pharmacyId={pharmacyId} capabilities={codes} />}
      {activeSection === 'personal' && <StaffAdmin pharmacyId={pharmacyId} />}
      {activeSection === 'configuracion' && <PickupSettings client={reservationsClient} pharmacyId={pharmacyId} />}
    </div>
  </div>;
}
