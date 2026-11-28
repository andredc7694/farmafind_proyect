import React, { useEffect, useState } from 'react';
import { DAY_NAMES, createOpeningHoursClient, describeDay, limaIsoDay } from './my-pharmacy-clients.js';

const defaultClient = createOpeningHoursClient();
const emptyWeek = () => DAY_NAMES.map((_, index) => ({ dia: index + 1, cerrado: index === 6, abre: index === 6 ? null : '08:00', cierra: index === 6 ? null : '20:00' }));

/** F071-FR-008: editor del horario (un tramo por día o «Cerrado»). El servidor valida y versiona. */
export function OpeningHoursEditor({ pharmacyId, canWrite = false, client = defaultClient }) {
  const [state, setState] = useState('loading');
  const [version, setVersion] = useState(0);
  const [days, setDays] = useState(emptyWeek());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true; setState('loading'); setMessage('');
    client.read(pharmacyId).then(value => {
      if (!current) return;
      setVersion(value.version); setDays(value.dias.length === 7 ? value.dias : emptyWeek()); setState('ready');
    }).catch(() => { if (current) setState('error'); });
    return () => { current = false; };
  }, [pharmacyId, client]);
  const update = (index, patch) => setDays(list => list.map((day, i) => (i === index ? { ...day, ...patch } : day)));
  const invalid = days.some(day => !day.cerrado && (!day.abre || !day.cierra || day.abre >= day.cierra));
  async function save(event) {
    event.preventDefault(); if (invalid || busy) return;
    setBusy(true); setMessage('');
    try {
      const saved = await client.save(pharmacyId, { version, dias: days.map(day => day.cerrado
        ? { dia: day.dia, cerrado: true, abre: null, cierra: null } : { dia: day.dia, cerrado: false, abre: day.abre, cierra: day.cierra }) });
      setVersion(saved.version); setDays(saved.dias); setMessage('Horario guardado. Ya se muestra en la búsqueda y el mapa.');
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <section className="surface-card" aria-labelledby="opening-hours-title">
    <h3 id="opening-hours-title">Horario de atención</h3>
    {state === 'loading' && <p role="status">Cargando horario…</p>}
    {state === 'error' && <p role="alert">No se pudo cargar el horario.</p>}
    {state === 'ready' && (canWrite ? <form onSubmit={save} className="opening-hours-form">
      <p className="field-hint">Hora de Lima. Marca «Cerrado» los días sin atención.</p>
      {days.map((day, index) => <fieldset key={day.dia} className="opening-day">
        <legend>{DAY_NAMES[index]}</legend>
        <label><input type="checkbox" checked={day.cerrado} onChange={event => update(index, event.target.checked
          ? { cerrado: true, abre: null, cierra: null } : { cerrado: false, abre: '08:00', cierra: '20:00' })} /> Cerrado</label>
        {!day.cerrado && <>
          <label>Abre <input type="time" value={day.abre ?? ''} required onChange={event => update(index, { abre: event.target.value })} /></label>
          <label>Cierra <input type="time" value={day.cierra ?? ''} required onChange={event => update(index, { cierra: event.target.value })} /></label>
          {day.abre && day.cierra && day.abre >= day.cierra && <span role="alert">El cierre debe ser después de la apertura.</span>}
        </>}
      </fieldset>)}
      <button type="submit" disabled={busy || invalid}>{busy ? 'Guardando…' : 'Guardar horario'}</button>
    </form> : <ul>{days.map((day, index) => <li key={day.dia}>{DAY_NAMES[index]}: {describeDay(day)}</li>)}</ul>)}
    {message && <p role={message.startsWith('Horario guardado') ? 'status' : 'alert'}>{message}</p>}
  </section>;
}

/** Muestra pública: «Hoy: 08:00 a 20:00» y la semana completa a demanda. */
export function PublicOpeningHours({ days, now = new Date() }) {
  if (!Array.isArray(days) || days.length === 0) return null;
  const today = days.find(day => day.dia === limaIsoDay(now));
  return <details className="public-hours">
    <summary>Hoy: {describeDay(today)}</summary>
    <ul>{days.map(day => <li key={day.dia}>{DAY_NAMES[day.dia - 1]}: {describeDay(day)}</li>)}</ul>
  </details>;
}

/** Pide los horarios públicos de una lista de farmacias (máximo 50) sin bloquear la vista. */
export function usePublicOpeningHours(pharmacyIds, client = defaultClient) {
  const [hours, setHours] = useState({});
  const key = [...new Set(pharmacyIds)].sort().join(',');
  useEffect(() => {
    let current = true;
    if (!key) { setHours({}); return undefined; }
    client.publicHours(key.split(',')).then(value => { if (current) setHours(value); }).catch(() => { if (current) setHours({}); });
    return () => { current = false; };
  }, [key, client]);
  return hours;
}
