import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ConverseAssistant } from '../../src/modules/asistente-ia/application/converse-assistant.js';
import { InMemoryConversationStore } from '../../src/modules/asistente-ia/infrastructure/in-memory-conversation-store.js';
import { InMemoryReviewedSourceCatalog } from '../../src/modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { MockConversationProvider } from '../../src/modules/asistente-ia/infrastructure/mock-conversation-provider.js';
import { createConversationRouter } from '../../src/modules/asistente-ia/presentation/conversation-router.js';
import { InMemoryAssistantRateLimit } from '../../src/modules/asistente-ia/presentation/rate-limit.js';
import { SYNTHETIC_SOURCE } from './fixtures/conversation-fixtures.js';
import { createLocalIdentityApp } from '../../src/identity-app.js';

function app(withSource = true, limit = new InMemoryAssistantRateLimit()) {
  const tools = { search: vi.fn(), compare: vi.fn(), pharmacy: vi.fn() };
  const service = new ConverseAssistant(new MockConversationProvider(),
    new InMemoryReviewedSourceCatalog(withSource ? [SYNTHETIC_SOURCE] : []), tools,
    new InMemoryConversationStore(), () => new Date('2026-11-17T12:00:00.000Z'));
  const server = express();
  server.use('/api/v1', createConversationRouter(service, limit));
  return { server, tools };
}

describe('HTTP F06.1', () => {
  it('compone rutas F06 y F06.1 sin base ni Redis activos para ayuda y abstención', async () => {
    const pool = () => ({
      query: async () => ({ rows: [{ rolsuper: false, rolbypassrls: false, permitted: true, forbidden: false }] }),
      connect: async () => { throw Error('No se debe conectar a PostgreSQL en esta prueba'); },
      end: async () => undefined,
    });
    const composed = await createLocalIdentityApp({ authDatabaseUrl: 'TEST-AUTH', tenantDatabaseUrl: 'TEST-RUNTIME',
      csrfKey: Buffer.alloc(32, 1), abuseKey: Buffer.alloc(32, 2),
      allowedOrigin: 'http://127.0.0.1:5173', cookieSecure: false,
      search: { redisUrl: 'redis://:TEST_ONLY@127.0.0.1:56379', cacheTtlSeconds: 60,
        cacheTimeoutMs: 150, candidateLimit: 200 } }, pool);
    try {
      const help = await request(composed.app).post('/api/v1/asistente/conversaciones')
        .send({ consulta: 'Ayuda' }).expect(200);
      expect(help.body.estado).toBe('AYUDA');
      const absent = await request(composed.app).post('/api/v1/asistente/conversaciones')
        .send({ consulta: 'Ficha de Producto Ficticio Alfa', conversacionId: help.body.conversacionId }).expect(200);
      expect(absent.body).toMatchObject({ estado: 'ABSTENCION', fuentes: [] });
      const clinical = await request(composed.app).post('/api/v1/asistente/conversaciones')
        .send({ consulta: '¿Qué dosis debo tomar?' }).expect(200);
      expect(clinical.body.estado).toBe('CLINICA_RECHAZADA');
      const legacy = await request(composed.app).post('/api/v1/asistente/consultar')
        .send({ consulta: 'Ayuda' }).expect(200);
      expect(legacy.body.proveedor).toBe('mock');
    } finally { await composed.close(); }
  });
  it('devuelve ficha TEST citada, seguimiento y descarte', async () => {
    const { server } = app();
    const first = await request(server).post('/api/v1/asistente/conversaciones')
      .send({ consulta: 'Ficha de Producto Ficticio Alfa' }).expect(200);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(first.body).toMatchObject({ estado: 'INFORMATIVA', proveedor: 'mock', correlationId: expect.any(String) });
    expect(first.body.fuentes).toHaveLength(1);
    const id = first.body.conversacionId;
    await request(server).post('/api/v1/asistente/conversaciones')
      .send({ consulta: '¿y sus advertencias?', conversacionId: id }).expect(200);
    await request(server).post('/api/v1/asistente/conversaciones/descartar').send({ conversacionId: id }).expect(204);
    const expired = await request(server).post('/api/v1/asistente/conversaciones')
      .send({ consulta: '¿y sus advertencias?', conversacionId: id }).expect(422);
    expect(expired.body.code).toBe('INVALID_CONTEXT');
  });
  it('se abstiene sin contenido autorizado', async () => {
    const result = await request(app(false).server).post('/api/v1/asistente/conversaciones')
      .send({ consulta: 'Ficha de Producto Ficticio Alfa' }).expect(200);
    expect(result.body).toMatchObject({ estado: 'ABSTENCION', fuentes: [] });
  });
  it('rechaza clínica sin herramientas y con mensaje específico', async () => {
    const { server, tools } = app();
    const response = await request(server).post('/api/v1/asistente/conversaciones')
      .send({ consulta: '¿Qué dosis debo tomar?' }).expect(200);
    expect(response.body.estado).toBe('CLINICA_RECHAZADA');
    expect(response.body.respuesta).toMatch(/No puedo diagnosticar/);
    expect(tools.search).not.toHaveBeenCalled();
  });
  it('valida JSON, campos, tamaño y cuota', async () => {
    const { server } = app(true, new InMemoryAssistantRateLimit(3));
    await request(server).post('/api/v1/asistente/conversaciones').send({ consulta: 'x', extra: 1 }).expect(400);
    await request(server).post('/api/v1/asistente/conversaciones').set('Content-Type', 'application/json').send('{').expect(400);
    await request(server).post('/api/v1/asistente/conversaciones').send({ consulta: 'x'.repeat(5000) }).expect(413);
    await request(server).post('/api/v1/asistente/conversaciones').send({ consulta: 'Ficha de Producto Ficticio Alfa' }).expect(429);
  });
});
