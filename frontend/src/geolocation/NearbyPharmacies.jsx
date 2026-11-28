import React, { useState } from 'react';
import { createGeolocationClient } from './geolocation-client.js';
import { PharmacyMap } from './PharmacyMap.jsx';
import { PharmacyDirections } from './PharmacyDirections.jsx';
import { F07_MAP_SOURCE } from './map-source.js';
import { EmptyState } from '../design/Primitives.jsx';
import { PublicOpeningHours, usePublicOpeningHours } from './OpeningHours.jsx';

function devicePosition() {
  return new Promise((resolve,reject)=>{
    if (!navigator.geolocation) { reject(new Error('Ubicación no disponible')); return; }
    navigator.geolocation.getCurrentPosition(position=>resolve({
      latitude:position.coords.latitude,longitude:position.coords.longitude,
    }),reject,{enableHighAccuracy:false,maximumAge:0,timeout:8000});
  });
}

export function NearbyPharmacies({client=createGeolocationClient(),getPosition=devicePosition,loadLeaflet}) {
  const [city,setCity]=useState('');
  // F08.1: «Ver farmacias en el mapa» desde la búsqueda llega con ?q=<producto>.
  const [term,setTerm]=useState(()=>{try{return (new URLSearchParams(window.location.search).get('q')??'').slice(0,120);}catch{return '';}});
  const [manualLatitude,setManualLatitude]=useState('');
  const [manualLongitude,setManualLongitude]=useState('');
  const [radius,setRadius]=useState('10');
  const [device,setDevice]=useState(null);
  const [result,setResult]=useState(null);
  const hours=usePublicOpeningHours(result?.farmacias?.map(pharmacy=>pharmacy.farmaciaId)??[]);
  const [status,setStatus]=useState('idle');
  const [message,setMessage]=useState('');
  const [showMap,setShowMap]=useState(false);

  async function requestPosition() {
    setMessage('');
    try {
      const position=await getPosition(); setDevice(position);
      setMessage('Ubicación temporal disponible para esta consulta.');
    } catch {
      setDevice(null); setMessage('No se obtuvo permiso. Puedes buscar por ciudad o introducir coordenadas manualmente.');
    }
  }
  function clearPosition() {
    setDevice(null); setResult(null); setShowMap(false);
    setMessage('Ubicación temporal borrada. Puedes continuar por ciudad.');
  }
  async function submit(event) {
    event.preventDefault(); setStatus('loading'); setMessage(''); setResult(null); setShowMap(false);
    try {
      let data;
      if (device || manualLatitude!=='' || manualLongitude!=='') {
        if (!device && (manualLatitude==='' || manualLongitude==='')) throw new Error('Introduce ambas coordenadas manuales.');
        const latitude=device?.latitude ?? Number(manualLatitude);
        const longitude=device?.longitude ?? Number(manualLongitude);
        data=await client.searchNearby({latitude,longitude,radiusKm:Number(radius),term:term.trim() || undefined});
      } else {
        if (city.trim().length<2) throw new Error('Escribe una ciudad de al menos dos caracteres.');
        data=await client.searchCity({city:city.trim(),term:term.trim() || undefined});
      }
      setResult(data); setStatus('ready');
    } catch(error) { setStatus('error'); setMessage(error.message); }
  }

  return <main className="bootstrap search" aria-labelledby="geo-title">
    <p className="eyebrow">FarmaFind</p><h1 id="geo-title">Farmacias cercanas</h1>
    <p className="notice" role="status">Función de geolocalización disponible únicamente en el entorno TEST/DEMO.</p>
    <p>Busca por ciudad o comparte tu ubicación solo para esta consulta. La distancia es lineal estimada, no una ruta.</p>
    <form className="search-form" onSubmit={submit}>
      <label htmlFor="geo-city">Ciudad<input id="geo-city" value={city} onChange={event=>setCity(event.target.value)}
        minLength="2" maxLength="120" autoComplete="address-level2" /></label>
      <label htmlFor="geo-product">Producto público (opcional)<input id="geo-product" value={term}
        onChange={event=>setTerm(event.target.value)} minLength="2" maxLength="120" /></label>
      <div className="search-filters">
        <label htmlFor="geo-lat">Latitud manual (opcional)<input id="geo-lat" type="number" step="any" min="-90" max="90"
          value={manualLatitude} onChange={event=>setManualLatitude(event.target.value)} /></label>
        <label htmlFor="geo-lon">Longitud manual (opcional)<input id="geo-lon" type="number" step="any" min="-180" max="180"
          value={manualLongitude} onChange={event=>setManualLongitude(event.target.value)} /></label>
        <label htmlFor="geo-radius">Radio (km)<input id="geo-radius" type="number" min="1" max="50" step="1"
          value={radius} onChange={event=>setRadius(event.target.value)} /></label>
      </div>
      <div><button type="button" onClick={requestPosition}>Usar mi ubicación una vez</button>{' '}
        {device && <button type="button" onClick={clearPosition}>Borrar mi ubicación</button>}</div>
      <button type="submit" disabled={status==='loading'}>{status==='loading'?'Buscando…':'Buscar farmacias'}</button>
    </form>
    {message && <p role="alert">{message}</p>}
    {result && <section aria-live="polite"><p className="notice">{result.aviso}</p>
      {result.farmacias.some(value=>value.ubicacionVerificada && Number.isFinite(value.latitud) && Number.isFinite(value.longitud)) &&
        <div className="map-consent"><p>El mapa usa teselas de {F07_MAP_SOURCE.name}. Al cargarlo, el proveedor recibirá tu IP y el área visible de farmacias públicas. No se enviará tu posición personal precisa. Consulta su <a href={F07_MAP_SOURCE.privacy} target="_blank" rel="noopener noreferrer">política de privacidad</a>.</p>
          <button type="button" onClick={()=>setShowMap(value=>!value)}>{showMap?'Ocultar mapa':'Cargar mapa de OpenStreetMap'}</button>
        </div>}
      {showMap && <PharmacyMap pharmacies={result.farmacias} loadLeaflet={loadLeaflet} />}
      {result.farmacias.length===0 ? <EmptyState title="Sin farmacias públicas"><span>No hay farmacias públicas para esta consulta.</span> Prueba con otra ciudad o un radio distinto.</EmptyState>
        : <ul className="offer-grid">{result.farmacias.map(pharmacy=><li className="offer" key={pharmacy.farmaciaId}>
          <h2>{pharmacy.nombre}</h2><p>{pharmacy.direccion}</p>
          <PublicOpeningHours days={hours[pharmacy.farmaciaId]} />
          {pharmacy.distanciaLinealKm!==undefined && <p>Distancia lineal estimada: {pharmacy.distanciaLinealKm.toFixed(2)} km</p>}
          {!pharmacy.ubicacionVerificada && <p>Ubicación en revisión; sin distancia ni marcador.</p>}
          {pharmacy.ofertas?.map(offer=><p key={offer.productoId}>Oferta pública referencial: S/ {(offer.precioCentavos/100).toFixed(2)}
            {' · '}revisada {new Date(offer.revisadoEn).toLocaleString('es-PE')}</p>)}
          <PharmacyDirections pharmacy={pharmacy} />
        </li>)}</ul>}
    </section>}
  </main>;
}
