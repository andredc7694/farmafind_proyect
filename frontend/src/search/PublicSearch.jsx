import React, { useState } from 'react';
import { createPublicSearchClient } from './search-client.js';
import { EmptyState } from '../design/Primitives.jsx';

export function PublicSearch({ client = createPublicSearchClient() }) {
  const [query, setQuery] = useState('');
  const [minimum, setMinimum] = useState('');
  const [maximum, setMaximum] = useState('');
  const [order, setOrder] = useState('relevancia');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState(null);
  const [selectedOffers, setSelectedOffers] = useState([]);

  async function runSearch(page = 1) {
    setStatus('loading'); setMessage('');
    try {
      const data = await client.search({ q: query, precioMinCentavos: minimum === '' ? '' : Math.round(Number(minimum) * 100),
        precioMaxCentavos: maximum === '' ? '' : Math.round(Number(maximum) * 100), orden: order,
        latitud: location?.latitude, longitud: location?.longitude, pagina: page });
      setResult(data); setSelectedOffers([]); setStatus('ready');
    } catch (error) { setResult(null); setMessage(error.message); setStatus('error'); }
  }

  function submit(event) { event.preventDefault(); void runSearch(1); }

  return <main className="bootstrap search" aria-labelledby="search-title">
    <p className="eyebrow">FarmaFind</p><h1 id="search-title">Buscar medicamentos</h1>
    <p>Compara información referencial publicada por farmacias activas.</p>
    <form onSubmit={submit} className="search-form">
      <label htmlFor="public-query">Nombre comercial o principio activo</label>
      <input id="public-query" required minLength="2" maxLength="120" value={query}
        onChange={event => setQuery(event.target.value)} />
      <div className="search-filters"><label>Precio mínimo (S/)<input type="number" min="0" step="0.01" value={minimum}
        onChange={event => setMinimum(event.target.value)} /></label>
      <label>Precio máximo (S/)<input type="number" min="0" step="0.01" value={maximum}
        onChange={event => setMaximum(event.target.value)} /></label>
      <label>Orden<select value={order} onChange={event => setOrder(event.target.value)}>
        <option value="relevancia">Relevancia</option><option value="precio_asc">Menor precio</option>
        <option value="precio_desc">Mayor precio</option><option value="disponibilidad">Disponibilidad</option>
        <option value="cercania" disabled={!location}>Cercanía</option>
      </select></label></div>
      <button type="button" onClick={() => {
        if (!navigator.geolocation) { setMessage('La ubicación no está disponible; puedes buscar sin ella.'); return; }
        navigator.geolocation.getCurrentPosition(position => {
          setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setMessage('Ubicación temporal lista para ordenar.');
        }, () => setMessage('No se pudo obtener la ubicación; puedes buscar sin ella.'));
      }}>Usar mi ubicación</button>
      <button type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Buscando…' : 'Buscar'}</button>
    </form>
    {message && <p role="alert">{message}</p>}
    {result && <section aria-live="polite"><p className="notice">{result.aviso}</p>
      {result.ofertas.length === 0 ? <EmptyState title="Sin ofertas publicadas">No encontramos ofertas publicadas para esta consulta. Prueba con otro nombre o revisa los filtros.</EmptyState> :
        <ul className="offer-grid">{result.ofertas.map((offer, index) => <li className="offer" key={`${offer.medicamento.id}-${offer.farmacia.id}-${index}`}>
          <label className="compare-select"><input type="checkbox" checked={selectedOffers.includes(index)} disabled={!selectedOffers.includes(index) && selectedOffers.length >= 3} onChange={() => setSelectedOffers(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index])} /> Comparar esta oferta</label>
          <h2>{offer.medicamento.nombreComercial}</h2><p>{offer.medicamento.principioActivo} · {offer.medicamento.concentracion}</p>
          <p>{offer.medicamento.presentacion}</p><h3>{offer.farmacia.nombre}</h3><p>{offer.farmacia.direccion}</p>
          <strong>S/ {(offer.precioReferencialCentavos / 100).toFixed(2)}</strong>
          <p><a href={`/reservations?pharmacyId=${encodeURIComponent(offer.farmacia.id)}&medicationId=${encodeURIComponent(offer.medicamento.id)}`}>Solicitar reserva</a></p>
          <p>Disponible · revisado {new Date(offer.ultimaRevision).toLocaleString('es-PE')}</p>
          {offer.distanciaKm !== null && <p>A {offer.distanciaKm.toFixed(2)} km aproximadamente</p>}
        </li>)}</ul>}
      {selectedOffers.length > 1 && <section aria-label="Comparación de ofertas" className="comparison-panel"><h2>Comparación de ofertas</h2><p>Precios y disponibilidad referenciales publicados; confirma los datos con la farmacia.</p><div className="comparison-list">{selectedOffers.map(index => { const offer = result.ofertas[index]; return <article className="surface-card" key={`${offer.medicamento.id}-${offer.farmacia.id}-${index}`}><h3>{offer.medicamento.nombreComercial}</h3><p>{offer.farmacia.nombre}</p><strong>S/ {(offer.precioReferencialCentavos / 100).toFixed(2)}</strong><p>Revisado {new Date(offer.ultimaRevision).toLocaleString('es-PE')}</p></article>; })}</div></section>}
      {result.paginacion && <nav className="result-pagination" aria-label="Páginas de resultados"><button type="button" disabled={status === 'loading' || result.paginacion.pagina <= 1} onClick={() => void runSearch(result.paginacion.pagina - 1)}>Anterior</button><span>Página {result.paginacion.pagina} de {Math.max(1, result.paginacion.totalPaginas)}</span><button type="button" disabled={status === 'loading' || result.paginacion.pagina >= result.paginacion.totalPaginas} onClick={() => void runSearch(result.paginacion.pagina + 1)}>Siguiente</button></nav>}
    </section>}
  </main>;
}
