import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPoller } from './polling.js';
import { describePreference } from './preference.js';

const stateLabels = { PENDIENTE: 'Pendiente', CONFIRMADA: 'Confirmada', ENTREGADA: 'Entregada', CANCELADA: 'Cancelada', EXPIRADA: 'Expirada' };
const minutesLeft = (iso, nowMs) => Math.max(0, Math.ceil((Date.parse(iso) - nowMs) / 60000));

function QueueItem({ item, nowMs, busy, can, onAction }) {
  const expires = item.expiresAt ?? item.pickupExpiresAt ?? null;
  const overdue = expires !== null && Date.parse(expires) <= nowMs;
  return <li className="surface-card" data-reservation-id={item.id}>
    <strong>{item.state}</strong><span> Cantidad: {item.quantity}</span>
    {item.medication && <span> · {item.medication}</span>}
    {expires && <span> · {item.state === 'PENDIENTE' ? 'responder antes de' : 'vence'} {new Date(expires).toLocaleString('es-PE')}
      {overdue ? ' (vencida; el servidor rechazará la acción y la lista se actualizará sola)' : ` (faltan ${minutesLeft(expires, nowMs)} min)`}</span>}
    {item.pickupPreference && <p>{describePreference(item.pickupPreference)}</p>}
    <div className="reservation-actions">
      {item.state === 'PENDIENTE' && can('reservation.accept') && <>
        <button type="button" disabled={busy} onClick={() => onAction(c => c.confirm, item.id, 'Reserva confirmada.')}>Confirmar</button>
        <button type="button" disabled={busy} onClick={() => onAction(c => c.shortage, item.id, 'Falta física registrada.')}>Falta física</button>
      </>}
      {item.state === 'CONFIRMADA' && can('reservation.deliver') &&
        <button type="button" disabled={busy} onClick={() => onAction(c => c.deliver, item.id, 'Entrega registrada.')}>Entregar</button>}
    </div>
  </li>;
}

function History({ client, pharmacyId }) {
  const [state, setState] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [status, setStatus] = useState('idle');
  const [note, setNote] = useState('');
  const filters = () => ({ estado: state || undefined, desde: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    hasta: to ? new Date(`${to}T23:59:59`).toISOString() : undefined });

  async function load(reset) {
    setStatus('loading'); setNote('');
    try {
      const page = await client.history(pharmacyId, { ...filters(), limite: 25, cursor: reset ? undefined : cursor ?? undefined });
      setItems(current => {
        const known = new Set((reset ? [] : current).map(item => item.id));
        return [...(reset ? [] : current), ...page.items.filter(item => !known.has(item.id))];
      });
      setCursor(page.nextCursor); setStatus('ready');
    } catch { setStatus('error'); }
  }
  async function download() {
    setNote('');
    try {
      const { text, truncated } = await client.exportHistory(pharmacyId, filters());
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'historial-reservas.csv'; link.click(); URL.revokeObjectURL(url);
      setNote(truncated ? 'Se descargaron las primeras 5000 filas; acota las fechas para ver el resto.' : 'Archivo descargado (sin datos personales de los clientes).');
    } catch { setNote('No se pudo descargar el archivo.'); }
  }
  useEffect(() => { void load(true); }, [pharmacyId]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div>
    <form onSubmit={event => { event.preventDefault(); void load(true); }} aria-label="Filtros del historial">
      <label htmlFor="history-state">Estado</label>
      <select id="history-state" value={state} onChange={event => setState(event.target.value)}>
        <option value="">Todos los cerrados</option><option value="ENTREGADA">Entregadas</option><option value="CANCELADA">Canceladas</option><option value="EXPIRADA">Expiradas</option>
      </select>
      <label htmlFor="history-from">Desde</label><input id="history-from" type="date" value={from} onChange={event => setFrom(event.target.value)} />
      <label htmlFor="history-to">Hasta</label><input id="history-to" type="date" value={to} onChange={event => setTo(event.target.value)} />
      <button type="submit" disabled={status === 'loading'}>Buscar</button>
      <button type="button" onClick={() => void download()}>Descargar CSV</button>
    </form>
    {note && <p role="status">{note}</p>}
    {status === 'error' && <p role="alert">No se pudo cargar el historial.</p>}
    {status === 'ready' && items.length === 0 && <p>No hay reservas cerradas con esos filtros.</p>}
    <ul className="reservation-queue">{items.map(item => <li className="surface-card" key={item.id}>
      <strong>{stateLabels[item.state] ?? item.state}</strong><span> · {item.code} · {item.quantity} × {item.medication}</span>
      <span> · creada {new Date(item.createdAt).toLocaleString('es-PE')}</span>
      {item.closeReason && <span> · {item.closeReason}</span>}
      {item.pickupPreference && <p>{describePreference(item.pickupPreference)}</p>}
    </li>)}</ul>
    {cursor && <button type="button" disabled={status === 'loading'} onClick={() => void load(false)}>Cargar más</button>}
  </div>;
}

/** Visibilidad de presentación solamente; F04 y PostgreSQL RLS autorizan cada petición. */
export function PharmacyReservations({ client, pharmacyId, onChanged, capabilities = null, intervalMs = 30000, initialTab = 'queue', showTabs = true, showSettings = true }) {
  const [queue, setQueue] = useState([]);
  const [hours, setHours] = useState(4);
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState('status');
  const [tab, setTab] = useState(initialTab);
  const [stateFilter, setStateFilter] = useState('');
  const [sync, setSync] = useState({ state: 'ok', at: null });
  const [nowMs, setNowMs] = useState(Date.now());
  const pollerRef = useRef(null);
  const filterRef = useRef('');
  const can = capability => capabilities === null || capabilities.includes(capability);
  const canRead = can('reservation.read');
  const hasCenter = typeof client.center === 'function';

  filterRef.current = stateFilter;
  const loadQueue = useCallback(async () => {
    if (hasCenter) return client.center(pharmacyId, { estado: filterRef.current || undefined });
    return { generatedAt: new Date().toISOString(), items: await client.queue(pharmacyId) };
  }, [client, pharmacyId, hasCenter]);

  useEffect(() => {
    if (!canRead) return undefined;
    let active = true;
    setStatus('loading');
    client.settings(pharmacyId).then(settings => { if (active) setHours(settings.pickupWindowHours); }).catch(() => undefined);
    const poller = createPoller({ intervalMs, load: loadQueue,
      onData: snapshot => { if (!active) return; setQueue(snapshot.items); setNowMs(Date.parse(snapshot.generatedAt) || Date.now()); setStatus('ready'); },
      onStatus: value => { if (!active) return; setSync(value); if (value.state === 'offline') setStatus(current => current === 'loading' ? 'denied' : current); } });
    pollerRef.current = poller; poller.start();
    const back = () => poller.refresh();
    window.addEventListener('online', back); document.addEventListener('visibilitychange', back);
    return () => { active = false; poller.stop(); window.removeEventListener('online', back); document.removeEventListener('visibilitychange', back); };
  }, [client, pharmacyId, canRead, loadQueue, intervalMs]);

  useEffect(() => { pollerRef.current?.refresh(); }, [stateFilter]);

  async function action(pick, id, success) {
    setBusy(true); setMessage('');
    try {
      await pick(client)(pharmacyId, id);
      pollerRef.current?.refresh();
      onChanged?.();
      setMessageKind('status'); setMessage(success);
    } catch {
      setMessageKind('alert');
      setMessage('La operación no se completó. Comprueba el estado y tus permisos antes de reintentar.');
    } finally { setBusy(false); }
  }
  async function saveHours(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await client.saveSettings(pharmacyId, Number(hours)); setMessageKind('status'); setMessage('Plazo guardado por la farmacia.'); }
    catch { setMessageKind('alert'); setMessage('La operación no se completó. Comprueba el estado y tus permisos antes de reintentar.'); }
    finally { setBusy(false); }
  }

  if (!canRead || status === 'denied') return <p role="status">La administración de reservas no está autorizada para esta sesión.</p>;
  if (status === 'loading') return <p role="status">Cargando reservas de la farmacia…</p>;
  return <section aria-labelledby="pharmacy-reservations-title">
    <h3 id="pharmacy-reservations-title">Centro de atención</h3>
    {hasCenter && showTabs && <div role="tablist" aria-label="Vistas de reservas">
      <button type="button" role="tab" aria-selected={tab === 'queue'} onClick={() => setTab('queue')}>Cola</button>{' '}
      <button type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>Historial</button>
    </div>}
    {message && <p role={messageKind}>{message}</p>}
    {showSettings && can('reservation.settings') && <form onSubmit={saveHours}>
      <label htmlFor="pickup-hours">Plazo de recogida (1 a 8 horas)</label>
      <input id="pickup-hours" type="number" min="1" max="8" value={hours} onChange={event => setHours(event.target.value)} />
      <button type="submit" disabled={busy}>Guardar plazo</button>
    </form>}
    {tab === 'history' && hasCenter ? <History client={client} pharmacyId={pharmacyId} /> : <>
      {hasCenter && <div>
        <label htmlFor="queue-state">Mostrar</label>
        <select id="queue-state" value={stateFilter} onChange={event => setStateFilter(event.target.value)}>
          <option value="">Pendientes y confirmadas</option><option value="PENDIENTE">Solo pendientes</option><option value="CONFIRMADA">Solo confirmadas</option>
        </select>{' '}
        <button type="button" onClick={() => pollerRef.current?.refresh()}>Actualizar</button>
        <p role="status" aria-live="polite">{sync.state === 'offline'
          ? 'Sin conexión: se reintentará sola. Lo que ves puede estar desactualizado.'
          : `Se actualiza sola cada ${Math.round(intervalMs / 1000)} s${sync.at ? ` · última: ${new Date(sync.at).toLocaleTimeString('es-PE')}` : ''}.`}</p>
      </div>}
      {queue.length === 0 && <p>No hay reservas de esta farmacia en este momento.</p>}
      <ul className="reservation-queue">{queue.map(item => <QueueItem key={item.id} item={item} nowMs={nowMs} busy={busy} can={can} onAction={action} />)}</ul>
    </>}
  </section>;
}
