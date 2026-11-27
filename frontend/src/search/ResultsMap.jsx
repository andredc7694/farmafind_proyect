import React, { useEffect, useMemo, useRef, useState } from 'react';
import { F07_MAP_SOURCE } from '../geolocation/map-source.js';
import { describeToday } from './today-hours.js';
import { money, reservationHref } from './OfferCard.jsx';
import 'leaflet/dist/leaflet.css';

const importLeaflet = () => import('leaflet');

/** Una entrada por farmacia con ubicación verificada: su oferta más barata de la página. */
export function mappablePharmacies(offers) {
  const byId = new Map();
  for (const offer of offers) {
    const point = offer.farmacia.ubicacion;
    if (!point || !Number.isFinite(point.latitud) || !Number.isFinite(point.longitud)) continue;
    const current = byId.get(offer.farmacia.id);
    if (!current || offer.precioReferencialCentavos < current.offer.precioReferencialCentavos)
      byId.set(offer.farmacia.id, { id: offer.farmacia.id, name: offer.farmacia.nombre, point, offer });
  }
  return [...byId.values()];
}

function popupNode(entry, days, now) {
  // Solo nodos de texto: el nombre y la dirección de la farmacia nunca se insertan como HTML.
  const box = document.createElement('div'); box.className = 'map-card';
  const title = document.createElement('strong'); title.textContent = entry.name;
  const price = document.createElement('p'); price.textContent = `${money(entry.offer.precioReferencialCentavos)} · ${entry.offer.medicamento.nombreComercial}`;
  const facts = document.createElement('p');
  facts.textContent = [entry.offer.distanciaKm !== null && entry.offer.distanciaKm !== undefined ? `A ${entry.offer.distanciaKm.toFixed(1)} km aprox.` : null,
    describeToday(days, now)].filter(Boolean).join(' · ');
  const address = document.createElement('p'); address.textContent = entry.offer.farmacia.direccion;
  const link = document.createElement('a'); link.href = reservationHref(entry.offer); link.textContent = 'Reservar'; link.className = 'button-link';
  box.append(title, price, facts, address, link);
  return box;
}

/**
 * F03.1 (FR-006 a FR-011): mapa de resultados. Se monta solo al elegir «Mapa». Leaflet + OSM ya aprobados,
 * marcadores propios (cruz verde con el precio, en CSS), accesibles con teclado y texto alternativo.
 * Encuadre solo con farmacias (nunca con la ubicación del visitante, que se dibuja como un círculo).
 */
export function ResultsMap({ offers, hours = {}, selectedId = null, onSelect, userPoint = null, loadLeaflet = importLeaflet, now }) {
  const container = useRef(null); const mapRef = useRef(null); const markersRef = useRef(new Map());
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const [status, setStatus] = useState('loading');
  const entries = useMemo(() => mappablePharmacies(offers), [offers]);
  const key = entries.map(entry => `${entry.id}:${entry.offer.precioReferencialCentavos}`).join('|');

  useEffect(() => {
    if (!container.current || entries.length === 0) return undefined;
    let disposed = false; setStatus('loading');
    loadLeaflet().then(module => {
      if (disposed || !container.current) return;
      const L = module.default ?? module;
      const map = L.map(container.current, { zoomControl: true, keyboard: true });
      mapRef.current = map;
      const tiles = L.tileLayer(F07_MAP_SOURCE.tiles, { maxZoom: F07_MAP_SOURCE.maxZoom,
        attribution: `<a href="${F07_MAP_SOURCE.copyright}">${F07_MAP_SOURCE.attribution}</a>`, referrerPolicy: 'strict-origin-when-cross-origin' });
      tiles.on('tileerror', () => { if (!disposed) setStatus('failed'); });
      tiles.addTo(map);
      const points = [];
      for (const entry of entries) {
        const label = `${entry.name}, ${money(entry.offer.precioReferencialCentavos)}`;
        // El HTML del icono solo contiene el precio formateado a partir de un número.
        const icon = L.divIcon({ className: 'ff-marker', iconSize: [76, 44], iconAnchor: [38, 44], popupAnchor: [0, -40],
          html: `<span class="ff-marker-price">${money(entry.offer.precioReferencialCentavos)}</span><span class="ff-marker-cross" aria-hidden="true"></span>` });
        const marker = L.marker([entry.point.latitud, entry.point.longitud], { icon, keyboard: true, title: label, alt: label, riseOnHover: true });
        marker.bindPopup(() => popupNode(entry, hours[entry.id], now));
        // Leaflet convierte Enter sobre un marcador enfocado en «click»: teclado y ratón comparten el mismo camino.
        marker.on('click', () => onSelectRef.current?.(entry.id));
        marker.addTo(map);
        const element = marker.getElement?.();
        if (element) { element.setAttribute('aria-label', label); element.setAttribute('role', 'button'); }
        markersRef.current.set(entry.id, marker);
        points.push([entry.point.latitud, entry.point.longitud]);
      }
      if (points.length === 1) map.setView(points[0], 15); else map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
      if (userPoint && Number.isFinite(userPoint.latitude) && Number.isFinite(userPoint.longitude)) {
        // Solo se dibuja; no centra el mapa, no se guarda y no se envía a nadie.
        L.circle([userPoint.latitude, userPoint.longitude], { radius: 120, color: '#0b5c8a', fillColor: '#0b5c8a', fillOpacity: 0.25,
          interactive: false }).addTo(map);
      }
      if (!disposed) setStatus('ready');
    }).catch(() => { if (!disposed) setStatus('failed'); });
    return () => { disposed = true; markersRef.current.clear(); if (mapRef.current) mapRef.current.remove(); mapRef.current = null; };
  }, [key, loadLeaflet, userPoint?.latitude, userPoint?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { // resalta y centra la farmacia elegida en la lista
    for (const [id, marker] of markersRef.current) marker.getElement?.()?.classList.toggle('is-selected', id === selectedId);
    const marker = selectedId ? markersRef.current.get(selectedId) : null;
    if (marker && mapRef.current) { mapRef.current.panTo(marker.getLatLng()); marker.openPopup?.(); }
  }, [selectedId, status]);

  if (entries.length === 0) return <p className="notice">Ninguna farmacia de esta página tiene ubicación verificada. Consulta la lista y la dirección.</p>;
  return <section className="results-map-panel" aria-label="Mapa de farmacias con ubicación verificada">
    <p className="map-privacy">El mapa usa imágenes de {F07_MAP_SOURCE.name}: el proveedor recibe tu IP y la zona visible de farmacias públicas, no tu posición. Solo aparecen farmacias con ubicación verificada.</p>
    <div ref={container} className="pharmacy-map results-map" role="region" aria-label={`Mapa con ${entries.length} farmacia(s). Usa Tab para recorrer los marcadores y Enter para ver la tarjeta.`} />
    {status === 'loading' && <p role="status">Cargando el mapa…</p>}
    {status === 'failed' && <p role="alert">No se pudo cargar el mapa. La lista y las direcciones siguen disponibles.</p>}
    <p className="map-attribution"><a href={F07_MAP_SOURCE.copyright} target="_blank" rel="noopener noreferrer">{F07_MAP_SOURCE.attribution}</a></p>
  </section>;
}
