import React, { useMemo, useState } from 'react';
import { createPublicSearchClient } from './search-client.js';
import { EmptyState } from '../design/Primitives.jsx';
import { SuggestBox } from './SuggestBox.jsx';
import { PointPicker } from '../geolocation/PointPicker.jsx';
import { comparableFor, priceGapCents } from './comparable.js';
import { forgetFilters, parseFilters, readRememberedFilters, rememberFilters, serializeFilters } from './filters-state.js';

const money = cents => `S/ ${(cents / 100).toFixed(2)}`;

function initialFilters() {
  if (typeof window === 'undefined') return { query: '', minimum: '', maximum: '', order: 'relevancia', remembered: false };
  const fromUrl = parseFilters(window.location.search);
  const remembered = readRememberedFilters();
  const hasUrl = fromUrl.minimum !== '' || fromUrl.maximum !== '' || fromUrl.order !== 'relevancia';
  return { ...fromUrl, ...(!hasUrl && remembered ? { minimum: remembered.minimum, maximum: remembered.maximum, order: remembered.order } : {}), remembered: Boolean(remembered) };
}

export function PublicSearch({ client = createPublicSearchClient() }) {
  const start = useMemo(initialFilters, []);
  const [query, setQuery] = useState(start.query);
  const [minimum, setMinimum] = useState(start.minimum);
  const [maximum, setMaximum] = useState(start.maximum);
  const [order, setOrder] = useState(start.order);
  const [remember, setRemember] = useState(start.remembered);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState(null);
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [selectedOffers, setSelectedOffers] = useState([]);

  async function runSearch(page = 1) {
    setStatus('loading'); setMessage('');
    const filters = { query, minimum, maximum, order };
    try {
      const data = await client.search({ q: query, precioMinCentavos: minimum === '' ? '' : Math.round(Number(minimum) * 100),
        precioMaxCentavos: maximum === '' ? '' : Math.round(Number(maximum) * 100), orden: order,
        latitud: location?.latitude, longitud: location?.longitude, pagina: page });
      setResult(data); setSelectedOffers([]); setStatus('ready');
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        const text = serializeFilters(filters); window.history.replaceState(null, '', text ? `${window.location.pathname}?${text}` : window.location.pathname);
      }
      if (remember) rememberFilters(filters);
    } catch (error) { setResult(null); setMessage(error.message); setStatus('error'); }
  }

  function submit(event) { event.preventDefault(); void runSearch(1); }
  function useManualLocation() {
    const latitude = Number(manualLatitude); const longitude = Number(manualLongitude);
    if (manualLatitude === '' || manualLongitude === '' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      setMessage('Escribe una latitud entre -90 y 90 y una longitud entre -180 y 180, o busca sin ubicación.'); return;
    }
    setLocation({ latitude, longitude }); setMessage('Ubicación manual lista para ordenar. No se guarda.');
  }
  function toggleRemember(checked) { setRemember(checked); if (!checked) forgetFilters(); }

  return <main className="bootstrap search" aria-labelledby="search-title">
    <p className="eyebrow">FarmaFind</p><h1 id="search-title">Buscar medicamentos</h1>
    <p>Compara información referencial publicada por farmacias activas.</p>
    <form onSubmit={submit} className="search-form">
      <SuggestBox id="public-query" label="Nombre comercial o principio activo" value={query} onChange={setQuery} required
        suggest={client.suggest ? text => client.suggest(text) : undefined} />
      <details className="search-filter-panel" open>
        <summary>Filtros de precio y orden</summary>
        <div className="search-filters"><label>Precio mínimo (S/)<input type="number" min="0" step="0.01" value={minimum}
          onChange={event => setMinimum(event.target.value)} /></label>
        <label>Precio máximo (S/)<input type="number" min="0" step="0.01" value={maximum}
          onChange={event => setMaximum(event.target.value)} /></label>
        <label>Orden<select value={order} onChange={event => setOrder(event.target.value)}>
          <option value="relevancia">Relevancia</option><option value="precio_asc">Menor precio</option>
          <option value="precio_desc">Mayor precio</option><option value="disponibilidad">Disponibilidad</option>
          <option value="cercania" disabled={!location}>Cercanía</option>
        </select></label></div>
        <label className="remember-filters"><input type="checkbox" checked={remember} onChange={event => toggleRemember(event.target.checked)} /> Recordar estos filtros de precio y orden en este navegador (no se guarda la búsqueda ni la ubicación)</label>
      </details>
      <button type="button" onClick={() => {
        if (!navigator.geolocation) { setMessage('La ubicación no está disponible; puedes buscar sin ella.'); return; }
        navigator.geolocation.getCurrentPosition(position => {
          setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setMessage('Ubicación temporal lista para ordenar.');
        }, () => setMessage('No se pudo obtener la ubicación; puedes buscar sin ella.'));
      }}>Usar mi ubicación</button>
      <details className="search-filter-panel">
        <summary>Escribir mi ubicación a mano</summary>
        <PointPicker value={manualLatitude !== '' && manualLongitude !== '' ? { latitude: Number(manualLatitude), longitude: Number(manualLongitude) } : null}
          onChange={point => { setManualLatitude(String(point.latitude)); setManualLongitude(String(point.longitude)); }} />
        <div className="search-filters">
          <label>Latitud<input inputMode="decimal" value={manualLatitude} onChange={event => setManualLatitude(event.target.value)} /></label>
          <label>Longitud<input inputMode="decimal" value={manualLongitude} onChange={event => setManualLongitude(event.target.value)} /></label>
        </div>
        <button type="button" onClick={useManualLocation}>Usar esta ubicación</button>
      </details>
      {location && <p role="status">Ordenarás por cercanía con una ubicación temporal. <button type="button" onClick={() => { setLocation(null); if (order === 'cercania') setOrder('relevancia'); setMessage('Ubicación temporal borrada.'); }}>Borrar ubicación</button></p>}
      <button type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Buscando…' : 'Buscar'}</button>
    </form>
    {message && <p role="alert">{message}</p>}
    {result && <section aria-live="polite"><p className="notice">{result.aviso}</p>
      <div className="search-view-toggle" role="group" aria-label="Vista de resultados">
        <button type="button" aria-pressed="true">Lista</button>
        <a href={`/mapa${result.consulta ? `?q=${encodeURIComponent(result.consulta)}` : ''}`}>Ver farmacias en el mapa</a>
      </div>
      {result.ofertas.length === 0 ? <EmptyState title="Sin ofertas publicadas">No encontramos ofertas publicadas para esta consulta. Prueba con otro nombre o revisa los filtros.</EmptyState> :
        <ul className="offer-grid">{result.ofertas.map((offer, index) => {
          const others = comparableFor(offer, result.ofertas); const gap = priceGapCents(offer, result.ofertas);
          return <li className="offer" key={`${offer.medicamento.id}-${offer.farmacia.id}-${index}`}>
          <label className="compare-select"><input type="checkbox" checked={selectedOffers.includes(index)} disabled={!selectedOffers.includes(index) && selectedOffers.length >= 3} onChange={() => setSelectedOffers(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index])} /> Comparar esta oferta</label>
          <h2>{offer.medicamento.nombreComercial}</h2><p>{offer.medicamento.principioActivo} · {offer.medicamento.concentracion}</p>
          <p>{offer.medicamento.presentacion}</p><h3>{offer.farmacia.nombre}</h3><p>{offer.farmacia.direccion}</p>
          <strong>{money(offer.precioReferencialCentavos)}</strong>
          {others.length > 0 && <p className="comparables">{gap === 0 ? 'Es el precio más bajo de esta página. ' : `${money(gap)} más que el más bajo de esta página. `}
            También en: {others.map(other => `${other.pharmacy} (${money(other.priceCents)})`).join(', ')}.</p>}
          <p><a href={`/reservations?pharmacyId=${encodeURIComponent(offer.farmacia.id)}&medicationId=${encodeURIComponent(offer.medicamento.id)}`}>Solicitar reserva</a></p>
          <p>Disponible · revisado {new Date(offer.ultimaRevision).toLocaleString('es-PE')}</p>
          {offer.distanciaKm !== null && <p>A {offer.distanciaKm.toFixed(2)} km aproximadamente</p>}
        </li>; })}</ul>}
      {selectedOffers.length > 1 && <section aria-label="Comparación de ofertas" className="comparison-panel"><h2>Comparación de ofertas</h2><p>Precios y disponibilidad referenciales publicados; confirma los datos con la farmacia.</p><div className="comparison-list">{selectedOffers.map(index => { const offer = result.ofertas[index]; return <article className="surface-card" key={`${offer.medicamento.id}-${offer.farmacia.id}-${index}`}><h3>{offer.medicamento.nombreComercial}</h3><p>{offer.farmacia.nombre}</p><strong>{money(offer.precioReferencialCentavos)}</strong><p>Revisado {new Date(offer.ultimaRevision).toLocaleString('es-PE')}</p></article>; })}</div></section>}
      {result.paginacion && <nav className="result-pagination" aria-label="Páginas de resultados"><button type="button" disabled={status === 'loading' || result.paginacion.pagina <= 1} onClick={() => void runSearch(result.paginacion.pagina - 1)}>Anterior</button><span>Página {result.paginacion.pagina} de {Math.max(1, result.paginacion.totalPaginas)}</span><button type="button" disabled={status === 'loading' || result.paginacion.pagina >= result.paginacion.totalPaginas} onClick={() => void runSearch(result.paginacion.pagina + 1)}>Siguiente</button></nav>}
    </section>}
  </main>;
}
