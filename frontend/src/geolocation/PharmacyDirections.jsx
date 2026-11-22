import React from 'react';

/** Voluntary destination-only link. No visitor origin, route or travel time is fabricated. */
export function PharmacyDirections({pharmacy}) {
  if (!pharmacy.ubicacionVerificada || !Number.isFinite(pharmacy.latitud) || !Number.isFinite(pharmacy.longitud))
    return <p>Consulta la dirección textual de la farmacia para llegar.</p>;
  const url=`https://www.openstreetmap.org/?mlat=${encodeURIComponent(pharmacy.latitud)}&mlon=${encodeURIComponent(pharmacy.longitud)}#map=16/${pharmacy.latitud}/${pharmacy.longitud}`;
  return <p><a href={url} target="_blank" rel="noopener noreferrer">
    Ver destino en OpenStreetMap (se abre solo al pulsar)</a></p>;
}
