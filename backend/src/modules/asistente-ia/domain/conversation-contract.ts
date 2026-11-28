import { ASSISTANT_INTENTS, type AssistantIntent } from './assistant-language.js';
import { isDosageForm, type DosageForm } from './dosage-form.js';
import type { EmergencyNotice } from './emergency.js';
import { placeByName } from './places.js';

/** F06.2 · contrato de conversación 2.0 (D-01 A, D-05 A). El servidor no guarda conversaciones. */
export const CONVERSATION_VERSION = '2.0';
export type ConversationState = 'INFORMATIVA' | 'BUSQUEDA_PUBLICA' | 'ACLARACION' | 'AYUDA' | 'ABSTENCION' | 'CLINICA_RECHAZADA' | 'URGENCIA';

/**
 * Resumen de la conversación que guarda la PÁGINA (nunca el servidor) y reenvía en cada pregunta.
 * Condición de Andre (2026-11-27): solo datos estructurados y limitados, nunca texto libre; el servidor valida cada
 * campo, descarta lo que no reconoce y no lo escribe en registros.
 */
export interface ConversationContext {
  readonly intencion?: AssistantIntent;
  readonly medicamento?: string;
  readonly concentracion?: string;
  readonly forma?: DosageForm;
  readonly distrito?: string;
  readonly punto?: { readonly latitud: number; readonly longitud: number };
}

export interface ConversationRequest {
  readonly consulta: string;
  readonly contexto: ConversationContext;
}

export interface ConversationCitation {
  readonly tipo: 'FICHA' | 'OFERTA_PUBLICA' | 'FARMACIA_PUBLICA';
  readonly titulo: string;
  readonly referencia: string;
  readonly revisadoEl: string;
  readonly vigenteHasta?: string;
}

export interface AssistantCard {
  readonly etiqueta?: string;
  readonly farmacia: { readonly id: string; readonly nombre: string; readonly direccion: string };
  readonly producto: { readonly id: string; readonly nombre: string; readonly concentracion: string; readonly presentacion: string } | null;
  readonly precioCentavos: number | null;
  readonly distanciaKm: number | null;
  readonly horarioHoy: string | null;
  readonly reservarUrl: string | null;
}
export interface AssistantChoice { readonly texto: string; readonly consulta: string }

export interface ConversationResponse {
  readonly version: typeof CONVERSATION_VERSION;
  readonly estado: ConversationState;
  readonly respuesta: string;
  readonly aviso: string;
  readonly fuentes: readonly ConversationCitation[];
  readonly correlationId: string;
  readonly proveedor: 'mock';
  readonly contexto: ConversationContext;
  readonly tarjetas?: readonly AssistantCard[];
  readonly opciones?: readonly AssistantChoice[];
  readonly sugerencia?: AssistantChoice;
  readonly verTodas?: { readonly texto: string; readonly url: string };
  readonly emergencia?: EmergencyNotice;
}

export class ConversationRequestError extends Error {
  constructor(readonly code: 'INVALID_REQUEST', message: string) { super(message); }
}

export const MAX_CONTEXT_BYTES = 1024;
const MEDICINE = /^[\p{L}\p{N}][\p{L}\p{N} ]{1,59}$/u;
const STRENGTH = /^\d{1,5}(?:\.\d{1,3})? (?:mg|g|mcg|ug|ml|ui|%)$/;
/** Recuadro del Perú (aprox.): un punto fuera se descarta. */
const PERU = { minLat: -18.4, maxLat: -0.03, minLon: -81.4, maxLon: -68.6 };
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Valida el contexto campo por campo. Lo que no se reconoce (claves extra, tipos, textos con signos, valores fuera de
 * lista o de rango) se DESCARTA en silencio y la pregunta sigue; un contexto de más de 1 KB se descarta entero.
 */
export function parseConversationContext(value: unknown): ConversationContext {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  let size: number;
  try { size = Buffer.byteLength(JSON.stringify(value), 'utf8'); } catch { return {}; }
  if (size > MAX_CONTEXT_BYTES) return {};
  const raw = value as Record<string, unknown>;
  const context: { -readonly [K in keyof ConversationContext]: ConversationContext[K] } = {};
  if (typeof raw.intencion === 'string' && (ASSISTANT_INTENTS as readonly string[]).includes(raw.intencion)) {
    context.intencion = raw.intencion as AssistantIntent;
  }
  if (typeof raw.medicamento === 'string') {
    const medicine = raw.medicamento.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (MEDICINE.test(medicine)) context.medicamento = medicine;
  }
  if (typeof raw.concentracion === 'string' && raw.concentracion.length <= 20 && STRENGTH.test(raw.concentracion)) {
    context.concentracion = raw.concentracion;
  }
  if (isDosageForm(raw.forma)) context.forma = raw.forma;
  const place = placeByName(raw.distrito);
  if (place) context.distrito = place.name;
  const point = raw.punto as Record<string, unknown> | undefined;
  if (typeof point === 'object' && point !== null && !Array.isArray(point) && Object.keys(point).length === 2
      && typeof point.latitud === 'number' && typeof point.longitud === 'number'
      && point.latitud >= PERU.minLat && point.latitud <= PERU.maxLat && point.longitud >= PERU.minLon && point.longitud <= PERU.maxLon) {
    context.punto = { latitud: round3(point.latitud), longitud: round3(point.longitud) };
  }
  return context;
}

export function parseConversationRequest(value: unknown): ConversationRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConversationRequestError('INVALID_REQUEST', 'El cuerpo debe ser un objeto JSON.');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !['consulta', 'contexto'].includes(key)) || typeof record.consulta !== 'string') {
    throw new ConversationRequestError('INVALID_REQUEST', 'Solo se admiten consulta y contexto.');
  }
  const consulta = record.consulta.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (consulta.length < 1 || consulta.length > 500) {
    throw new ConversationRequestError('INVALID_REQUEST', 'La consulta debe tener entre 1 y 500 caracteres.');
  }
  return { consulta, contexto: parseConversationContext(record.contexto) };
}
