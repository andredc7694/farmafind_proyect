export type ConversationState = 'INFORMATIVA' | 'BUSQUEDA_PUBLICA' | 'AYUDA' | 'ABSTENCION' | 'CLINICA_RECHAZADA' | 'URGENCIA';

export interface ConversationRequest {
  readonly consulta: string;
  readonly conversacionId?: string;
}

export interface ConversationCitation {
  readonly tipo: 'FICHA' | 'OFERTA_PUBLICA' | 'FARMACIA_PUBLICA';
  readonly titulo: string;
  readonly referencia: string;
  readonly revisadoEl: string;
  readonly vigenteHasta?: string;
}

export interface ConversationResponse {
  readonly estado: ConversationState;
  readonly respuesta: string;
  readonly aviso: string;
  readonly fuentes: readonly ConversationCitation[];
  readonly correlationId: string;
  readonly proveedor: 'mock';
  readonly conversacionId?: string;
  readonly expiraEn?: string;
}

export class ConversationRequestError extends Error {
  constructor(readonly code: 'INVALID_REQUEST' | 'INVALID_CONTEXT' | 'LIMIT_REACHED', message: string) { super(message); }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function parseConversationRequest(value: unknown): ConversationRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConversationRequestError('INVALID_REQUEST', 'El cuerpo debe ser un objeto JSON.');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !['consulta', 'conversacionId'].includes(key)) || typeof record.consulta !== 'string') {
    throw new ConversationRequestError('INVALID_REQUEST', 'Solo se admiten consulta y conversacionId.');
  }
  const consulta = record.consulta.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (consulta.length < 1 || consulta.length > 500) {
    throw new ConversationRequestError('INVALID_REQUEST', 'La consulta debe tener entre 1 y 500 caracteres.');
  }
  if (record.conversacionId !== undefined && (typeof record.conversacionId !== 'string' || !UUID.test(record.conversacionId))) {
    throw new ConversationRequestError('INVALID_REQUEST', 'El identificador de conversación no es válido.');
  }
  return record.conversacionId === undefined ? { consulta } : { consulta, conversacionId: record.conversacionId as string };
}

export function parseDiscardRequest(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConversationRequestError('INVALID_REQUEST', 'El cuerpo debe ser un objeto JSON.');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || typeof record.conversacionId !== 'string' || !UUID.test(record.conversacionId)) {
    throw new ConversationRequestError('INVALID_REQUEST', 'Solo se admite conversacionId válido.');
  }
  return record.conversacionId;
}
