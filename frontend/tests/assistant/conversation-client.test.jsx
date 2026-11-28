import { describe, expect, it, vi } from 'vitest';
import { createConversationClient } from '../../src/assistant/conversation-client.js';

describe('cliente de conversación 2.0 (F06.2)', () => {
  it('envía el contexto estructurado solo en el cuerpo JSON y lo omite si está vacío; no hay ruta de descarte', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ estado: 'AYUDA' }) });
    const client = createConversationClient(fetchImpl);
    await client.query('¿y en Carmen Alto?', { intencion: 'PRECIO', medicamento: 'ibuprofeno' });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/asistente/conversaciones');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ consulta: '¿y en Carmen Alto?', contexto: { intencion: 'PRECIO', medicamento: 'ibuprofeno' } });
    await client.query('Ayuda', {});
    await client.query('Ayuda');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({ consulta: 'Ayuda' });
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toEqual({ consulta: 'Ayuda' });
    expect(client.discard).toBeUndefined();
  });
  it.each([[429, 'demasiadas'], [400, 'Revisa'], [503, 'búsqueda pública']])
  ('presenta error comprensible para HTTP %i', async (status, fragment) => {
    const client = createConversationClient(vi.fn().mockResolvedValue({ ok: false, status }));
    await expect(client.query('Ayuda')).rejects.toThrow(fragment);
  });
});
