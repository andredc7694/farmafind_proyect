import { PUBLIC_NOTICE, type PublicSearchResponse } from '../../busqueda/contracts/public-search.js';
import type { AssistantIntent, AssistantSource } from './assistant-contract.js';

export const ASSISTANT_NOTICE = `${PUBLIC_NOTICE} Información general; no sustituye la orientación de un profesional de salud.`;
export function groundSearch(intent: Extract<AssistantIntent,'BUSQUEDA'|'COMPARACION'>, result: PublicSearchResponse): { respuesta: string; fuentes: AssistantSource[] } {
  const sources = result.ofertas.slice(0,20).map(oferta => ({ tipo: 'OFERTA' as const, oferta }));
  if (sources.length === 0) return { respuesta: 'No encontré información pública verificable para esa consulta. Prueba con el nombre comercial o principio activo.', fuentes: [] };
  if (intent === 'COMPARACION') return { respuesta: `Encontré ${sources.length} oferta(s) pública(s), ordenadas por precio referencial. Revisa las fuentes y confirma con cada farmacia.`, fuentes: sources };
  return { respuesta: `Encontré ${sources.length} oferta(s) pública(s) relacionada(s). Revisa las fuentes y confirma con la farmacia.`, fuentes: sources };
}
