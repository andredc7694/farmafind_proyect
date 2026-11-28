import type { PublicOffer } from '../../busqueda/contracts/public-search.js';

/** Textos fijos del asistente en modo MOCK: no hay generación libre ni datos que no vengan de F03. */
export const REPLIES = {
  HELP: 'Escribe el nombre de un medicamento (por ejemplo «Paracetamol») y comparo sus precios referenciales. Modo DEMO: la IA generativa externa no está habilitada; sin fichas revisadas me abstengo de dar información farmacológica.',
  GREETING: '¡Hola! Soy el asistente de FarmaFind. Puedo comparar precios referenciales de un medicamento, decirte qué farmacias lo ofrecen y llevarte al mapa de farmacias. Escribe, por ejemplo, «Paracetamol».',
  CAPABILITIES: 'Con las ofertas que publican las farmacias puedo mostrarte: nombre, concentración, presentación, precio referencial, farmacias que lo ofrecen y disponibilidad referencial. «Disponibilidad referencial» significa que la farmacia lo publicó como disponible en su última revisión: confírmalo antes de ir. No muestro el stock de las farmacias ni doy indicaciones médicas.',
  // F03.1: la búsqueda ya no tiene ese enlace; se indica el camino nuevo y se conserva el atajo a /search/mapa (D-08).
  NEARBY: 'Para ver farmacias cercanas, en Buscar medicamentos elige dónde buscas y pulsa «Mapa». También puedes usar «Ver farmacias en el mapa». Compartir tu ubicación es opcional y la decides allí; desde este chat no puedo verla.',
  ASK_TERM: '¿De qué medicamento quieres ver los precios? Escribe su nombre, por ejemplo «Paracetamol».',
} as const;

const listed = 6;
const capital = (text: string) => text.charAt(0).toLocaleUpperCase('es-PE') + text.slice(1);
const date = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' });

export function offersReply(term: string, offers: readonly PublicOffer[], byPrice: boolean): string {
  const lines = offers.slice(0, listed).map(offer => `• S/ ${(offer.precioReferencialCentavos / 100).toFixed(2)} · ${offer.farmacia.nombre}\n`
    + `  ${capital(offer.medicamento.nombreComercial)} ${offer.medicamento.concentracion}, ${offer.medicamento.presentacion} · revisado ${date(offer.ultimaRevision)}`);
  const more = offers.length - lines.length;
  return [byPrice ? `Precios referenciales de «${term}», de menor a mayor (disponibilidad referencial):`
    : `Ofertas públicas de «${term}» (disponibilidad referencial):`, ...lines,
    ...(more > 0 ? [`Hay ${more} ${more === 1 ? 'oferta más' : 'ofertas más'} en las fuentes y en Buscar medicamentos.`] : []),
    'Confirma precio y existencias con la farmacia.'].join('\n');
}

export function noOffersReply(term: string): string {
  return `No encontré ofertas públicas de «${term}». Revisa cómo está escrito, prueba con el principio activo o usa Buscar medicamentos.`;
}
