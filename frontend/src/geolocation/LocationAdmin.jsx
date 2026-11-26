import React, { useCallback, useEffect, useState } from 'react';
import { createLocationAdminClient } from './location-admin-client.js';
import { createLocationStatusClient } from './my-pharmacy-clients.js';
import { PointPicker } from './PointPicker.jsx';

const defaultStatusClient = createLocationStatusClient();
/** F071-FR-004: límites aproximados del Perú (el servidor y la base los vuelven a comprobar). */
export const PERU_BOUNDS = { minLatitude: -18.4, maxLatitude: 0.1, minLongitude: -81.4, maxLongitude: -68.6 };
export const insidePeru = (lat, lng) => lat >= PERU_BOUNDS.minLatitude && lat <= PERU_BOUNDS.maxLatitude
  && lng >= PERU_BOUNDS.minLongitude && lng <= PERU_BOUNDS.maxLongitude;

const stateLabel = { SIN_UBICACION: 'Sin ubicación publicada', EN_REVISION: 'En revisión', VERIFICADA: 'Verificada', RECHAZADA: 'Rechazada' };
const actionLabel = { PROPUESTA: 'Propuesta enviada', APROBACION: 'Aprobada', RECHAZO: 'Rechazada', REEMPLAZADA: 'Reemplazada' };

/** Presentation visibility follows F01 capabilities; every write is reauthorized by F07/RLS. */
export function LocationAdmin({ pharmacyId, delegationCodes = [], client = createLocationAdminClient(), statusClient = defaultStatusClient }) {
  const canPropose = delegationCodes.includes('GEO_LOCATION_PROPOSE');
  const canReview = delegationCodes.includes('GEO_LOCATION_REVIEW');
  const [status, setStatus] = useState('');
  const [statusKind, setStatusKind] = useState('status');
  const [proposalId, setProposalId] = useState('');
  const [busy, setBusy] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [view, setView] = useState(null);
  const point = latitude !== '' && longitude !== '' ? { latitude: Number(latitude), longitude: Number(longitude) } : null;
  const outside = point && !insidePeru(point.latitude, point.longitude);
  const loadStatus = useCallback(() => {
    if (!pharmacyId || !canPropose) { setView(null); return; }
    statusClient.status(pharmacyId).then(setView).catch(() => setView(null));
  }, [pharmacyId, canPropose, statusClient]);
  useEffect(() => { setProposalId(''); setStatus(''); setStatusKind('status'); setLatitude(''); setLongitude(''); loadStatus(); }, [pharmacyId, loadStatus]);
  if (!pharmacyId || (!canPropose && !canReview)) return null;
  async function perform(action) {
    setBusy(true); setStatus('');
    try {
      const result = await action(); setProposalId(result.id); setStatusKind('status');
      setStatus(result.estado === 'PENDIENTE'
        ? 'Propuesta enviada. Queda «En revisión» hasta que FarmaFind la verifique; la ubicación publicada no cambia mientras tanto.'
        : `Revisión registrada: ${result.estado}.`);
      loadStatus();
    } catch (error) { setStatusKind('alert'); setStatus(error.message); } finally { setBusy(false); }
  }
  return <section aria-labelledby="location-admin-title">
    <h2 id="location-admin-title">Dirección y ubicación en el mapa</h2>
    <p className="notice">Operación disponible únicamente en el entorno TEST/DEMO autorizado.</p>
    {view && <div className="surface-card location-status" aria-live="polite">
      <p><strong>Estado: {stateLabel[view.estado] ?? view.estado}</strong></p>
      {view.publicada ? <p>Publicada: {view.publicada.direccion}{view.publicada.ciudad ? `, ${view.publicada.ciudad}` : ''}.</p>
        : <p>Tu farmacia aún no aparece en el mapa público; sí aparece en la búsqueda.</p>}
      {view.pendiente && <p>En revisión: {view.pendiente.direccion}, {view.pendiente.ciudad}.</p>}
      {view.historial.length > 0 && <details><summary>Historial de cambios</summary>
        <ol className="location-history">{view.historial.map((item, index) => <li key={`${item.fecha}-${index}`}>
          {new Date(item.fecha).toLocaleString('es-PE')} · {actionLabel[item.accion] ?? item.accion} · {item.autor} · {item.direccion}
          {item.motivo ? ` · Motivo: ${item.motivo}` : ''}</li>)}</ol></details>}
    </div>}
    {status && <p role={statusKind}>{status}</p>}
    {canPropose && <form className="surface-card" onSubmit={event => {
      event.preventDefault(); if (outside) return;
      const data = new FormData(event.currentTarget);
      void perform(() => client.propose(pharmacyId, {
        direccionPublicable: String(data.get('direccionPublicable')),
        ciudad: String(data.get('ciudad')), latitud: Number(data.get('latitud')),
        longitud: Number(data.get('longitud')), fuente: String(data.get('fuente')),
        evidenciaReferencia: String(data.get('evidenciaReferencia')),
      }));
    }}>
      <h3>Proponer dirección y ubicación</h3>
      <p className="field-hint">Marca el punto en el mapa, usa la ubicación de este dispositivo (una sola lectura, sin rastreo) o escribe las coordenadas. FarmaFind lo revisará antes de publicarlo.</p>
      <label>Dirección pública <input name="direccionPublicable" required maxLength={240} /></label>
      <label>Ciudad <input name="ciudad" required minLength={2} maxLength={120} /></label>
      <PointPicker value={point} onChange={next => { setLatitude(String(next.latitude)); setLongitude(String(next.longitude)); }} />
      <label>Latitud <input name="latitud" required type="number" step="any" min={PERU_BOUNDS.minLatitude} max={PERU_BOUNDS.maxLatitude} value={latitude} onChange={event => setLatitude(event.target.value)} /></label>
      <label>Longitud <input name="longitud" required type="number" step="any" min={PERU_BOUNDS.minLongitude} max={PERU_BOUNDS.maxLongitude} value={longitude} onChange={event => setLongitude(event.target.value)} /></label>
      {outside && <p role="alert">Ese punto está fuera del Perú. Revisa las coordenadas.</p>}
      <label><input name="confirmaDireccion" type="checkbox" required /> Confirmo que la dirección pública y el punto elegido son correctos</label>
      <label>Fuente <input name="fuente" required minLength={2} maxLength={120} placeholder="Por ejemplo: visita al local" /></label>
      <label>Referencia de evidencia no sensible <input name="evidenciaReferencia" required maxLength={240} /></label>
      <button disabled={busy || outside}>Enviar propuesta</button>
    </form>}
    {canReview && <form className="surface-card" onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      void perform(() => client.review(pharmacyId, String(data.get('propuestaId')),
        { decision: String(data.get('decision')), evidenciaConfirmada: data.get('evidenciaConfirmada') === 'on',
          motivo: String(data.get('motivo')) }));
    }}>
      <h3>Revisar propuesta ajena</h3>
      <label>ID de propuesta <input name="propuestaId" required value={proposalId}
        onChange={event => setProposalId(event.target.value)} /></label>
      <label>Decisión <select name="decision"><option value="APROBAR">Aprobar</option>
        <option value="RECHAZAR">Rechazar</option></select></label>
      <label><input name="evidenciaConfirmada" type="checkbox" /> Evidencia comprobada</label>
      <label>Motivo <input name="motivo" maxLength={500} required /></label>
      <button disabled={busy}>Registrar revisión</button>
    </form>}
  </section>;
}
