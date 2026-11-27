import React, { useMemo, useRef, useState } from 'react';
import { createPublicSearchClient } from './search-client.js';
import { EmptyState } from '../design/Primitives.jsx';
import { SuggestBox } from './SuggestBox.jsx';
import { comparableFor, priceGapCents } from './comparable.js';
import { usePublicOpeningHours } from '../geolocation/OpeningHours.jsx';
import { forgetFilters, parseFilters, readRememberedFilters, rememberFilters, serializeFilters } from './filters-state.js';
import { forgetCity, readRememberedCity, rememberCity } from './search-location.js';
import { OfferCard, money } from './OfferCard.jsx';
import { ResultsMap } from './ResultsMap.jsx';
import { WhereDialog } from './WhereDialog.jsx';

const ORDER_LABELS = { precio_asc: 'Más barato', cercania: 'Más cercano', relevancia: 'Relevancia', precio_desc: 'Mayor precio', disponibilidad: 'Disponibilidad' };

/** Orden inicial: lo de la URL o lo recordado; si no hay nada, por precio (o cercanía si ya hay ciudad recordada, D-02). */
function initialState() {
  if (typeof window === 'undefined') return { query: '', minimum: '', maximum: '', order: 'precio_asc', remembered: false, location: null, rememberedCity: false };
  const fromUrl = parseFilters(window.location.search);
  const remembered = readRememberedFilters();
  const location = readRememberedCity();
  const explicitOrder = new URLSearchParams(window.location.search).has('orden') ? fromUrl.order : remembered && remembered.order !== 'relevancia' ? remembered.order : null;
  const hasUrl = fromUrl.minimum !== '' || fromUrl.maximum !== '';
  return { ...fromUrl, ...(!hasUrl && remembered ? { minimum: remembered.minimum, maximum: remembered.maximum } : {}),
    order: explicitOrder ?? (location ? 'cercania' : 'precio_asc'), remembered: Boolean(remembered), location, rememberedCity: Boolean(location) };
}

/**
 * F03.1 (spec 022): búsqueda simplificada. Un buscador, la ubicación en una línea («¿Dónde buscas?»),
 * orden con botones rápidos, «Filtros» plegable, interruptor Lista | Mapa conectado y tarjetas claras.
 */
export function PublicSearch({ client = createPublicSearchClient(), loadLeaflet, getPosition, now }) {
  const start = useMemo(initialState, []);
  const [query, setQuery] = useState(start.query);
  const [minimum, setMinimum] = useState(start.minimum);
  const [maximum, setMaximum] = useState(start.maximum);
  const [order, setOrder] = useState(start.order);
  const [remember, setRemember] = useState(start.remembered);
  const [location, setLocation] = useState(start.location);
  const [cityRemembered, setCityRemembered] = useState(start.rememberedCity);
  const [dialog, setDialog] = useState(null); // null | { thenOrder?: 'cercania' }
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [view, setView] = useState('lista');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedOffers, setSelectedOffers] = useState([]);
  const hours = usePublicOpeningHours(result?.ofertas?.map(offer => offer.farmacia.id) ?? []);
  const opener = useRef(null);

  async function runSearch(page = 1, overrides = {}) {
    const current = { query, minimum, maximum, order, location, ...overrides };
    if (!current.query.trim()) { setMessage('Escribe el nombre comercial o el principio activo.'); return; }
    setStatus('loading'); setMessage('');
    try {
      const data = await client.search({ q: current.query, precioMinCentavos: current.minimum === '' ? '' : Math.round(Number(current.minimum) * 100),
        precioMaxCentavos: current.maximum === '' ? '' : Math.round(Number(current.maximum) * 100), orden: current.order,
        latitud: current.location?.latitude, longitud: current.location?.longitude, pagina: page });
      setResult(data); setSelectedOffers([]); setSelectedId(null); setStatus('ready');
      const filters = { query: current.query, minimum: current.minimum, maximum: current.maximum, order: current.order };
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        const text = serializeFilters(filters); window.history.replaceState(null, '', text ? `${window.location.pathname}?${text}` : window.location.pathname);
      }
      if (remember) rememberFilters(filters);
    } catch (error) { setResult(null); setMessage(error.message); setStatus('error'); }
  }

  function openDialog(thenOrder) { opener.current = typeof document !== 'undefined' ? document.activeElement : null; setDialog({ thenOrder }); }
  function closeDialog() { setDialog(null); opener.current?.focus?.(); }
  function chooseLocation(next, { remember: keepCity }) {
    const nextOrder = dialog?.thenOrder ?? (order === 'precio_asc' && !location ? 'cercania' : order);
    setLocation(next); setOrder(nextOrder); closeDialog();
    if (next.source === 'city' && keepCity) { rememberCity(next.label); setCityRemembered(true); }
    else if (next.source === 'city' && !keepCity && cityRemembered) { forgetCity(); setCityRemembered(false); }
    if (result || query.trim()) void runSearch(1, { location: next, order: nextOrder });
  }
  function clearLocation() {
    const nextOrder = order === 'cercania' ? 'precio_asc' : order;
    setLocation(null); setOrder(nextOrder); forgetCity(); setCityRemembered(false); setMessage('Ubicación quitada. No se guardó en ningún lugar.');
    if (result) void runSearch(1, { location: null, order: nextOrder });
  }
  function chooseOrder(value) {
    if (value === 'cercania' && !location) { openDialog('cercania'); return; }
    setOrder(value);
    if (result) void runSearch(1, { order: value });
  }
  function toggleRemember(checked) { setRemember(checked); if (!checked) forgetFilters(); }
  /** «Ver en el mapa» desde la lista: abre el mapa (en celular reemplaza a la lista) y resalta la farmacia. */
  function selectPharmacy(id) { setSelectedId(id); setView('mapa'); }
  function selectFromMap(id) {
    setSelectedId(id);
    if (typeof document !== 'undefined') document.querySelector(`[data-pharmacy="${CSS.escape ? CSS.escape(id) : id}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }

  const sortedNearest = order === 'cercania';
  return <main className="bootstrap search search-simple" aria-labelledby="search-title">
    <p className="eyebrow">FarmaFind</p><h1 id="search-title">Buscar medicamentos</h1>
    <p>Compara información referencial publicada por farmacias activas.</p>
    <form onSubmit={event => { event.preventDefault(); void runSearch(1); }} className="search-form search-hero">
      <div className="search-hero-row">
        <SuggestBox id="public-query" label="Nombre comercial o principio activo" value={query} onChange={setQuery} required
          suggest={client.suggest ? text => client.suggest(text) : undefined} />
        <button type="submit" className="search-submit" disabled={status === 'loading'}>{status === 'loading' ? 'Buscando…' : 'Buscar'}</button>
      </div>
      <p className="search-location" aria-live="polite">
        {location
          ? <>Cerca de: <strong>{location.label}</strong> (aproximado) · <button type="button" className="link-button" onClick={() => openDialog()}>Cambiar</button>
            {' · '}<button type="button" className="link-button" onClick={clearLocation}>Quitar</button></>
          : <>Sin ubicación · <button type="button" className="link-button" onClick={() => openDialog()}>Elegir</button></>}
      </p>
      <div className="search-toolbar">
        <div role="group" aria-label="Ordenar resultados" className="quick-order">
          {['precio_asc', 'cercania'].map(value => <button type="button" key={value} aria-pressed={order === value}
            onClick={() => chooseOrder(value)}>{ORDER_LABELS[value]}</button>)}
        </div>
        <details className="search-filter-panel">
          <summary>Filtros</summary>
          <div className="search-filters">
            <label>Precio mínimo (S/)<input type="number" min="0" step="0.01" value={minimum} onChange={event => setMinimum(event.target.value)} /></label>
            <label>Precio máximo (S/)<input type="number" min="0" step="0.01" value={maximum} onChange={event => setMaximum(event.target.value)} /></label>
            <label>Otros órdenes<select value={order} onChange={event => chooseOrder(event.target.value)}>
              {Object.entries(ORDER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}{value === 'cercania' && !location ? ' (elige dónde buscas)' : ''}</option>)}
            </select></label>
          </div>
          <label className="remember-filters"><input type="checkbox" checked={remember} onChange={event => toggleRemember(event.target.checked)} /> Recordar estos filtros de precio y orden en este navegador (no se guarda la búsqueda ni la ubicación)</label>
          <button type="submit" disabled={status === 'loading'}>Aplicar filtros</button>
        </details>
      </div>
    </form>
    {message && <p role="alert">{message}</p>}
    {dialog && <WhereDialog onChoose={chooseLocation} onCancel={closeDialog} rememberedCity={cityRemembered}
      {...(getPosition ? { getPosition } : {})} {...(loadLeaflet ? { loadLeaflet } : {})} />}
    {result && <section aria-live="polite" className="search-results"><p className="notice">{result.aviso}</p>
      <div className="results-head">
        <p>{result.paginacion?.total ?? result.ofertas.length} resultado(s) · {sortedNearest ? 'más cercanos primero' : `orden: ${ORDER_LABELS[order]?.toLowerCase() ?? order}`}</p>
        <div className="search-view-toggle" role="group" aria-label="Vista de resultados">
          <button type="button" aria-pressed={view === 'lista'} onClick={() => setView('lista')}>Lista</button>
          <button type="button" aria-pressed={view === 'mapa'} onClick={() => setView('mapa')}>Mapa</button>
        </div>
      </div>
      {result.ofertas.length === 0 ? <EmptyState title="Sin ofertas publicadas">No encontramos ofertas publicadas para esta consulta. Prueba con otro nombre o revisa los filtros.</EmptyState> :
        <div className={`results-layout view-${view}`}>
          <ul className="offer-grid results-list">{result.ofertas.map((offer, index) => <OfferCard key={`${offer.medicamento.id}-${offer.farmacia.id}-${index}`}
            offer={offer} days={hours[offer.farmacia.id]} now={now} comparables={comparableFor(offer, result.ofertas)} gapCents={priceGapCents(offer, result.ofertas)}
            compared={selectedOffers.includes(index)} compareDisabled={!selectedOffers.includes(index) && selectedOffers.length >= 3}
            onCompare={() => setSelectedOffers(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index])}
            selected={selectedId === offer.farmacia.id} onSelect={selectPharmacy} showMapButton />)}</ul>
          {view === 'mapa' && <div className="results-map-column">
            <ResultsMap offers={result.ofertas} hours={hours} selectedId={selectedId} onSelect={selectFromMap} now={now}
              userPoint={location} {...(loadLeaflet ? { loadLeaflet } : {})} />
          </div>}
        </div>}
      {selectedOffers.length > 1 && <section aria-label="Comparación de ofertas" className="comparison-panel"><h2>Comparación de ofertas</h2><p>Precios y disponibilidad referenciales publicados; confirma los datos con la farmacia.</p><div className="comparison-list">{selectedOffers.map(index => { const offer = result.ofertas[index]; return <article className="surface-card" key={`${offer.medicamento.id}-${offer.farmacia.id}-${index}`}><h3>{offer.medicamento.nombreComercial}</h3><p>{offer.farmacia.nombre}</p><strong>{money(offer.precioReferencialCentavos)}</strong><p>Revisado {new Date(offer.ultimaRevision).toLocaleString('es-PE')}</p></article>; })}</div></section>}
      {result.paginacion && <nav className="result-pagination" aria-label="Páginas de resultados"><button type="button" disabled={status === 'loading' || result.paginacion.pagina <= 1} onClick={() => void runSearch(result.paginacion.pagina - 1)}>Anterior</button><span>Página {result.paginacion.pagina} de {Math.max(1, result.paginacion.totalPaginas)}</span><button type="button" disabled={status === 'loading' || result.paginacion.pagina >= result.paginacion.totalPaginas} onClick={() => void runSearch(result.paginacion.pagina + 1)}>Siguiente</button></nav>}
    </section>}
  </main>;
}
