import React, { useEffect, useRef, useState } from 'react';
import { F07_MAP_SOURCE } from './map-source.js';
import 'leaflet/dist/leaflet.css';

const importLeaflet=()=>import('leaflet');

export function PharmacyMap({pharmacies,loadLeaflet=importLeaflet}) {
  const container=useRef(null);
  const [status,setStatus]=useState('loading');
  const visible=pharmacies.filter(value=>value.ubicacionVerificada &&
    Number.isFinite(value.latitud) && Number.isFinite(value.longitud));

  useEffect(()=>{
    if (!container.current || visible.length===0) return undefined;
    let disposed=false; let map;
    loadLeaflet().then(module=>{
      if (disposed || !container.current) return;
      const L=module.default ?? module;
      // A public pharmacy location, never the visitor's personal location, centers the map.
      map=L.map(container.current,{zoomControl:true}).setView([visible[0].latitud,visible[0].longitud],13);
      const tiles=L.tileLayer(F07_MAP_SOURCE.tiles,{maxZoom:F07_MAP_SOURCE.maxZoom,
        attribution:`<a href="${F07_MAP_SOURCE.copyright}">${F07_MAP_SOURCE.attribution}</a>`,
        referrerPolicy:'strict-origin-when-cross-origin'});
      tiles.on('tileerror',()=>{if(!disposed)setStatus('failed');});
      tiles.addTo(map);
      for(const pharmacy of visible) {
        const popup=document.createElement('div');
        const title=document.createElement('strong'); title.textContent=pharmacy.nombre;
        const address=document.createElement('p'); address.textContent=pharmacy.direccion;
        popup.append(title,address);
        L.circleMarker([pharmacy.latitud,pharmacy.longitud],{radius:8,color:'#176b52',fillColor:'#176b52',fillOpacity:0.8})
          .addTo(map).bindPopup(popup);
      }
      if (!disposed) setStatus('ready');
    }).catch(()=>{if(!disposed)setStatus('failed');});
    return ()=>{disposed=true;if(map)map.remove();};
  },[pharmacies,loadLeaflet]);

  if (visible.length===0) return <p>Sin posiciones verificadas para mostrar en el mapa. Consulta la lista y la dirección.</p>;
  return <section aria-label="Mapa opcional de farmacias públicas">
    <div ref={container} className="pharmacy-map" role="img" aria-label="Mapa interactivo de farmacias públicas verificadas" />
    {status==='failed' && <p role="alert">El mapa no está disponible; la lista y las direcciones siguen visibles.</p>}
    <p className="map-attribution"><a href={F07_MAP_SOURCE.copyright} target="_blank" rel="noopener noreferrer">
      {F07_MAP_SOURCE.attribution}</a></p>
  </section>;
}
