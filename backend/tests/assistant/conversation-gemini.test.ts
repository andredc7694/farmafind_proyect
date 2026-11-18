import { describe, expect, it, vi } from 'vitest';
import { GeminiConversationProvider } from '../../src/modules/asistente-ia/infrastructure/gemini-conversation-provider.js';

const config = { apiKey: 'TEST_ONLY_KEY', model: 'gemini-test', timeoutMs: 200, maxCalls: 1 };

describe('adaptador Gemini inactivo', () => {
  it('solo clasifica una consulta ficticia con transporte simulado y presupuesto limitado', async () => {
    const transport = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [
      { text: JSON.stringify({ intent: 'PUBLIC_SEARCH', term: 'Producto ficticio' }) },
    ] } }] }), { status: 200 }));
    const provider = new GeminiConversationProvider(config, transport as typeof fetch);
    expect(await provider.classify('Buscar Producto ficticio')).toEqual({ intent: 'PUBLIC_SEARCH', term: 'Producto ficticio' });
    expect(transport).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    await expect(provider.classify('otra')).rejects.toThrow('cuota');
    expect(transport).toHaveBeenCalledOnce();
  });

  it('falla cerrado ante respuesta inválida o indisponibilidad sin filtrar detalles', async () => {
    const invalid = new GeminiConversationProvider(config, vi.fn(async () => new Response('{}')) as typeof fetch);
    await expect(invalid.classify('Consulta ficticia')).rejects.toThrow('Proveedor no disponible');
    const unavailable = new GeminiConversationProvider(config,
      vi.fn(async () => { throw new Error('PRIVATE_PROVIDER_DETAIL'); }) as typeof fetch);
    await expect(unavailable.classify('Consulta ficticia')).rejects.toThrow('Proveedor no disponible');
  });

  it('reintenta una sola vez ante fallo transitorio si el presupuesto lo permite', async () => {
    const transport = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [
        { text: JSON.stringify({ intent: 'HELP', term: null }) },
      ] } }] }), { status: 200 }));
    const provider = new GeminiConversationProvider({ ...config, maxCalls: 2 }, transport as typeof fetch);
    expect(await provider.classify('Ayuda ficticia')).toEqual({ intent: 'HELP', term: null });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('rechaza configuración y entrada inválidas antes de red', async () => {
    const transport = vi.fn();
    expect(() => new GeminiConversationProvider({ ...config, model: '../other' }, transport as typeof fetch)).toThrow();
    const provider = new GeminiConversationProvider(config, transport as typeof fetch);
    await expect(provider.classify('x'.repeat(501))).rejects.toThrow();
    await expect(provider.classify('¿Qué dosis debo tomar?')).rejects.toThrow('no apta');
    await expect(provider.classify('Consulta de test@example.com')).rejects.toThrow('no apta');
    expect(transport).not.toHaveBeenCalled();
  });
});
