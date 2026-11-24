import React, { useEffect, useRef, useState } from 'react';
import { F07_MAP_SOURCE } from './map-source.js';

const importLeaflet = () => import('leaflet');
const STEP = 0.0005; // ≈ 55 m por pulsación de flecha

function devicePosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { reject(new Error('Ubicación no disponible')); return; }
    // Una sola lectura (nunca watchPosition) y sin reutilizar posiciones antiguas.
    navigator.geolocation.getCurrentPosition(position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }), reject,
      { enableHighAccuracy: false, maximumAge: 0, timeout: 8000 });
  });
}

const valid = point => point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
const clamp = point => ({ latitude: Math.max(-90, Math.min(90, point.latitude)), longitude: Math.max(-180, Math.min(180, point.longitude)) });

/**
 * Elección del punto (F08.1). Tres vías, todas opcionales y sin proveedor de geocodificación:
 *  1) GPS puntual: pide consentimiento, usa UNA lectura y no la guarda como rastro;
 *  2) mapa: solo se carga tras un clic informado (OpenStreetMap ve la IP del navegador); clic o flechas mueven el punto;
 *  3) escribir las coordenadas (lo hace quien usa este componente con sus propios campos).
 * No guarda nada: entrega el punto elegido con `onChange`.
 */
export function PointPicker({ value = null, onChange, getPosition = devicePosition, loadLeaflet = importLeaflet, center = { latitude: -12.0464, longitude: -77.0428 } }) {
  const container = useRef(null); const mapRef = useRef(null); const markerRef = useRef(null); const leafletRef = useRef(null);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | ready | failed
  const point = valid(value) ? value : null;

  async function useDevice() {
    setMessage('');
    try { const position = await getPosition(); onChange(clamp(position)); setMessage('Ubicación de este momento aplicada. No se guarda como rastro; confírmala antes de enviar.'); }
    catch { setMessage('No se pudo obtener la ubicación. Puedes elegir el punto en el mapa o escribir las coordenadas.'); }
  }

  useEffect(() => {
    if (!consent || !container.current) return undefined;
    let disposed = false; setStatus('loading');
    loadLeaflet().then(module => {
      if (disposed || !container.current) return;
      const L = module.default ?? module; leafletRef.current = L;
      const start = point ?? center;
      const map = L.map(container.current, { zoomControl: true, keyboard: true }).setView([start.latitude, start.longitude], point ? 17 : 13);
      mapRef.current = map;
      const tiles = L.tileLayer(F07_MAP_SOURCE.tiles, { maxZoom: F07_MAP_SOURCE.maxZoom,
        attribution: `<a href="${F07_MAP_SOURCE.copyright}">${F07_MAP_SOURCE.attribution}</a>`, referrerPolicy: 'strict-origin-when-cross-origin' });
      tiles.on('tileerror', () => { if (!disposed) setStatus('failed'); });
      tiles.addTo(map);
      map.on('click', event => onChange(clamp({ latitude: event.latlng.lat, longitude: event.latlng.lng })));
      if (!disposed) setStatus('ready');
    }).catch(() => { if (!disposed) setStatus('failed'); });
    return () => { disposed = true; if (mapRef.current) mapRef.current.remove(); mapRef.current = null; markerRef.current = null; };
  }, [consent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { // refleja el punto actual (también cuando se escribe a mano) en el marcador
    const map = mapRef.current; const L = leafletRef.current;
    if (!map || !L || !point) return;
    if (markerRef.current) markerRef.current.setLatLng([point.latitude, point.longitude]);
    else markerRef.current = L.circleMarker([point.latitude, point.longitude], { radius: 9, color: '#176b52', fillColor: '#176b52', fillOpacity: 0.85 }).addTo(map);
    map.panTo([point.latitude, point.longitude]);
  }, [point?.latitude, point?.longitude, status]); // eslint-disable-line react-hooks/exhaustive-deps

  function keyDown(event) {
    const base = point ?? center; const delta = { ArrowUp: [STEP, 0], ArrowDown: [-STEP, 0], ArrowLeft: [0, -STEP], ArrowRight: [0, STEP] }[event.key];
    if (!delta) return;
    event.preventDefault(); onChange(clamp({ latitude: Number((base.latitude + delta[0]).toFixed(6)), longitude: Number((base.longitude + delta[1]).toFixed(6)) }));
  }

  return <fieldset className="point-picker">
    <legend>Elegir el punto</legend>
    <p>Puedes usar tu ubicación solo una vez, elegir el punto en el mapa o escribir las coordenadas. Ninguna de las tres se guarda como rastro.</p>
    <button type="button" onClick={() => void useDevice()}>Usar mi ubicación una vez</button>
    {!consent
      ? <div className="map-consent"><p>Para mostrar el mapa, tu navegador pedirá imágenes a {F07_MAP_SOURCE.name}, que verá tu dirección IP. Es opcional.</p>
          <button type="button" onClick={() => setConsent(true)}>Mostrar el mapa para elegir el punto</button></div>
      : <>
          <div ref={container} className="pharmacy-map point-picker-map" tabIndex={0} role="application" aria-label="Mapa para elegir el punto. Usa las flechas para mover el punto o haz clic."
            onKeyDown={keyDown} />
          {status === 'loading' && <p role="status">Cargando el mapa…</p>}
          {status === 'failed' && <p role="alert">El mapa no está disponible; puedes escribir las coordenadas.</p>}
          <p className="map-attribution"><a href={F07_MAP_SOURCE.copyright} target="_blank" rel="noopener noreferrer">{F07_MAP_SOURCE.attribution}</a></p>
        </>}
    {point && <p role="status">Punto elegido: {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</p>}
    {message && <p role="status">{message}</p>}
  </fieldset>;
}
