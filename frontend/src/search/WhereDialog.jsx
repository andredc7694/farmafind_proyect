import React, { useEffect, useId, useRef, useState } from 'react';
import { PERU_PLACES } from '../geolocation/peru-cities.js';
import { PointPicker } from '../geolocation/PointPicker.jsx';
import { cityLocation, searchLocation } from './search-location.js';

function devicePosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { reject(new Error('Ubicación no disponible')); return; }
    // Una sola lectura, sin seguimiento ni posiciones antiguas.
    navigator.geolocation.getCurrentPosition(position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      reject, { enableHighAccuracy: false, maximumAge: 0, timeout: 8000 });
  });
}

/**
 * F03.1 (FR-002, FR-003, FR-010): «¿Dónde buscas?». Diálogo modal nativo (foco atrapado, Escape cierra).
 * Tres opciones: una lectura del dispositivo, distrito/ciudad de la lista interna (sin servicio externo)
 * o un punto en el mapa (se carga solo al pedirlo). Solo la ciudad puede recordarse, con la casilla.
 */
export function WhereDialog({ onChoose, onCancel, rememberedCity = false, getPosition = devicePosition, loadLeaflet }) {
  const ref = useRef(null); const listId = useId();
  const [city, setCity] = useState('');
  const [remember, setRemember] = useState(rememberedCity);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [point, setPoint] = useState(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog?.showModal) { try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); } } else dialog?.setAttribute('open', '');
    return () => { if (dialog?.open && dialog.close) dialog.close(); };
  }, []);

  async function useDevice() {
    setBusy(true); setMessage('');
    try { onChoose(searchLocation('gps', await getPosition()), { remember: false }); }
    catch { setMessage('No se pudo usar tu ubicación (permiso denegado o no disponible). Escribe tu distrito o ciudad, o elige en el mapa.'); }
    finally { setBusy(false); }
  }
  function useCity(event) {
    event.preventDefault();
    const location = cityLocation(city);
    if (!location) { setMessage('Ese lugar no está en la lista. Elige uno de la lista o márcalo en el mapa.'); return; }
    onChoose(location, { remember });
  }

  return <dialog ref={ref} className="where-dialog" aria-labelledby="where-title"
    onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id="where-title">¿Dónde buscas?</h2>
    <p className="field-hint">Solo se usa para ordenar por cercanía y mostrar la distancia. No se guarda en FarmaFind.</p>
    <button type="button" className="where-option" onClick={() => void useDevice()} disabled={busy} autoFocus>
      {busy ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}</button>
    <form className="stacked-form where-city" onSubmit={useCity}>
      <div className="form-field">
        <label htmlFor={`${listId}-city`}>Distrito o ciudad</label>
        <input id={`${listId}-city`} list={`${listId}-places`} value={city} autoComplete="off" maxLength={80}
          onChange={event => { setCity(event.target.value); setMessage(''); }} placeholder="Ej.: Ayacucho, Miraflores" />
        <datalist id={`${listId}-places`}>{PERU_PLACES.map(place => <option key={place.name} value={place.name} />)}</datalist>
      </div>
      <label className="check-field"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />
        {' '}Recordar la ciudad en este navegador</label>
      <button type="submit">Usar este lugar</button>
    </form>
    {!mapOpen ? <button type="button" className="where-option" onClick={() => setMapOpen(true)}>Elegir en el mapa</button>
      : <div className="where-map">
        <PointPicker value={point} onChange={value => setPoint(value)} {...(loadLeaflet ? { loadLeaflet } : {})}
          center={{ latitude: -12.0464, longitude: -77.0428 }} compact />
        <button type="button" disabled={!point} onClick={() => onChoose(searchLocation('map', point), { remember: false })}>Usar el punto elegido</button>
      </div>}
    {message && <p role="alert">{message}</p>}
    <div className="dialog-actions"><button type="button" onClick={onCancel}>Cancelar</button></div>
  </dialog>;
}
