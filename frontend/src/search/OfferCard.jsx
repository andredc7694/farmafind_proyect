import React from 'react';
import { describeToday } from './today-hours.js';

export const money = cents => `S/ ${(cents / 100).toFixed(2)}`;
export const reservationHref = offer =>
  `/reservations?pharmacyId=${encodeURIComponent(offer.farmacia.id)}&medicationId=${encodeURIComponent(offer.medicamento.id)}`;

/**
 * F03.1 (FR-005, FR-008, FR-009, D-04): tarjeta de un resultado. Farmacia, producto, precio, distancia,
 * horario de hoy, dirección textual, fecha de revisión, «Comparar» discreto y «Reservar».
 */
export function OfferCard({ offer, days, comparables, gapCents, compared, compareDisabled, onCompare, selected, onSelect, showMapButton, now }) {
  const located = offer.farmacia.ubicacion !== null && offer.farmacia.ubicacion !== undefined;
  return <li className={`offer${selected ? ' is-selected' : ''}`} data-pharmacy={offer.farmacia.id} aria-current={selected ? 'true' : undefined}>
    <h2 className="offer-pharmacy">{offer.farmacia.nombre}</h2>
    <p className="offer-product"><strong>{offer.medicamento.nombreComercial}</strong> · {offer.medicamento.principioActivo} · {offer.medicamento.concentracion} · {offer.medicamento.presentacion}</p>
    <p className="offer-price">{money(offer.precioReferencialCentavos)}</p>
    <ul className="offer-facts">
      {offer.distanciaKm !== null && offer.distanciaKm !== undefined && <li>A {offer.distanciaKm.toFixed(1)} km aprox.</li>}
      <li>{describeToday(days, now)}</li>
      <li>{offer.farmacia.direccion}</li>
      {!located && <li className="offer-unverified">Ubicación no verificada</li>}
    </ul>
    {comparables.length > 0 && <p className="comparables">{gapCents === 0 ? 'Es el precio más bajo de esta página. ' : `${money(gapCents)} más que el más bajo de esta página. `}
      También en: {comparables.map(other => `${other.pharmacy} (${money(other.priceCents)})`).join(', ')}.</p>}
    <p className="offer-meta">Disponible · revisado {new Date(offer.ultimaRevision).toLocaleString('es-PE')}</p>
    <div className="offer-actions">
      <a className="button-link" href={reservationHref(offer)}>Reservar</a>
      {showMapButton && located && <button type="button" onClick={() => onSelect(offer.farmacia.id)} aria-pressed={selected}>Ver en el mapa</button>}
      <label className="compare-select"><input type="checkbox" checked={compared} disabled={compareDisabled} onChange={onCompare} /> Comparar</label>
    </div>
  </li>;
}
