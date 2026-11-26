import React, { useCallback, useEffect, useState } from 'react';
import { createPlatformLocationClient } from './my-pharmacy-clients.js';

const defaultClient = createPlatformLocationClient();

/**
 * F071-FR-005: el administrador de plataforma revisa ubicaciones con solo datos públicos.
 * El servidor decide qué ve (nunca su propia farmacia) y rechaza autoaprobaciones.
 */
export function LocationReview({ client = defaultClient }) {
  const [state, setState] = useState('loading');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    client.list().then(list => { setItems(list); setState('ready'); })
      .catch(error => setState(error?.status === 403 ? 'denied' : error?.status === 401 ? 'anonymous' : 'error'));
  }, [client]);
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
  return <main className="page-stack location-review">
    <h1>Revisar ubicaciones</h1>
    <p className="notice">Solo ves datos públicos de ubicación. No puedes revisar farmacias de las que formas parte.</p>
    {state === 'loading' && <p role="status">Cargando propuestas…</p>}
    {state === 'anonymous' && <p role="status">Inicia sesión para revisar ubicaciones. <a href="/identity">Entrar</a></p>}
    {state === 'denied' && <p role="alert">No tienes permiso para revisar ubicaciones.</p>}
    {state === 'error' && <p role="alert">No se pudieron cargar las propuestas.</p>}
    {message && <p role="status">{message}</p>}
    {state === 'ready' && (items.length === 0 ? <p>No hay ubicaciones pendientes de revisión.</p>
      : <ul className="offer-grid">{items.map(item => <li key={item.propuestaId} className="surface-card">
        <h2>{item.farmaciaNombre}</h2>
        <p>{item.direccionPublicable}, {item.ciudad}</p>
        <p>Coordenadas: {item.latitud.toFixed(6)}, {item.longitud.toFixed(6)}</p>
        <p>Fuente: {item.fuente}{item.evidenciaReferencia ? ` · Evidencia: ${item.evidenciaReferencia}` : ''}</p>
        <p>Enviada el {new Date(item.propuestaAt).toLocaleString('es-PE')}</p>
        <form onSubmit={event => { event.preventDefault(); void decide(item, event.currentTarget); }}>
          <label>Decisión <select name="decision" defaultValue="APROBAR">
            <option value="APROBAR">Aprobar y publicar</option><option value="RECHAZAR">Rechazar</option></select></label>
          <label><input type="checkbox" name="evidencia" /> Comprobé la dirección y el punto</label>
          <label>Motivo <input name="motivo" required maxLength={500} /></label>
          <button type="submit" disabled={busy}>Registrar decisión</button>
        </form>
      </li>)}</ul>)}
  </main>;
}
