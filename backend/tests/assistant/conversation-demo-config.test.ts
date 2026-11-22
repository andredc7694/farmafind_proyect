import { spawnSync } from 'node:child_process';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalIdentityApp } from '../../src/identity-app.js';
import { selectDemoConversationProvider } from '../../src/modules/asistente-ia/infrastructure/demo-conversation-provider.js';

afterEach(() => vi.unstubAllEnvs());

describe('Gemini deshabilitado en F06.1 TEST/DEMO', () => {
  it('selecciona siempre el proveedor determinista y rechaza configuraciones externas', async () => {
    for (const requested of [undefined, '', 'mock', 'gemini', 'gemini-3.5-flash-lite']) {
      const selected = selectDemoConversationProvider(requested);
      expect(await selected.provider.classify('Ayuda')).toEqual({ intent: 'HELP', term: null });
      expect(selected.externalSelectionRejected).toBe(Boolean(requested && requested !== 'mock'));
    }
  });

  it('ignora una clave accidental, rechaza selección desde React y conserva búsqueda F03', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'TEST_ONLY_KEY');
    vi.stubEnv('FARMAFIND_AI_PROVIDER', 'gemini');
    const externalFetch = vi.spyOn(globalThis, 'fetch');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pool = () => ({
      query: async (sql: string) => ({ rows: sql.includes('pg_roles')
        ? [{ rolsuper: false, rolbypassrls: false, permitted: true, forbidden: false }] : [] }),
      connect: async () => { throw new Error('No se debe conectar en TEST'); },
      end: async () => undefined,
    });
    const composed = await createLocalIdentityApp({ authDatabaseUrl: 'TEST-AUTH', tenantDatabaseUrl: 'TEST-RUNTIME',
      csrfKey: Buffer.alloc(32, 1), abuseKey: Buffer.alloc(32, 2),
      allowedOrigin: 'http://127.0.0.1:5173', cookieSecure: false,
      search: { redisUrl: 'redis://127.0.0.1:56378', cacheTtlSeconds: 60,
        cacheTimeoutMs: 50, candidateLimit: 20 } }, pool);
    try {
      const help = await request(composed.app).post('/api/v1/asistente/conversaciones')
        .send({ consulta: 'Ayuda' }).expect(200);
      expect(help.body).toMatchObject({ estado: 'AYUDA', proveedor: 'mock' });
      expect(help.body.respuesta).toContain('IA generativa externa no está habilitada');
      await request(composed.app).post('/api/v1/asistente/conversaciones')
        .send({ consulta: 'Ayuda', provider: 'gemini' }).expect(400);
      const search = await request(composed.app).get('/api/v1/busquedas?q=producto').expect(200);
      expect(search.body.ofertas).toEqual([]);
      expect(warning).toHaveBeenCalledOnce();
      expect(warning.mock.calls[0][0]).not.toContain('TEST_ONLY_KEY');
      expect(externalFetch).not.toHaveBeenCalled();
    } finally {
      await composed.close();
      warning.mockRestore();
      externalFetch.mockRestore();
    }
  });

  it('mantiene el ejecutor de prueba real bloqueado incluso con variables de habilitación y clave ficticias', () => {
    const result = spawnSync(process.execPath, ['scripts/f061/run-gemini-live.mjs'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 5_000,
      env: { ...process.env, GEMINI_API_KEY: 'TEST_ONLY_KEY',
        F061_GEMINI_MODEL: 'gemini-3.5-flash-lite', F061_GEMINI_FREE_TIER_CONFIRMED: '1',
        F061_GEMINI_LIVE_APPROVAL: 'gemini-3.5-flash-lite:3-requests:synthetic-only' },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Gemini real pospuesto');
    expect(result.stderr).not.toContain('TEST_ONLY_KEY');
  });
});
