/** Leaflet falso para pruebas F03.1: sin red ni teselas. Registra lo que la pantalla le pide. */
export function createFakeLeaflet() {
  const log = { maps: [], markers: [], circles: [], tiles: [], fitBounds: [], setView: [], panTo: [] };
  const L = {
    map(container, options) {
      // Como Leaflet real: sin vista (setView/fitBounds) el mapa no está «cargado» y los iconos no existen aún.
      const map = { container, options, handlers: {}, loaded: false,
        setView(center, zoom) { map.loaded = true; log.setView.push({ center, zoom }); return map; },
        fitBounds(points, opts) { map.loaded = true; log.fitBounds.push({ points, opts }); return map; },
        panTo(point) { log.panTo.push(point); return map; },
        on(event, fn) { map.handlers[event] = fn; return map; },
        remove() { map.removed = true; } };
      log.maps.push(map); return map;
    },
    tileLayer(url, options) { const layer = { url, options, on() { return layer; }, addTo() { return layer; } }; log.tiles.push(layer); return layer; },
    divIcon(options) { return options; },
    marker(latlng, options) {
      const marker = { latlng, options, handlers: {}, element: null, popup: null,
        bindPopup(fn) { marker.popup = fn; return marker; },
        on(event, fn) { marker.handlers[event] = fn; return marker; },
        addTo(map) {
          marker.map = map;
          if (!map.loaded) return marker; // Leaflet difiere el icono hasta tener vista
          const element = document.createElement('div'); element.className = options.icon.className; element.innerHTML = options.icon.html;
          if (options.keyboard) { element.tabIndex = 0; } if (options.title) element.title = options.title;
          element.addEventListener('click', () => marker.handlers.click?.());
          map.container.appendChild(element); marker.element = element; marker.map = map; return marker;
        },
        getElement() { return marker.element; },
        getLatLng() { return latlng; },
        openPopup() { const node = marker.popup?.(); if (node) { marker.openNode = node; marker.map.container.appendChild(node); } return marker; } };
      log.markers.push(marker); return marker;
    },
    circle(latlng, options) { const circle = { latlng, options, addTo() { log.circles.push(circle); return circle; } }; return circle; },
  };
  return { L, log, load: () => Promise.resolve({ default: L }) };
}
