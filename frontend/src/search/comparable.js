/** F08.1: ofertas comparables derivadas de los resultados ya recibidos (sin pedir nada más al servidor). */
export function comparableFor(offer, offers) {
  return offers
    .filter(other => other !== offer && other.medicamento.id === offer.medicamento.id && other.farmacia.id !== offer.farmacia.id)
    .map(other => ({ pharmacy: other.farmacia.nombre, priceCents: other.precioReferencialCentavos, checkedAt: other.ultimaRevision }))
    .sort((a, b) => a.priceCents - b.priceCents || a.pharmacy.localeCompare(b.pharmacy, 'es'));
}

/** Diferencia de precio frente a la oferta más barata del mismo medicamento (en céntimos; 0 = es la más barata). */
export function priceGapCents(offer, offers) {
  const same = offers.filter(other => other.medicamento.id === offer.medicamento.id).map(other => other.precioReferencialCentavos);
  return same.length ? offer.precioReferencialCentavos - Math.min(...same) : 0;
}
