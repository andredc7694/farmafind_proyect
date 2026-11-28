import { vi } from 'vitest';
import { ConverseAssistant } from '../../../src/modules/asistente-ia/application/converse-assistant.js';
import type { ConversationPublicTools } from '../../../src/modules/asistente-ia/application/conversation-ports.js';
import type { ConversationContext } from '../../../src/modules/asistente-ia/domain/conversation-contract.js';
import { InMemoryReviewedSourceCatalog } from '../../../src/modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { MockConversationProvider } from '../../../src/modules/asistente-ia/infrastructure/mock-conversation-provider.js';
import { PUBLIC_NOTICE, type PublicOffer } from '../../../src/modules/busqueda/contracts/public-search.js';
import { normalizeSearchText } from '../../../src/modules/busqueda/contracts/public-search-text.js';

/** Datos sintéticos F06.2 (TEST): no describen ofertas reales. */
export interface OfferSpec {
  readonly id: string; readonly name: string; readonly principle?: string; readonly strength?: string; readonly presentation?: string;
  readonly pharmacy?: string; readonly price: number; readonly distance?: number | null;
}
export function offer(spec: OfferSpec): PublicOffer {
  const pharmacy = spec.pharmacy ?? 'Alfa';
  return { medicamento: { id: spec.id, nombreComercial: spec.name, principioActivo: spec.principle ?? spec.name,
    concentracion: spec.strength ?? '500 mg', presentacion: spec.presentation ?? 'caja x 10 tabletas', clasificacion: 'venta libre' },
  farmacia: { id: `farm-${pharmacy.toLowerCase()}`, nombre: `Farmacia ${pharmacy}`, direccion: `Jr. ${pharmacy} 123`, ubicacion: null },
  precioReferencialCentavos: spec.price, disponibilidadReferencial: 'DISPONIBLE', ultimaRevision: '2026-11-25T12:00:00.000Z',
  distanciaKm: spec.distance ?? null };
}
export const result = (ofertas: readonly PublicOffer[]) => ({ consulta: 'x', ofertas,
  paginacion: { pagina: 1, tamano: 50, total: ofertas.length, totalPaginas: 1 }, aviso: PUBLIC_NOTICE, coincidencia: 'EXACTA' as const });

/** Búsqueda falsa: devuelve las ofertas cuyo nombre o principio activo contiene TODAS las palabras del término. */
export function catalogTools(catalog: readonly PublicOffer[], extra: Partial<ConversationPublicTools> = {}) {
  const matches = (term: string) => {
    const words = normalizeSearchText(term).split(' ').filter(Boolean);
    return catalog.filter(item => {
      const text = normalizeSearchText(`${item.medicamento.nombreComercial} ${item.medicamento.principioActivo}`);
      return words.every(word => text.includes(word));
    });
  };
  return {
    search: vi.fn(async (term: string, _options?: unknown) => result(matches(term))),
    suggestNames: vi.fn(async (prefix: string) => [...new Set(matches(prefix).map(item => item.medicamento.nombreComercial))]),
    ...extra,
  };
}

export function assistant(tools: Partial<ConversationPublicTools> & Record<string, unknown>, now = () => new Date('2026-11-27T15:00:00.000Z'),
  sources: ConstructorParameters<typeof InMemoryReviewedSourceCatalog>[0] = []) {
  const service = new ConverseAssistant(new MockConversationProvider(), new InMemoryReviewedSourceCatalog(sources), tools as never, now);
  return { service, ask: (consulta: string, contexto: ConversationContext = {}) => service.execute({ consulta, contexto }, 'corr') };
}
