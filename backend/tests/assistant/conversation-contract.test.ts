import { describe, expect, it } from 'vitest';
import { parseConversationRequest, ConversationRequestError } from '../../src/modules/asistente-ia/domain/conversation-contract.js';

describe('contrato F06.1', () => {
  it('acepta y normaliza una consulta de 1 a 500 caracteres', () => {
    expect(parseConversationRequest({ consulta: '  Producto   Ficticio  ' })).toEqual({ consulta: 'Producto Ficticio' });
    expect(parseConversationRequest({ consulta: 'x'.repeat(500) }).consulta).toHaveLength(500);
  });
  it('acepta identificador UUID opcional', () => {
    const id = 'd59d9002-f711-4cf9-a5d3-a16f11caa101';
    expect(parseConversationRequest({ consulta: 'continuar', conversacionId: id }).conversacionId).toBe(id);
  });
  it.each([null, [], {}, { consulta: '' }, { consulta: 'x'.repeat(501) },
    { consulta: 'ok', extra: true }, { consulta: 'ok', conversacionId: 'invalido' }, { consulta: 42 }])
  ('rechaza cuerpos inválidos %#', body => expect(() => parseConversationRequest(body)).toThrow(ConversationRequestError));
});
