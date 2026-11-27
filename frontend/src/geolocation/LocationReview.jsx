import React, { useCallback, useEffect, useState } from 'react';
import { createPlatformLocationClient } from './my-pharmacy-clients.js';

const defaultClient = createPlatformLocationClient();
const FILTERS = [['PENDIENTE', 'Pendientes'], ['APROBADA', 'Aprobadas'], ['RECHAZADA', 'Rechazadas']];
const when = value => (value ? new Date(value).toLocaleString('es-PE') : '—');
const coords = (lat, lng) => `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;

/** Formulario de decisión ordenado (F071-FR-018): etiquetas encima y casilla en su propia línea. */
function DecisionForm({ item, busy, onDecide }) {
  const id = item.propuestaId;
  return <form className="stacked-form decision-form" onSubmit={event => { event.preventDefault(); onDecide(item, event.currentTarget); }}>
    <div className="form-field">
      <label htmlFor={`decision-${id}`}>Decisión</label>
      <select id={`decision-${id}`} name="decision" defaultValue="APROBAR">
        <option value="APROBAR">Aprobar y publicar</option><option value="RECHAZAR">Rechazar</option></select>
    </div>
    <label className="check-field" htmlFor={`evidence-${id}`}>
      <input id={`evidence-${id}`} type="checkbox" name="evidencia" /> Comprobé la dirección y el punto</label>
    <div className="form-field">
      <label htmlFor={`reason-${id}`}>Motivo</label>
      <input id={`reason-${id}`} name="motivo" required maxLength={500} placeholder="Ej.: la dirección coincide con la fachada" />
    </div>
    <button type="submit" disabled={busy}>Registrar decisión</button>
  </form>;
}

/**
 * F071-FR-005/017: el administrador de plataforma revisa ubicaciones y consulta el historial con solo
 * datos de ubicación. El servidor decide qué ve (nunca su propia farmacia) y rechaza autoaprobaciones.
 */
export function LocationReview({ client = defaultClient }) {
  const [filter, setFilter] = useState('PENDIENTE');
  const [page, setPage] = useState(1);
  const [state, setState] = useState('loading');
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const fail = error => setState(error?.status === 403 ? 'denied' : error?.status === 401 ? 'anonymous' : 'error');
  const load = useCallback(() => {
    setState('loading');
    if (filter === 'PENDIENTE') client.list().then(list => { setItems(list); setState('ready'); }).catch(fail);
    else client.history(filter, page).then(value => { setHistory(value); setState('ready'); }).catch(fail);
  }, [client, filter, page]);
  useEffect(() => { load(); }, [load]);
  async function decide(item, form) {
    const data = new FormData(form);
    const decision = String(data.get('decision'));
    setBusy(true); setMessage('');
    try {
      await client.decide(item.propuestaId, { decision, version: item.version,
        evidenciaConfirmada: data.get('evidencia') === 'on', motivo: String(data.get('motivo')).trim() });
      setMessage(decision === 'APROBAR' ? `Ubicación de ${item.farmaciaNombre} verificada y publicada.` : `Propuesta de ${item.farmaciaNombre} rechazada.`);
      load();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  const pages = history ? Math.max(1, Math.ceil(history.total / history.porPagina)) : 1;
  return <main className="page-stack location-review">
    <h1>Revisar ubicaciones</h1>
    <p className="notice">Solo ves datos públicos de ubicación. No puedes revisar farmacias de las que formas parte.</p>
    <div role="group" aria-label="Filtrar propuestas" className="review-filter">
      {FILTERS.map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value}
        onClick={() => { setFilter(value); setPage(1); setMessage(''); }}>{label}</button>)}
    </div>
    {state === 'loading' && <p role="status">Cargando…</p>}
    {state === 'anonymous' && <p role="status">Inicia sesión para revisar ubicaciones. <a href="/identity">Entrar</a></p>}
    {state === 'denied' && <p role="alert">No tienes permiso para revisar ubicaciones.</p>}
    {state === 'error' && <p role="alert">No se pudo cargar la información.</p>}
    {message && <p role="status">{message}</p>}
    {state === 'ready' && filter === 'PENDIENTE' && (items.length === 0 ? <p>No hay ubicaciones pendientes de revisión.</p>
      : <ul className="offer-grid">{items.map(item => <li key={item.propuestaId} className="surface-card">
        <h2>{item.farmaciaNombre}</h2>
        <p>{item.direccionPublicable}, {item.ciudad}</p>
        <p>Coordenadas: {coords(item.latitud, item.longitud)}</p>
        <p>Fuente: {item.fuente}{item.evidenciaReferencia ? ` · Referencia: ${item.evidenciaReferencia}` : ''}</p>
        <p>Enviada el {when(item.propuestaAt)}</p>
        <DecisionForm item={item} busy={busy} onDecide={(target, form) => void decide(target, form)} />
      </li>)}</ul>)}
    {state === 'ready' && filter !== 'PENDIENTE' && history && (history.filas.length === 0
      ? <p>No hay propuestas {filter === 'APROBADA' ? 'aprobadas' : 'rechazadas'}.</p>
      : <>
        <ul className="offer-grid history-list">{history.filas.map(row => <li key={row.propuestaId} className="surface-card">
          <h2>{row.farmaciaNombre}</h2>
          <dl className="history-facts">
            <dt>Dirección</dt><dd>{row.direccion}, {row.ciudad}</dd>
            <dt>Coordenadas</dt><dd>{coords(row.latitud, row.longitud)}</dd>
            <dt>Decisión</dt><dd>{row.decision === 'APROBADA' ? 'Aprobada' : 'Rechazada'}</dd>
            <dt>Motivo</dt><dd>{row.motivo ?? '—'}</dd>
            <dt>Enviada</dt><dd>{when(row.enviadaAt)}</dd>
            <dt>Decidida</dt><dd>{when(row.decididaAt)}</dd>
            <dt>Decidió</dt><dd>{row.decididoPor ?? '—'}</dd>
          </dl>
        </li>)}</ul>
        <nav aria-label="Páginas del historial" className="result-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</button>
          <span>Página {page} de {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Siguiente</button>
        </nav>
      </>)}
  </main>;
}
