import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createLocationAdminClient } from './location-admin-client.js';
import { createAddressSuggestionClient, createLocationStatusClient } from './my-pharmacy-clients.js';
import { findPeruPlace } from './peru-cities.js';
import { distanceMessage, distanceWarning, findCityCenter } from './distance-check.js';
import { PointPicker } from './PointPicker.jsx';

const defaultStatusClient = createLocationStatusClient();
const defaultSuggestionClient = createAddressSuggestionClient();
/** F071-FR-004: límites aproximados del Perú (el servidor y la base los vuelven a comprobar). */
export const PERU_BOUNDS = { minLatitude: -18.4, maxLatitude: 0.1, minLongitude: -81.4, maxLongitude: -68.6 };
export const insidePeru = (lat, lng) => lat >= PERU_BOUNDS.minLatitude && lat <= PERU_BOUNDS.maxLatitude
  && lng >= PERU_BOUNDS.minLongitude && lng <= PERU_BOUNDS.maxLongitude;

const stateLabel = { SIN_UBICACION: 'Sin ubicación publicada', EN_REVISION: 'En revisión', VERIFICADA: 'Verificada', RECHAZADA: 'Rechazada' };
const actionLabel = { PROPUESTA: 'Propuesta enviada', APROBACION: 'Aprobada', RECHAZO: 'Rechazada', REEMPLAZADA: 'Reemplazada' };
/** F071-FR-015: la fuente se rellena sola según el origen del punto. */
export const SOURCE_LABEL = { gps: 'GPS del dispositivo', map: 'Punto marcado en el mapa', keyboard: 'Punto marcado en el mapa',
  search: 'Dirección buscada', typed: 'Coordenadas escritas' };

/** F07.2 (FR-001): «firma» de lo enviado; mientras el formulario no cambie, no se reenvía. */
const proposalSignature = ({ address, city, point, source, evidence }) => point ? JSON.stringify([address.trim(), city.trim().toLowerCase(),
  point.latitude.toFixed(6), point.longitude.toFixed(6), source, evidence.trim()]) : '';

/** Presentation visibility follows F01 capabilities; every write is reauthorized by F07/RLS. */
export function LocationAdmin({ pharmacyId, delegationCodes = [], client = createLocationAdminClient(), statusClient = defaultStatusClient,
  suggestionClient = defaultSuggestionClient }) {
  const canPropose = delegationCodes.includes('GEO_LOCATION_PROPOSE');
  const canReview = delegationCodes.includes('GEO_LOCATION_REVIEW');
  const [status, setStatus] = useState('');
  const [statusKind, setStatusKind] = useState('status');
  const [proposalId, setProposalId] = useState('');
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [origin, setOrigin] = useState(null);
  const [focus, setFocus] = useState(null);
  const [approximate, setApproximate] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [view, setView] = useState(null);
  const [evidence, setEvidence] = useState('');
  const [sentSignature, setSentSignature] = useState('');
  const [limitNotice, setLimitNotice] = useState('');
  const sending = useRef(false);
  const reverseTurn = useRef(0);
  const point = latitude !== '' && longitude !== '' && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    ? { latitude: Number(latitude), longitude: Number(longitude) } : null;
  const outside = point && !insidePeru(point.latitude, point.longitude);
  const loadStatus = useCallback(() => {
    if (!pharmacyId || !canPropose) { setView(null); return; }
    statusClient.status(pharmacyId).then(setView).catch(() => setView(null));
  }, [pharmacyId, canPropose, statusClient]);
  useEffect(() => {
    setProposalId(''); setStatus(''); setStatusKind('status'); setAddress(''); setCity(''); setLatitude(''); setLongitude('');
    setOrigin(null); setFocus(null); setApproximate(false); setSearchMessage(''); setEvidence(''); setSentSignature('');
    setLimitNotice(''); loadStatus();
  }, [pharmacyId, loadStatus]);
  if (!pharmacyId || (!canPropose && !canReview)) return null;

  function setPoint(next, from) {
    setLatitude(String(Number(next.latitude.toFixed(6)))); setLongitude(String(Number(next.longitude.toFixed(6)))); setOrigin(from);
  }
  async function pickOnMap(next, from) { // clic o arrastre: completa calle y ciudad sin número (FR-014)
    setPoint(next, from); setApproximate(false);
    if (from !== 'map' || !insidePeru(next.latitude, next.longitude)) return;
    const turn = ++reverseTurn.current;
    try {
      const found = await suggestionClient.reverse(pharmacyId, { latitud: Number(next.latitude.toFixed(6)), longitud: Number(next.longitude.toFixed(6)) });
      if (turn !== reverseTurn.current || !found) return; // sin resultado: se deja todo como estaba
      if (found.calle) setAddress(found.calle);
      if (found.ciudad) setCity(found.ciudad);
      if (found.calle || found.ciudad) setApproximate(true);
    } catch { /* sin servicio: el dueño escribe la dirección; no se muestra error */ }
  }
  function changeCity(value) { // respaldo interno: centra el mapa sin servicio externo (FR-015)
    setCity(value);
    const place = findPeruPlace(value);
    if (place) setFocus({ latitude: place.latitude, longitude: place.longitude, zoom: 14 });
  }
  async function searchAddress() { // «Buscar en el mapa» (FR-013): solo al pulsar, nunca letra por letra
    setSearching(true); setSearchMessage('');
    // F07.2 (D-02 A): con la ciudad en la lista interna, la búsqueda se limita a su zona (~30 km).
    const center = findCityCenter(city);
    setLimitNotice(center ? '' : `No pudimos limitar la búsqueda a «${city.trim()}»: no está en nuestra lista de ciudades.`);
    try {
      const found = await suggestionClient.search(pharmacyId, { direccion: address.trim(), ciudad: city.trim(),
        ...(center ? { centro: { latitud: center.latitude, longitud: center.longitude } } : {}) });
      if (!found) {
        setSearchMessage(center ? `No encontramos esa dirección en ${center.name}. Revisa cómo está escrita o marca el punto tocando el mapa.`
          : 'No encontramos esa dirección. Revisa cómo está escrita o marca el punto tocando el mapa.');
        return;
      }
      setPoint({ latitude: found.latitud, longitude: found.longitud }, 'search'); setApproximate(false);
      setFocus({ latitude: found.latitud, longitude: found.longitud, zoom: 17 });
      setSearchMessage('Dirección encontrada. Revisa el marcador y ajústalo si hace falta.');
    } catch (error) {
      setSearchMessage(error?.status === 503 ? 'La búsqueda de direcciones no está disponible ahora. Elige la ciudad y marca el punto en el mapa.'
        : error?.status === 429 ? 'Espera un momento e inténtalo de nuevo.' : 'No se pudo buscar la dirección. Marca el punto en el mapa.');
    } finally { setSearching(false); }
  }
  async function perform(action) {
    setBusy(true); setStatus('');
    try {
      const result = await action(); setProposalId(result.id); setStatusKind('status');
      if (result.estado === 'PENDIENTE' && action.signature) setSentSignature(action.signature);
      setStatus(result.estado === 'PENDIENTE'
        ? 'Propuesta enviada. Queda «En revisión» hasta que FarmaFind la verifique; la ubicación publicada no cambia mientras tanto.'
        : `Revisión registrada: ${result.estado}.`);
      loadStatus();
      return result;
    } catch (error) { setStatusKind('alert'); setStatus(error.message); return null; } finally { setBusy(false); }
  }
  const source = origin ? SOURCE_LABEL[origin] : null;
  const signature = proposalSignature({ address, city, point, source, evidence });
  const alreadySent = sentSignature !== '' && sentSignature === signature;
  const warning = distanceWarning(city, point);
  const canSearch = address.trim().length >= 3 && city.trim().length >= 2 && !searching;
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
    {canPropose && <form className="surface-card stacked-form" onSubmit={event => {
      event.preventDefault(); if (outside || !point || !source || alreadySent || sending.current) return;
      sending.current = true; // F07.2 (FR-001): un segundo clic en el mismo instante no vuelve a enviar
      const reference = evidence.trim();
      const action = () => client.propose(pharmacyId, {
        direccionPublicable: address.trim(), ciudad: city.trim(), latitud: point.latitude, longitud: point.longitude, fuente: source,
        ...(reference ? { evidenciaReferencia: reference } : {}),
      });
      action.signature = signature;
      void perform(action).finally(() => { sending.current = false; });
    }}>
      <h3>Proponer dirección y ubicación</h3>
      <p className="field-hint">Escribe la dirección y la ciudad, búscala en el mapa o marca el punto. FarmaFind lo revisará antes de publicarlo.</p>
      <div className="form-field">
        <label htmlFor="loc-city">Ciudad o distrito</label>
        <input id="loc-city" name="ciudad" required minLength={2} maxLength={120} value={city} autoComplete="off"
          placeholder="Ej.: Ayacucho" onChange={event => changeCity(event.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="loc-address">Dirección pública</label>
        <div className="input-with-action">
          <input id="loc-address" name="direccionPublicable" required maxLength={240} value={address} autoComplete="off"
            placeholder="Ej.: Jr. 28 de Julio 145" onChange={event => { setAddress(event.target.value); setApproximate(false); }} />
          <button type="button" onClick={() => void searchAddress()} disabled={!canSearch}>{searching ? 'Buscando…' : 'Buscar en el mapa'}</button>
        </div>
        {approximate && <p className="field-warning" role="status">Ubicación aproximada: completa el número.</p>}
        {searchMessage && <p role="status">{searchMessage}</p>}
        {limitNotice && <p className="field-hint" role="status">{limitNotice}</p>}
        <p className="field-hint">La búsqueda usa datos de © OpenStreetMap (Nominatim) a través de FarmaFind; solo envía la dirección y la ciudad escritas.</p>
      </div>
      <PointPicker value={point} focus={focus} onChange={(next, from) => void pickOnMap(next, from)} />
      {outside && <p role="alert">Ese punto está fuera del Perú. Revisa las coordenadas.</p>}
      {source && <p className="field-hint">Fuente: {source}</p>}
      <details className="advanced-options">
        <summary>Opciones avanzadas: coordenadas</summary>
        <div className="form-field">
          <label htmlFor="loc-lat">Latitud</label>
          <input id="loc-lat" name="latitud" type="number" step="any" min={PERU_BOUNDS.minLatitude} max={PERU_BOUNDS.maxLatitude}
            value={latitude} onChange={event => { setLatitude(event.target.value); setOrigin('typed'); }} />
        </div>
        <div className="form-field">
          <label htmlFor="loc-lng">Longitud</label>
          <input id="loc-lng" name="longitud" type="number" step="any" min={PERU_BOUNDS.minLongitude} max={PERU_BOUNDS.maxLongitude}
            value={longitude} onChange={event => { setLongitude(event.target.value); setOrigin('typed'); }} />
        </div>
      </details>
      <div className="form-field">
        <label htmlFor="loc-evidence">Referencia para encontrar la farmacia (opcional)</label>
        <input id="loc-evidence" name="evidenciaReferencia" maxLength={240} placeholder="Ej.: frente a la Plaza Mayor"
          value={evidence} onChange={event => setEvidence(event.target.value)} />
        <p className="field-hint">No escribas datos personales, documentos ni teléfonos.</p>
      </div>
      <label className="check-field"><input name="confirmaDireccion" type="checkbox" required /> Confirmo que la dirección pública y el punto elegido son correctos</label>
      {!point && <p className="field-hint">Falta elegir el punto: búscalo, márcalo en el mapa o usa tu ubicación.</p>}
      {warning && <p className="field-warning distance-warning" role="status">{distanceMessage(warning)}</p>}
      {alreadySent && <p className="field-hint" role="status">Propuesta enviada; cambia algún dato para enviar otra.</p>}
      <button type="submit" disabled={busy || outside || !point || alreadySent}>Enviar propuesta</button>
    </form>}
    {canReview && <form className="surface-card stacked-form" onSubmit={event => {
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
