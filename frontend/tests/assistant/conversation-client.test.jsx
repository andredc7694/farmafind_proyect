import { describe, expect, it, vi } from 'vitest';
import { createConversationClient } from '../../src/assistant/conversation-client.js';

describe('cliente F06.1', () => {
  it('envía contexto solo en el cuerpo JSON y lo descarta por POST', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ estado: 'AYUDA' }) })
      .mockResolvedValueOnce({ ok: true });
    const client = createConversationClient(fetchImpl);
    await client.query('Ayuda', 'id-ficticio');
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/asistente/conversaciones');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ consulta: 'Ayuda', conversacionId: 'id-ficticio' });
    await client.discard('id-ficticio');
    expect(fetchImpl.mock.calls[1][0]).toBe('/api/v1/asistente/conversaciones/descartar');
    expect(fetchImpl.mock.calls[1][1].method).toBe('POST');
  });
  it.each([[429, 'demasiadas'], [422, 'venció'], [503, 'búsqueda pública']])
  ('presenta error comprensible para HTTP %i', async (status, fragment) => {
    const client = createConversationClient(vi.fn().mockResolvedValue({ ok: false, status }));
    await expect(client.query('Ayuda')).rejects.toThrow(fragment);
  });
});
