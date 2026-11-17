import type { PublicOffer, PublicPharmacy } from '../../busqueda/contracts/public-search.js';

export type AssistantIntent = 'BUSQUEDA' | 'COMPARACION' | 'AYUDA' | 'CLINICA_RECHAZADA';
export interface ProviderDecision { readonly intent: Exclude<AssistantIntent, 'CLINICA_RECHAZADA'>; readonly term: string | null; readonly pharmacyId?: string; }
export type AssistantSource = { readonly tipo: 'OFERTA'; readonly oferta: PublicOffer } |
  { readonly tipo: 'FARMACIA'; readonly farmacia: PublicPharmacy };
export interface AssistantResponse {
  readonly intencion: AssistantIntent;
  readonly respuesta: string;
  readonly fuentes: readonly AssistantSource[];
  readonly aviso: string;
  readonly proveedor: 'mock';
  readonly correlationId: string;
}
export class AssistantError extends Error {
  constructor(readonly code: 'INVALID_REQUEST' | 'INVALID_INTENT' | 'PROVIDER_UNAVAILABLE' | 'SOURCE_UNAVAILABLE', message: string) { super(message); }
}
export function parseAssistantRequest(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new AssistantError('INVALID_REQUEST', 'El cuerpo debe ser un objeto JSON.');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || typeof record.consulta !== 'string') throw new AssistantError('INVALID_REQUEST', 'Solo se admite el campo consulta.');
  const query = record.consulta.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (query.length < 1 || query.length > 500) throw new AssistantError('INVALID_REQUEST', 'La consulta debe tener entre 1 y 500 caracteres.');
  return query;
}
