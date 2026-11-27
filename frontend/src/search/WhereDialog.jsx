import React, { useEffect, useId, useRef, useState } from 'react';
import { PERU_PLACES } from '../geolocation/peru-cities.js';
import { PointPicker } from '../geolocation/PointPicker.jsx';
import { cityLocation, filterPlaces, searchLocation } from './search-location.js';

/** Centro inicial del mapa «Elegir el punto»: Huamanga (Ayacucho), zona de la DEMO. */
export const SEARCH_MAP_CENTER = { latitude: -13.1603, longitude: -74.2253 };

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
export function WhereDialog({ onChoose, onCancel, rememberedCity = false, getPosition = devicePosition, loadLeaflet, places = PERU_PLACES }) {
  const ref = useRef(null); const listId = useId();
  const [city, setCity] = useState('');
  const [remember, setRemember] = useState(rememberedCity);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [point, setPoint] = useState(null);
  const [activeOption, setActiveOption] = useState(-1);
  const [listOpen, setListOpen] = useState(false);
  const matches = filterPlaces(places, city);
  const showList = listOpen && matches.length > 0;

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
  function pick(place) { setCity(place.name); setListOpen(false); setActiveOption(-1); setMessage(''); }
  function cityKeys(event) { // patrón combobox: ↑ ↓ eligen, Enter confirma la opción activa, Escape cierra solo la lista
    if (event.key === 'ArrowDown' && matches.length) { event.preventDefault(); setListOpen(true); setActiveOption(current => (current + 1) % matches.length); }
    else if (event.key === 'ArrowUp' && matches.length) { event.preventDefault(); setListOpen(true); setActiveOption(current => (current <= 0 ? matches.length - 1 : current - 1)); }
    else if (event.key === 'Enter' && showList && activeOption >= 0) { event.preventDefault(); pick(matches[activeOption]); }
    else if (event.key === 'Escape' && showList) { event.preventDefault(); event.stopPropagation(); setListOpen(false); setActiveOption(-1); }
  }
  function useCity(event) {
    event.preventDefault();
    const location = places.some(place => place.name === cityLocation(city)?.label) ? cityLocation(city) : null;
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
        <div className="suggest-box">
          <input id={`${listId}-city`} role="combobox" aria-autocomplete="list" aria-expanded={showList} aria-controls={`${listId}-places`}
            aria-activedescendant={showList && activeOption >= 0 ? `${listId}-place-${activeOption}` : undefined}
            value={city} autoComplete="off" maxLength={80} placeholder="Escribe para filtrar"
            onChange={event => { setCity(event.target.value); setListOpen(true); setActiveOption(-1); setMessage(''); }}
            onKeyDown={cityKeys} onBlur={() => setTimeout(() => setListOpen(false), 120)} />
          <ul id={`${listId}-places`} role="listbox" aria-label="Lugares" hidden={!showList}>{matches.map((place, index) =>
            <li key={place.name} id={`${listId}-place-${index}`} role="option" aria-selected={index === activeOption}
              onMouseDown={event => { event.preventDefault(); pick(place); }}>{place.name}</li>)}</ul>
          <p className="visually-hidden" role="status" aria-live="polite">{city && listOpen ? `${matches.length} lugar(es)` : ''}</p>
        </div>
      </div>
      <label className="check-field"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />
        {' '}Recordar la ciudad en este navegador</label>
      <button type="submit">Usar este lugar</button>
    </form>
    {!mapOpen ? <button type="button" className="where-option" onClick={() => setMapOpen(true)}>Elegir en el mapa</button>
      : <div className="where-map">
        <PointPicker value={point} onChange={value => setPoint(value)} {...(loadLeaflet ? { loadLeaflet } : {})}
          center={SEARCH_MAP_CENTER} compact />
        <button type="button" disabled={!point} onClick={() => onChoose(searchLocation('map', point), { remember: false })}>Usar el punto elegido</button>
      </div>}
    {message && <p role="alert">{message}</p>}
    <div className="dialog-actions"><button type="button" onClick={onCancel}>Cancelar</button></div>
  </dialog>;
}
