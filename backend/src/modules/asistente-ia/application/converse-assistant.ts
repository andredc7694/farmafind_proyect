import type { PublicOffer } from '../../busqueda/contracts/public-search.js';
import { normalizeSearchText } from '../../busqueda/contracts/public-search-text.js';
import { readPhrase, type AssistantIntent } from '../domain/assistant-language.js';
import { CONVERSATION_VERSION, type AssistantCard, type AssistantChoice, type ConversationCitation, type ConversationContext,
  type ConversationRequest, type ConversationResponse, type ConversationState } from '../domain/conversation-contract.js';
import { classifyConversationSafety, EDUCATIONAL_NOTICE } from '../domain/conversation-policy.js';
import { DOSAGE_FORM_LABEL, dosageForm, type DosageForm } from '../domain/dosage-form.js';
import { closestWord } from '../domain/edit-distance.js';
import { EMERGENCY } from '../domain/emergency.js';
import { REPLIES, noOffersReply } from '../domain/friendly-replies.js';
import { byDistance, byPrice, capital, filterVariant, groupOffers, offerCard, offerSources, soles, variantChoices,
  type OfferGroup } from '../domain/offer-groups.js';
import { todayStatus } from '../domain/opening-now.js';
import { PLACE_CHOICES, placeByName } from '../domain/places.js';
import type { ConversationProvider, ConversationPublicTools, GeoPoint, ReviewedSourceCatalog } from './conversation-ports.js';

const ABSTAIN = 'No dispongo de una fuente revisada y vigente para responder con seguridad.';
export const ALTERNATIVE_LABEL = 'Mismo principio activo y concentración';
export const ALTERNATIVE_NOTICE = 'Consulta al químico farmacéutico antes de cambiar de producto.';
const NEAR_RADIUS_KM = 3;
const CHEAPEST_RADIUS_KM = 5;
const INTENTS = ['SOURCE', 'SYMPTOM', 'PUBLIC_SEARCH', 'PUBLIC_COMPARE', 'HELP', 'GREETING', 'CAPABILITIES', 'NEARBY', 'ASK_TERM'];

function bounded<T>(operation: Promise<T>, milliseconds = 1_500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('conversation timeout')), milliseconds);
    operation.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

interface Place { readonly label: string; readonly point: GeoPoint; readonly context: Pick<ConversationContext, 'distrito' | 'punto'> }
interface Ask {
  readonly intent: AssistantIntent; readonly term: string | null; readonly strength: string | null; readonly form: DosageForm | null;
  readonly place: Place | null; readonly consulta: string;
}
type Extra = Partial<Pick<ConversationResponse, 'tarjetas' | 'opciones' | 'sugerencia' | 'verTodas' | 'fuentes'>>;

/**
 * F06.2 · servidor SIN estado (D-01 A): cada pregunta trae el contexto que guarda la página. Orden fijo:
 * seguridad → intención → medicamento (ofertas públicas) → datos públicos → aclaración → tarjetas. Solo lectura.
 */
export class ConverseAssistant {
  constructor(private readonly provider: ConversationProvider, private readonly sources: ReviewedSourceCatalog,
    private readonly tools: ConversationPublicTools, private readonly now: () => Date = () => new Date()) {}

  async execute(request: ConversationRequest, correlationId: string): Promise<ConversationResponse> {
    const reply = (estado: ConversationState, respuesta: string, contexto: ConversationContext, extra: Extra = {}): ConversationResponse => ({
      version: CONVERSATION_VERSION, estado, respuesta, aviso: EDUCATIONAL_NOTICE, fuentes: [], correlationId, proveedor: 'mock',
      contexto, ...Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== undefined && (!Array.isArray(value) || value.length > 0))),
    });

    // 1. Seguridad: la urgencia va antes que todo y sola (D-08); lo clínico se rechaza sin llamar a nada.
    const safety = classifyConversationSafety(request.consulta);
    if (safety.kind === 'URGENT') return { ...reply('URGENCIA', EMERGENCY.mensaje, {}), emergencia: EMERGENCY };
    if (safety.kind === 'REFUSE') return reply('CLINICA_RECHAZADA', safety.message, {});

    const reading = readPhrase(request.consulta);
    const context: ConversationContext = request.contexto ?? {};
    const decision = await bounded(this.provider.classify(request.consulta));
    if (!INTENTS.includes(decision?.intent) || (decision.term !== null && typeof decision.term !== 'string')) throw new Error('invalid provider decision');

    // 2. Intenciones informativas de F06.1 (fichas revisadas, saludo, ayuda).
    // El clasificador F06.1 toma «¿Qué…» y «¿y…» como seguimiento de ficha: solo vale si no hay intención F06.2.
    const continuesSearch = reading.followUp && (context.intencion !== undefined || reading.place !== null || reading.strength !== null);
    if ((decision.intent === 'SOURCE' || decision.intent === 'SYMPTOM') && !reading.intent && !continuesSearch) {
      return this.source(request, decision.term, reply);
    }
    const named = reading.medicineWords.length > 0;
    let intent: AssistantIntent | null = reading.intent;
    // Seguimiento («¿y en Carmen Alto?», un botón «Ibuprofeno 400 mg»): continúa la intención guardada por la página.
    if (!intent && context.intencion && (reading.followUp || (named && !['GREETING', 'CAPABILITIES'].includes(decision.intent)))) intent = context.intencion;
    // «¿y en Carmen Alto?» tras una pregunta de precio: la misma búsqueda, ahora por cercanía a ese distrito.
    if (!reading.intent && reading.followUp && reading.place && intent === 'PRECIO') intent = 'CERCANIA';
    if (!intent && (decision.intent === 'PUBLIC_COMPARE' || decision.intent === 'PUBLIC_SEARCH')) intent = 'PRECIO';
    if (!intent) {
      const key = decision.intent in REPLIES ? decision.intent as keyof typeof REPLIES : 'HELP';
      return reply('AYUDA', REPLIES[key], context);
    }

    // 3. Medicamento, concentración, forma y lugar (lo nuevo de la frase manda; si no nombra medicamento, sigue el contexto).
    const place = this.place(reading.place?.name ?? null, context);
    const ask: Ask = {
      intent, consulta: request.consulta,
      term: named ? reading.medicineWords.join(' ') : context.medicamento ? normalizeSearchText(context.medicamento) : null,
      strength: reading.strength ?? (named ? null : context.concentracion ?? null),
      form: reading.form ?? (named ? null : context.forma ?? null),
      place,
    };
    const base: ConversationContext = { intencion: intent, ...(ask.term ? { medicamento: ask.term } : {}), ...(place?.context ?? {}) };

    if (intent === 'HORARIO') {
      if (!place) return this.askPlace(base, 'abiertas ahora', reply);
      return this.openNow(ask, place, base, reply);
    }
    if (intent === 'CERCANIA' && !ask.term) {
      if (!place) return reply('AYUDA', REPLIES.NEARBY, base);
      return this.nearbyPharmacies(place, base, reply);
    }
    if (!ask.term) {
      return reply('AYUDA', intent === 'ALTERNATIVA'
        ? '¿De qué producto quieres ver otros con el mismo principio activo y concentración? Escribe su nombre, por ejemplo «Panadol».'
        : REPLIES.ASK_TERM, base);
    }
    if (intent === 'CERCANIA' && !place) return this.askPlace(base, 'cerca', reply);

    const found = await this.findMedicine(ask.term, intent === 'CERCANIA' ? place : null);
    if (!found) return this.notFound(ask, base, reply);
    const term = found.term;
    const named2: ConversationContext = { ...base, medicamento: term };
    const matches = filterVariant(found.offers, ask.strength, ask.form);
    // «el más barato cerca»: el botón de aclaración conserva el pedido completo.
    const cheapest = intent === 'CERCANIA' && reading.cheapest;
    const suffix = cheapest ? 'mas barato cerca' : '';
    const label = [capital(term), ask.strength, ask.form ? DOSAGE_FORM_LABEL[ask.form] : null].filter(Boolean).join(' ');
    const seeAll = { texto: 'Ver todas en Buscar medicamentos', url: `/search?q=${encodeURIComponent([term, ask.strength].filter(Boolean).join(' '))}` };
    if (matches.length === 0) {
      return reply('ACLARACION', `No encontré «${label}» publicado. Estas son las opciones publicadas de «${capital(term)}»:`, named2,
        { opciones: variantChoices(term, groupOffers(found.offers), suffix), verTodas: seeAll });
    }
    const reference = intent === 'ALTERNATIVA' ? this.brandOffers(matches, term) : matches;
    const groups = groupOffers(reference);
    if (groups.length > 1) {
      return reply('ACLARACION', `Hay varias presentaciones de «${capital(term)}». ¿Cuál buscas?`, named2,
        { opciones: variantChoices(term, groups, suffix), verTodas: seeAll });
    }
    const group = groups[0];
    const chosen: ConversationContext = { ...named2, ...(group.strength ? { concentracion: group.strength } : {}), ...(group.form ? { forma: group.form } : {}) };

    if (intent === 'ALTERNATIVA') return this.alternatives(group, chosen, seeAll, reply);
    const nearby = cheapest ? group.offers.filter(offer => offer.distanciaKm !== null && offer.distanciaKm <= CHEAPEST_RADIUS_KM) : [];
    const ordered = nearby.length > 0 ? [...nearby].sort(byPrice) : [...group.offers].sort(intent === 'CERCANIA' ? byDistance : byPrice);
    const top = ordered.slice(0, 3);
    const hours = await this.hoursFor(top.map(offer => offer.farmacia.id));
    const groupLabel = `${capital(term)} ${group.concentracion}${group.form ? ` (${DOSAGE_FORM_LABEL[group.form]})` : ''}`;
    const count = `${ordered.length} ${ordered.length === 1 ? 'oferta publicada' : 'ofertas publicadas'}`;
    const respuesta = nearby.length > 0
      ? `«${groupLabel}» más barato a menos de ${CHEAPEST_RADIUS_KM} km de ${place!.label}, de menor a mayor precio (${count}; distancia en línea recta, referencial).`
      : intent === 'CERCANIA'
      ? `«${groupLabel}» más cerca de ${place!.label} (${count}; distancia en línea recta, referencial).`
        + (top.every(offer => offer.distanciaKm === null) ? ' Estas farmacias aún no tienen ubicación verificada; las muestro por precio.' : '')
      : `Precios referenciales de «${groupLabel}», de menor a mayor (${count}). Confirma precio y existencias con la farmacia.`;
    return reply('BUSQUEDA_PUBLICA', respuesta, chosen, {
      tarjetas: top.map(offer => offerCard(offer, hours[offer.farmacia.id] ?? null)), verTodas: seeAll, fuentes: offerSources(ordered),
    });
  }

  /** Ruta de descarte de F06.1: el servidor ya no guarda nada; se responde 204 por compatibilidad. */
  discard(): void { /* sin estado */ }

  private place(name: string | null, context: ConversationContext | null): Place | null {
    const district = placeByName(name ?? context?.distrito);
    if (district) return { label: district.name, point: { latitude: district.latitude, longitude: district.longitude }, context: { distrito: district.name } };
    if (context?.punto) return { label: 'la ubicación que elegiste', point: { latitude: context.punto.latitud, longitude: context.punto.longitud },
      context: { punto: context.punto } };
    return null;
  }

  private askPlace(base: ConversationContext, what: string, reply: (e: ConversationState, r: string, c: ConversationContext, x?: Extra) => ConversationResponse) {
    const opciones: AssistantChoice[] = PLACE_CHOICES.map(name => ({ texto: name, consulta: `en ${name}` }));
    return reply('ACLARACION', `¿En qué distrito buscas farmacias ${what}? Elige uno o escribe el nombre del distrito.`, base, { opciones });
  }

  private async findMedicine(term: string, place: Place | null): Promise<{ term: string; offers: readonly PublicOffer[] } | null> {
    const options = place ? { order: 'cercania' as const, point: place.point } : { order: 'precio_asc' as const };
    // Una sola búsqueda pública por pregunta (regresión F08.1: el texto ajeno no multiplica llamadas).
    const first = await bounded(this.tools.search(term, options));
    return first.ofertas.length > 0 ? { term, offers: first.ofertas } : null;
  }

  /** «¿Quisiste decir…?» (D-03 A): nombres públicos que empiezan igual + distancia de edición propia. */
  private async notFound(ask: Ask, base: ConversationContext, reply: (e: ConversationState, r: string, c: ConversationContext, x?: Extra) => ConversationResponse) {
    const term = ask.term!;
    const words = term.split(' ').filter(word => word.length >= 4).sort((a, b) => b.length - a.length);
    for (const word of words.slice(0, 2)) {
      const names = await Promise.resolve().then(() => bounded(this.tools.suggestNames(word.slice(0, 4)))).catch(() => [] as readonly string[]);
      const candidates = names.flatMap(name => normalizeSearchText(name).split(' '));
      const closest = closestWord(word, candidates);
      if (closest) {
        const consulta = ` ${normalizeSearchText(ask.consulta)} `.replace(` ${word} `, ` ${closest} `).trim();
        return reply('ABSTENCION', `No encontré «${term}» en las ofertas publicadas.`, { intencion: ask.intent, ...(ask.place?.context ?? {}) },
          { sugerencia: { texto: `¿Quisiste decir ${closest}?`, consulta } });
      }
    }
    return reply('ABSTENCION', noOffersReply(term), { intencion: ask.intent, ...(ask.place?.context ?? {}) });
  }

  /** Si se nombró una marca («Panadol»), la referencia son sus ofertas; si se nombró el principio activo, todas. */
  private brandOffers(offers: readonly PublicOffer[], term: string): PublicOffer[] {
    const words = term.split(' ');
    const brand = offers.filter(offer => words.some(word => normalizeSearchText(offer.medicamento.nombreComercial).split(' ').some(part => part.startsWith(word))));
    return brand.length > 0 ? brand : [...offers];
  }

  /** D-04 (ajuste de Andre): mismo principio activo, misma concentración y misma forma CONOCIDA; solo precios publicados. */
  private async alternatives(group: OfferGroup, chosen: ConversationContext, seeAll: { texto: string; url: string },
    reply: (e: ConversationState, r: string, c: ConversationContext, x?: Extra) => ConversationResponse) {
    const reference = [...group.offers].sort(byPrice)[0];
    const refName = `${capital(reference.medicamento.nombreComercial)} ${reference.medicamento.concentracion}`;
    if (!group.form) {
      return reply('ABSTENCION', `No puedo comparar «${refName}»: su forma farmacéutica no está clara en el catálogo («${reference.medicamento.presentacion}»). ${ALTERNATIVE_NOTICE}`,
        chosen, { verTodas: seeAll });
    }
    const referenceIds = new Set(group.offers.map(offer => offer.medicamento.id));
    const principle = normalizeSearchText(group.principio); const strength = normalizeSearchText(group.concentracion);
    const result = await bounded(this.tools.search(group.principio, { order: 'precio_asc' }));
    const compatible = result.ofertas.filter(offer => !referenceIds.has(offer.medicamento.id)
      && normalizeSearchText(offer.medicamento.principioActivo) === principle
      && normalizeSearchText(offer.medicamento.concentracion) === strength
      && dosageForm(offer.medicamento.presentacion) === group.form);
    const formLabel = DOSAGE_FORM_LABEL[group.form];
    if (compatible.length === 0) {
      return reply('ABSTENCION', `No encontré otros productos con la misma forma farmacéutica publicada (${group.principio} ${group.concentracion}, ${formLabel}). ${ALTERNATIVE_NOTICE}`,
        chosen, { verTodas: seeAll });
    }
    const cheaper = compatible.filter(offer => offer.precioReferencialCentavos < reference.precioReferencialCentavos).sort(byPrice);
    if (cheaper.length === 0) {
      return reply('BUSQUEDA_PUBLICA', `No encontré precios publicados menores que «${refName}» (desde ${soles(reference.precioReferencialCentavos)}) con el mismo principio activo, concentración y forma. ${ALTERNATIVE_NOTICE}`,
        chosen, { verTodas: seeAll });
    }
    const top = cheaper.slice(0, 3);
    const hours = await this.hoursFor(top.map(offer => offer.farmacia.id));
    return reply('BUSQUEDA_PUBLICA', `Productos con el mismo principio activo (${group.principio}), la misma concentración (${group.concentracion}) y la misma forma (${formLabel}), con precio publicado menor que «${refName}» (desde ${soles(reference.precioReferencialCentavos)}). ${ALTERNATIVE_NOTICE}`,
      chosen, { tarjetas: top.map(offer => offerCard(offer, hours[offer.farmacia.id] ?? null, ALTERNATIVE_LABEL)), verTodas: seeAll, fuentes: offerSources(cheaper) });
  }

  private async hoursFor(ids: readonly string[]): Promise<Record<string, string>> {
    if (!this.tools.openingHours || ids.length === 0) return {};
    try {
      const days = await bounded(this.tools.openingHours([...new Set(ids)]));
      const now = this.now();
      return Object.fromEntries(ids.map(id => [id, todayStatus(days[id], now).texto]));
    } catch { return {}; }
  }

  /** HORARIO (D-09 A): farmacias públicas cerca del lugar, abiertas ahora según su horario público (hora de Lima). */
  private async openNow(ask: Ask, place: Place, base: ConversationContext,
    reply: (e: ConversationState, r: string, c: ConversationContext, x?: Extra) => ConversationResponse) {
    if (!this.tools.openingHours || (!ask.term && !this.tools.pharmaciesNear)) {
      return reply('AYUDA', 'El horario público no está disponible ahora. Puedes ver el horario de cada farmacia en Buscar medicamentos.', base,
        { verTodas: { texto: 'Ir a Buscar medicamentos', url: '/search' } });
    }
    const now = this.now();
    let cards: AssistantCard[] = []; let sources: ConversationCitation[] = [];
    if (ask.term) {
      const found = await this.findMedicine(ask.term, place);
      if (!found) return this.notFound(ask, base, reply);
      const offers = filterVariant(found.offers, ask.strength, ask.form).sort(byDistance);
      const days = await bounded(this.tools.openingHours([...new Set(offers.map(offer => offer.farmacia.id))].slice(0, 50)));
      const seen = new Set<string>();
      for (const offer of offers) {
        const status = todayStatus(days[offer.farmacia.id], now);
        if (!status.abierto || seen.has(offer.farmacia.id)) continue;
        seen.add(offer.farmacia.id);
        cards.push(offerCard(offer, status.texto));
      }
      sources = offerSources(offers);
    } else {
      const pharmacies = await bounded(this.tools.pharmaciesNear!(place.point, NEAR_RADIUS_KM));
      const days = await bounded(this.tools.openingHours(pharmacies.slice(0, 50).map(item => item.id)));
      cards = pharmacies.map(item => ({ item, status: todayStatus(days[item.id], now) })).filter(({ status }) => status.abierto)
        .map(({ item, status }) => ({ farmacia: { id: item.id, nombre: item.nombre, direccion: item.direccion }, producto: null,
          precioCentavos: null, distanciaKm: item.distanciaKm, horarioHoy: status.texto, reservarUrl: null }));
    }
    const what = ask.term ? ` con «${capital(ask.term)}»` : '';
    if (cards.length === 0) return reply('ABSTENCION', `No encontré farmacias${what} abiertas ahora cerca de ${place.label} según su horario publicado (hora de Lima).`, base);
    return reply('BUSQUEDA_PUBLICA', `Farmacias${what} abiertas ahora cerca de ${place.label}, según su horario publicado (hora de Lima). Confirma antes de ir.`, base,
      { tarjetas: cards.slice(0, 3), fuentes: sources, ...(ask.term ? { verTodas: { texto: 'Ver todas en Buscar medicamentos', url: `/search?q=${encodeURIComponent(ask.term)}` } } : {}) });
  }

  private async nearbyPharmacies(place: Place, base: ConversationContext,
    reply: (e: ConversationState, r: string, c: ConversationContext, x?: Extra) => ConversationResponse) {
    if (!this.tools.pharmaciesNear) return reply('AYUDA', REPLIES.NEARBY, base);
    const pharmacies = (await bounded(this.tools.pharmaciesNear(place.point, NEAR_RADIUS_KM))).slice(0, 3);
    if (pharmacies.length === 0) return reply('ABSTENCION', `No encontré farmacias con ubicación verificada cerca de ${place.label}.`, base);
    const hours = await this.hoursFor(pharmacies.map(item => item.id));
    return reply('BUSQUEDA_PUBLICA', `Farmacias más cerca de ${place.label} (distancia en línea recta, referencial):`, base, {
      tarjetas: pharmacies.map(item => ({ farmacia: { id: item.id, nombre: item.nombre, direccion: item.direccion }, producto: null,
        precioCentavos: null, distanciaKm: item.distanciaKm, horarioHoy: hours[item.id] ?? null, reservarUrl: null })),
    });
  }

  private source(request: ConversationRequest, term: string | null,
    reply: (e: ConversationState, r: string, c: ConversationContext, x?: Extra) => ConversationResponse) {
    const referent = request.contexto?.medicamento ?? null;
    const source = this.sources.lookup(term ?? request.consulta, this.now()) ?? (referent ? this.sources.lookup(referent, this.now()) : null);
    if (!source) return reply('ABSTENCION', ABSTAIN, request.contexto ?? {});
    const warning = /advertencias?|precauciones?/iu.test(request.consulta) && source.educationalWarning;
    const contexto = /^[\p{L}\p{N}][\p{L}\p{N} ]{1,59}$/u.test(source.productName) ? { medicamento: source.productName } : {};
    return reply('INFORMATIVA', warning || source.educationalStatement, contexto, { fuentes: [{ tipo: 'FICHA', titulo: source.title,
      referencia: source.reference, revisadoEl: source.reviewedAt, vigenteHasta: source.validUntil }] });
  }
}
