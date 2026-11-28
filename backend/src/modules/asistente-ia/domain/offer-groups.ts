import type { PublicOffer } from '../../busqueda/contracts/public-search.js';
import { normalizeSearchText } from '../../busqueda/contracts/public-search-text.js';
import { sameStrength } from './assistant-language.js';
import type { AssistantCard, AssistantChoice, ConversationCitation } from './conversation-contract.js';
import { DOSAGE_FORM_LABEL, dosageForm, formsIn, type DosageForm } from './dosage-form.js';

/** F06.2: agrupa ofertas públicas por principio activo + concentración + forma (FR-007) y arma tarjetas (FR-005). */
export interface OfferGroup {
  readonly key: string;
  readonly principio: string;
  readonly concentracion: string;
  readonly strength: string | null;
  readonly form: DosageForm | null;
  readonly offers: readonly PublicOffer[];
}

const STRENGTH = /\b(\d+(?:\.\d+)?) (mg|g|mcg|ug|ml|ui|%)(?=\s|$)/;
export const strengthOf = (concentracion: string): string | null => {
  const match = STRENGTH.exec(normalizeSearchText(concentracion));
  return match ? `${match[1]} ${match[2]}` : null;
};
export const capital = (text: string) => text.charAt(0).toLocaleUpperCase('es-PE') + text.slice(1);
export const soles = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

export function filterVariant(offers: readonly PublicOffer[], strength: string | null, form: DosageForm | null): PublicOffer[] {
  return offers.filter(offer => (!strength || sameStrength(offer.medicamento.concentracion, strength))
    && (!form || formsIn(offer.medicamento.presentacion).includes(form)));
}

export function groupOffers(offers: readonly PublicOffer[]): OfferGroup[] {
  const groups = new Map<string, { principio: string; concentracion: string; form: DosageForm | null; offers: PublicOffer[] }>();
  for (const offer of offers) {
    const form = dosageForm(offer.medicamento.presentacion);
    const key = `${normalizeSearchText(offer.medicamento.principioActivo)}|${normalizeSearchText(offer.medicamento.concentracion)}|${form ?? '?'}`;
    const group = groups.get(key) ?? { principio: offer.medicamento.principioActivo, concentracion: offer.medicamento.concentracion, form, offers: [] };
    group.offers.push(offer);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group, strength: strengthOf(group.concentracion) }));
}

/** Botones de «¿Cuál buscas?»: hasta 5, sin repetir la misma consulta. */
export function variantChoices(term: string, groups: readonly OfferGroup[], suffix = ''): AssistantChoice[] {
  const seen = new Set<string>(); const choices: AssistantChoice[] = [];
  for (const group of groups) {
    const consulta = [term, group.strength ?? '', group.form ?? '', suffix].filter(Boolean).join(' ');
    if (seen.has(consulta)) continue;
    seen.add(consulta);
    choices.push({ texto: `${capital(group.principio)} ${group.concentracion}${group.form ? ` · ${DOSAGE_FORM_LABEL[group.form]}` : ''}`, consulta });
    if (choices.length === 5) break;
  }
  return choices;
}

export const reservationUrl = (offer: PublicOffer) =>
  `/reservations?pharmacyId=${encodeURIComponent(offer.farmacia.id)}&medicationId=${encodeURIComponent(offer.medicamento.id)}`;

export function offerCard(offer: PublicOffer, horarioHoy: string | null, etiqueta?: string): AssistantCard {
  return {
    ...(etiqueta ? { etiqueta } : {}),
    farmacia: { id: offer.farmacia.id, nombre: offer.farmacia.nombre, direccion: offer.farmacia.direccion },
    producto: { id: offer.medicamento.id, nombre: offer.medicamento.nombreComercial, concentracion: offer.medicamento.concentracion,
      presentacion: offer.medicamento.presentacion },
    precioCentavos: offer.precioReferencialCentavos, distanciaKm: offer.distanciaKm, horarioHoy, reservarUrl: reservationUrl(offer),
  };
}

export function offerSources(offers: readonly PublicOffer[]): ConversationCitation[] {
  return offers.slice(0, 20).map(offer => ({ tipo: 'OFERTA_PUBLICA', titulo: offer.medicamento.nombreComercial,
    referencia: `farmafind://oferta/${offer.medicamento.id}/${offer.farmacia.id}`, revisadoEl: offer.ultimaRevision }));
}

export const byPrice = (a: PublicOffer, b: PublicOffer) => a.precioReferencialCentavos - b.precioReferencialCentavos;
export const byDistance = (a: PublicOffer, b: PublicOffer) =>
  (a.distanciaKm ?? Number.POSITIVE_INFINITY) - (b.distanciaKm ?? Number.POSITIVE_INFINITY) || byPrice(a, b);
