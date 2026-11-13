import type { PublicOffer } from '../contracts/public-search.js';
import type { CanonicalPublicQuery } from './public-query.js';

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(lat2 - lat1); const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 100) / 100;
}

export function orderOffers(offers: readonly PublicOffer[], query: CanonicalPublicQuery): readonly PublicOffer[] {
  return [...offers].sort((a, b) => {
    if (query.order === 'precio_asc') return a.precioReferencialCentavos - b.precioReferencialCentavos || a.farmacia.id.localeCompare(b.farmacia.id);
    if (query.order === 'precio_desc') return b.precioReferencialCentavos - a.precioReferencialCentavos || a.farmacia.id.localeCompare(b.farmacia.id);
    if (query.order === 'cercania') return (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity) || a.farmacia.id.localeCompare(b.farmacia.id);
    return a.medicamento.nombreComercial.localeCompare(b.medicamento.nombreComercial, 'es') ||
      a.medicamento.presentacion.localeCompare(b.medicamento.presentacion, 'es') || a.farmacia.id.localeCompare(b.farmacia.id);
  });
}
